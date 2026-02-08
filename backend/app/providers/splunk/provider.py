"""Splunk Cloud provider — implements BaseLogProvider."""

import logging
import re
from datetime import datetime, timezone

from app.providers.base import BaseLogProvider
from app.providers.splunk.client import SplunkClient
from app.providers.splunk import mappers

logger = logging.getLogger(__name__)


class SplunkCloudProvider(BaseLogProvider):
    def __init__(
        self,
        host_url: str,
        auth_type: str = "cookie",
        credentials: dict | None = None,
        config: dict | None = None,
        **kwargs,
    ):
        self.client = SplunkClient(
            host_url=host_url,
            auth_type=auth_type,
            credentials=credentials,
        )

    # ------------------------------------------------------------------
    # Connection
    # ------------------------------------------------------------------
    async def test_connection(self) -> dict:
        try:
            data = await self.client.get("/server/info")
            entries = data.get("entry", [])
            if not entries:
                return {"success": False, "message": "No server info returned", "details": None}
            content = entries[0].get("content", {})
            return {
                "success": True,
                "message": f"Connected to Splunk {content.get('version', '?')}",
                "details": {
                    "version": content.get("version"),
                    "server_name": content.get("serverName"),
                    "build": content.get("build"),
                    "os_name": content.get("os_name"),
                },
            }
        except Exception as exc:
            return {"success": False, "message": str(exc), "details": None}

    # ------------------------------------------------------------------
    # Sync: repositories (indexes)
    # ------------------------------------------------------------------
    async def sync_repositories(self) -> list[dict]:
        data = await self.client.get("/data/indexes", params={"count": 0})
        entries = data.get("entry", [])
        return [mappers.map_index(e) for e in entries]

    # ------------------------------------------------------------------
    # Sync: sources per repository
    # Uses: | metadata type=sources index="<name>"
    # Runs via async job flow (POST normal -> poll -> GET results)
    # Time range passed as job params, not inline SPL
    # ------------------------------------------------------------------
    async def sync_sources_for_repository(self, repository_name: str, time_range: str = "-1h") -> list[dict]:
        search_query = f'| metadata type=sources index="{repository_name}"'

        logger.info(f"Syncing sources for index '{repository_name}' (time_range={time_range})")

        results = await self.client.run_search(
            search_query,
            earliest_time=time_range,
            latest_time="now",
        )

        # Aggregate by cleaned service name (strip trailing revision number)
        # e.g. prod-restaurant-sets-417 -> prod-restaurant-sets
        aggregated: dict[str, dict] = {}
        now = datetime.now(timezone.utc)

        for result in results:
            raw_source = result.get("source", "").strip()
            if not raw_source:
                continue

            # Strip trailing -<digits> (revision/replica number)
            clean_name = re.sub(r"-\d+$", "", raw_source)
            if not clean_name:
                continue

            last_time = result.get("lastTime")
            first_time = result.get("firstTime")
            total_count = result.get("totalCount")

            tc = int(total_count) if total_count else 0
            lt = datetime.fromtimestamp(float(last_time), tz=timezone.utc) if last_time else None
            ft = datetime.fromtimestamp(float(first_time), tz=timezone.utc) if first_time else None

            if clean_name in aggregated:
                existing = aggregated[clean_name]
                existing["total_count"] = (existing["total_count"] or 0) + tc
                if lt and (existing["last_event_at"] is None or lt > existing["last_event_at"]):
                    existing["last_event_at"] = lt
                if ft and (existing["first_event_at"] is None or ft < existing["first_event_at"]):
                    existing["first_event_at"] = ft
            else:
                aggregated[clean_name] = {
                    "name": clean_name,
                    "total_count": tc,
                    "last_event_at": lt,
                    "first_event_at": ft,
                    "config": {},
                    "synced_at": now,
                }

        sources = list(aggregated.values())
        logger.info(
            f"Parsed {len(results)} raw sources -> {len(sources)} unique services "
            f"for index '{repository_name}'"
        )
        return sources

    # ------------------------------------------------------------------
    # Sync: applications (apps)
    # ------------------------------------------------------------------
    async def sync_applications(self) -> list[dict]:
        data = await self.client.get("/apps/local", params={"count": 0})
        entries = data.get("entry", [])
        return [mappers.map_app(e) for e in entries]

    # ------------------------------------------------------------------
    # Sync: saved queries — optional
    # ------------------------------------------------------------------
    async def sync_saved_queries(self) -> list[dict]:
        return []

    # ------------------------------------------------------------------
    # Sync: dashboards (views)
    # ------------------------------------------------------------------
    async def sync_dashboards(self) -> list[dict]:
        data = await self.client.get("/data/ui/views", params={"count": 0})
        entries = data.get("entry", [])
        return [mappers.map_dashboard(e) for e in entries]

    # ------------------------------------------------------------------
    # Search — uses export for streaming search commands
    # ------------------------------------------------------------------
    async def execute_search(
        self,
        query: str,
        time_range: str = "-15m",
        repositories: list[str] | None = None,
        max_results: int = 100,
    ) -> dict:
        spl = query.strip()
        if not spl.lower().startswith("search"):
            spl = f"search {spl}"

        if repositories:
            idx_filter = " OR ".join(f'index="{r}"' for r in repositories)
            if "index=" not in spl.lower():
                spl = spl.replace("search ", f"search ({idx_filter}) ", 1)

        full_query = f"{spl} earliest={time_range}"

        try:
            results = await self.client.get_export(full_query, max_results=max_results)
            mapped = [mappers.map_search_result(r) for r in results]
            return {
                "success": True,
                "query": spl,
                "result_count": len(mapped),
                "results": mapped,
                "message": None,
            }
        except Exception as exc:
            return {
                "success": False,
                "query": spl,
                "result_count": 0,
                "results": [],
                "message": str(exc),
            }
