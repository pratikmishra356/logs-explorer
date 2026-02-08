"""Low-level async HTTP client for the Splunk Cloud REST API."""

import asyncio
import json
import logging
import time

import httpx

logger = logging.getLogger(__name__)


class SplunkClient:
    """Thin wrapper around httpx for Splunk REST calls."""

    def __init__(
        self,
        host_url: str,
        auth_type: str = "cookie",
        credentials: dict | None = None,
        timeout: float = 30.0,
    ):
        self.host_url = host_url.rstrip("/")
        self.auth_type = auth_type
        self.credentials = credentials or {}
        self.timeout = timeout
        self.base_api = f"{self.host_url}/en-US/splunkd/__raw/services"

    def _headers(self) -> dict[str, str]:
        headers: dict[str, str] = {
            "X-Requested-With": "XMLHttpRequest",
        }
        if self.auth_type == "cookie":
            headers["Cookie"] = self.credentials.get("cookie", "")
            csrf = self.credentials.get("csrf_token", "")
            if csrf:
                headers["X-Splunk-Form-Key"] = csrf
        elif self.auth_type == "token":
            token = self.credentials.get("token", "")
            headers["Authorization"] = f"Bearer {token}"
        return headers

    # ------------------------------------------------------------------
    # Simple GET for REST endpoints (server info, indexes, apps, etc.)
    # ------------------------------------------------------------------
    async def get(self, endpoint: str, params: dict | None = None) -> dict | list | str:
        """Perform a GET request and return parsed JSON."""
        url = f"{self.base_api}{endpoint}"
        default_params = {"output_mode": "json"}
        if params:
            default_params.update(params)

        async with httpx.AsyncClient(verify=False, timeout=self.timeout) as client:
            resp = await client.get(url, headers=self._headers(), params=default_params)
            resp.raise_for_status()
            return resp.json()

    # ------------------------------------------------------------------
    # Async job flow: POST (normal) -> poll GET -> GET results
    # Same as Splunk dashboard. Works for all commands including | metadata.
    # ------------------------------------------------------------------
    async def run_search(
        self,
        search_query: str,
        earliest_time: str | None = None,
        latest_time: str | None = None,
        max_results: int = 0,
        max_count: int = 0,
        poll_interval: float = 2.0,
        max_poll: int = 30,
        auto_cancel: int = 60,
        search_level: str = "fast",
    ) -> list[dict]:
        """Run search via async job flow (POST normal -> poll -> GET results).

        This is how the Splunk dashboard works. The POST returns a SID instantly,
        the search runs server-side, and we poll until done.

        Args:
            max_count: Tell Splunk to stop scanning after this many results.
                       0 = unlimited. Set this for log searches to avoid full scans.
            search_level: "fast" (skip field discovery, good for metadata),
                          "smart" (default), "verbose" (full field extraction).
        """
        start = time.time()

        # Step 1: Create job (returns SID instantly)
        url = f"{self.base_api}/search/jobs"
        data: dict[str, str | int] = {
            "search": search_query,
            "exec_mode": "normal",
            "output_mode": "json",
            "ad_hoc_search_level": search_level,
            "auto_cancel": str(auto_cancel),
        }
        if max_count > 0:
            data["max_count"] = str(max_count)
        if earliest_time:
            data["earliest_time"] = earliest_time
        if latest_time:
            data["latest_time"] = latest_time

        async with httpx.AsyncClient(verify=False, timeout=10.0) as client:
            resp = await client.post(url, headers=self._headers(), data=data)
            resp.raise_for_status()
            sid = resp.json().get("sid")

        if not sid:
            raise RuntimeError("No SID returned from search job creation")

        logger.info(
            f"Search job created: SID={sid}, max_count={max_count}, "
            f"level={search_level} ({time.time() - start:.2f}s)"
        )

        # Step 2: Poll for completion (lightweight GETs)
        status_url = f"{self.base_api}/search/jobs/{sid}"
        poll_count = 0
        last_result_count = 0

        try:
            async with httpx.AsyncClient(verify=False, timeout=10.0) as client:
                while poll_count < max_poll:
                    poll_count += 1
                    resp = await client.get(
                        status_url,
                        headers=self._headers(),
                        params={"output_mode": "json"},
                    )
                    resp.raise_for_status()
                    entry = resp.json().get("entry", [{}])[0]
                    content = entry.get("content", {})

                    is_done = content.get("isDone", False)
                    dispatch_state = content.get("dispatchState", "?")
                    result_count = content.get("resultCount", 0)
                    last_result_count = result_count

                    if poll_count <= 3 or poll_count % 5 == 0:
                        logger.info(
                            f"Poll #{poll_count} SID={sid}: state={dispatch_state}, "
                            f"results={result_count}, elapsed={time.time() - start:.1f}s"
                        )

                    if is_done:
                        logger.info(
                            f"Job {sid} done: {result_count} results "
                            f"({time.time() - start:.2f}s total)"
                        )
                        break

                    # Early exit: we already have enough results, finalize the job
                    if max_count > 0 and result_count >= max_count:
                        logger.info(
                            f"Job {sid} reached max_count={max_count} "
                            f"({result_count} results), finalizing..."
                        )
                        await self._finalize_job(sid)
                        break

                    await asyncio.sleep(poll_interval)
                else:
                    # Max polls exceeded -- fetch partial results if any, then cancel
                    logger.warning(
                        f"Job {sid} exceeded {max_poll} polls ({time.time() - start:.0f}s), "
                        f"has {last_result_count} partial results"
                    )
                    if last_result_count > 0:
                        results = await self._fetch_results(sid, max_results or last_result_count)
                        await self._cancel_job(sid)
                        logger.info(f"Returning {len(results)} partial results for timed-out job {sid}")
                        return results
                    await self._cancel_job(sid)
                    raise TimeoutError(
                        f"Search timed out after {time.time() - start:.0f}s with 0 results. "
                        f"Try narrowing your time range or adding a source filter."
                    )
        except TimeoutError:
            raise
        except Exception:
            await self._cancel_job(sid)
            raise

        # Step 3: Fetch results
        results = await self._fetch_results(sid, max_results)
        logger.info(
            f"Fetched {len(results)} results for SID={sid} "
            f"({time.time() - start:.2f}s total)"
        )
        return results

    async def _fetch_results(self, sid: str, count: int = 0) -> list[dict]:
        """Fetch results from a completed/running search job."""
        results_url = f"{self.base_api}/search/jobs/{sid}/results"
        async with httpx.AsyncClient(verify=False, timeout=30.0) as client:
            resp = await client.get(
                results_url,
                headers=self._headers(),
                params={"output_mode": "json", "count": count},
            )
            resp.raise_for_status()
        return resp.json().get("results", [])

    async def _finalize_job(self, sid: str) -> None:
        """Tell Splunk to finalize (stop scanning, keep results)."""
        try:
            url = f"{self.base_api}/search/jobs/{sid}/control"
            async with httpx.AsyncClient(verify=False, timeout=10.0) as client:
                await client.post(
                    url,
                    headers=self._headers(),
                    data={"action": "finalize", "output_mode": "json"},
                )
            logger.info(f"Finalized job {sid}")
        except Exception as exc:
            logger.warning(f"Failed to finalize job {sid}: {exc}")

    # ------------------------------------------------------------------
    # Cancel/delete a search job (cleanup)
    # ------------------------------------------------------------------
    async def _cancel_job(self, sid: str) -> None:
        """Cancel a search job to free Splunk resources."""
        try:
            url = f"{self.base_api}/search/jobs/{sid}"
            async with httpx.AsyncClient(verify=False, timeout=10.0) as client:
                await client.delete(
                    url,
                    headers=self._headers(),
                    params={"output_mode": "json"},
                )
            logger.info(f"Cancelled job {sid}")
        except Exception as exc:
            logger.warning(f"Failed to cancel job {sid}: {exc}")

    # ------------------------------------------------------------------
    # GET export -- for simple streaming searches (search command)
    # ------------------------------------------------------------------
    async def get_export(self, search_query: str, max_results: int = 100, timeout: float = 60.0) -> list[dict]:
        """Run search via GET /search/jobs/export (streaming).

        Only works for streaming commands like 'search'. Does NOT work
        for generating commands like '| metadata' or '| tstats'.
        """
        url = f"{self.base_api}/search/jobs/export"
        params = {
            "search": search_query,
            "output_mode": "json",
            "count": max_results,
        }

        start = time.time()
        logger.info(f"Export search: {search_query!r}")

        async with httpx.AsyncClient(verify=False, timeout=timeout) as client:
            resp = await client.get(url, headers=self._headers(), params=params)
            resp.raise_for_status()

        results = []
        for line in resp.text.strip().split("\n"):
            line = line.strip()
            if not line:
                continue
            try:
                data = json.loads(line)
                if "result" in data:
                    results.append(data["result"])
            except json.JSONDecodeError:
                continue

        logger.info(f"Export done: {len(results)} results in {time.time() - start:.2f}s")
        return results
