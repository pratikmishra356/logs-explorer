"""Search API -- exposed for external services."""

import logging
import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.schemas.search import LogSearchRequest, LogSearchResponse
from app.services import organization_service
from app.providers.registry import get_provider

logger = logging.getLogger(__name__)
router = APIRouter(tags=["search"])


@router.post(
    "/organizations/{org_id}/search",
    response_model=LogSearchResponse,
)
async def search_logs(
    org_id: uuid.UUID,
    req: LogSearchRequest,
    db: AsyncSession = Depends(get_db),
):
    """Search logs for an organization.

    - Backend wraps source with wildcards: source="payment-fraud" -> source="*payment-fraud*"
    - Time range validated: max 7 days span.
    - Passes max_count to Splunk so it stops scanning after enough results.
    - Returns: {"data": [list of raw log dicts]}
    """
    conn = await organization_service.get_org_connection(db, org_id)

    provider = get_provider(
        provider_type=conn.provider_type,
        connection_config={
            "host_url": conn.host_url,
            "auth_type": conn.auth_type,
            "credentials": conn.credentials,
            "config": conn.config,
        },
    )

    # Build SPL query
    spl_parts = [f'search index="{req.index}"']

    if req.source:
        # Backend adds wildcards
        source_clean = req.source.strip("*")
        spl_parts.append(f'source="*{source_clean}*"')

    if req.query:
        # Each query string gets wrapped in quotes, combined with OR (match any term)
        quoted_queries = [f'"{q}"' for q in req.query if q.strip()]
        if quoted_queries:
            or_clause = " OR ".join(quoted_queries)
            spl_parts.append(f"({or_clause})")

    spl = " ".join(spl_parts)

    # Time as epoch
    earliest = str(int(req.from_time.timestamp()))
    latest = str(int(req.to_time.timestamp()))

    logger.info(f"Search: {spl} earliest={earliest} latest={latest} max={req.max_results}")

    try:
        results = await provider.client.run_search(
            search_query=spl,
            earliest_time=earliest,
            latest_time=latest,
            max_results=req.max_results,
            max_count=req.max_results,       # Tell Splunk to stop after enough results
            search_level="smart",             # Full field extraction for log searches
            auto_cancel=120,                  # 2 min before Splunk auto-cancels
            max_poll=45,                      # ~90s of polling before we give up
        )
        return LogSearchResponse(data=results)
    except TimeoutError as exc:
        raise HTTPException(status_code=504, detail=str(exc))
    except Exception as exc:
        logger.exception(f"Search failed: {exc}")
        raise HTTPException(status_code=502, detail=f"Search failed: {exc}")
