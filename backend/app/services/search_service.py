import uuid
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.provider_connection import ProviderConnection
from app.providers.registry import get_provider
from app.schemas.search import SearchRequest


async def execute_search(db: AsyncSession, conn_id: uuid.UUID, req: SearchRequest) -> dict:
    conn = await db.get(ProviderConnection, conn_id)
    if conn is None:
        return {
            "success": False,
            "query": req.query,
            "result_count": 0,
            "results": [],
            "message": "Connection not found",
        }

    provider = get_provider(
        provider_type=conn.provider_type,
        connection_config={
            "host_url": conn.host_url,
            "auth_type": conn.auth_type,
            "credentials": conn.credentials,
            "config": conn.config,
        },
    )

    return await provider.execute_search(
        query=req.query,
        time_range=req.time_range,
        repositories=req.repositories,
        max_results=req.max_results,
    )
