"""Sync metadata from a provider connection into the database.

Sources are synced per-repository (index) using provider metadata queries.
"""

import uuid
from datetime import datetime, timezone
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.provider_connection import ProviderConnection
from app.models.log_repository import LogRepository
from app.models.log_source import LogSource
from app.models.application import Application
from app.models.dashboard import Dashboard
from app.providers.registry import get_provider


async def _build_provider(conn: ProviderConnection):
    return get_provider(
        provider_type=conn.provider_type,
        connection_config={
            "host_url": conn.host_url,
            "auth_type": conn.auth_type,
            "credentials": conn.credentials,
            "config": conn.config,
        },
    )


async def test_connection(db: AsyncSession, conn_id: uuid.UUID) -> dict:
    conn = await db.get(ProviderConnection, conn_id)
    if conn is None:
        return {"success": False, "message": "Connection not found", "details": None}

    provider = await _build_provider(conn)
    return await provider.test_connection()


async def sync_all(db: AsyncSession, conn_id: uuid.UUID) -> dict:
    """Run a full sync for a connection: repos, apps, dashboards."""
    conn = await db.get(ProviderConnection, conn_id)
    if conn is None:
        return {"success": False, "message": "Connection not found"}

    provider = await _build_provider(conn)
    org_id = conn.organization_id
    now = datetime.now(timezone.utc)

    results = {
        "indexes_synced": 0,
        "applications_synced": 0,
        "dashboards_synced": 0,
    }

    errors = []

    try:
        # --- Repositories (indexes) ---
        try:
            repo_data = await provider.sync_repositories()
            await db.execute(delete(LogRepository).where(LogRepository.connection_id == conn_id))
            for item in repo_data:
                db.add(LogRepository(connection_id=conn_id, organization_id=org_id, **item))
            results["indexes_synced"] = len(repo_data)
        except Exception as exc:
            errors.append(f"Repositories: {exc}")

        # NOTE: Sources are synced per-repository via sync_repository_sources()

        # --- Applications (apps) ---
        try:
            app_data = await provider.sync_applications()
            await db.execute(delete(Application).where(Application.connection_id == conn_id))
            app_name_to_id: dict[str, uuid.UUID] = {}
            for item in app_data:
                app_obj = Application(connection_id=conn_id, organization_id=org_id, **item)
                db.add(app_obj)
                await db.flush()
                app_name_to_id[item["name"]] = app_obj.id
            results["applications_synced"] = len(app_data)
        except Exception as exc:
            errors.append(f"Applications: {exc}")
            app_name_to_id = {}

        # --- Dashboards ---
        try:
            dash_data = await provider.sync_dashboards()
            await db.execute(delete(Dashboard).where(Dashboard.connection_id == conn_id))
            for item in dash_data:
                app_name = item.pop("_app_name", None)
                app_id = app_name_to_id.get(app_name) if app_name else None
                db.add(Dashboard(
                    connection_id=conn_id,
                    organization_id=org_id,
                    application_id=app_id,
                    **item,
                ))
            results["dashboards_synced"] = len(dash_data)
        except Exception as exc:
            errors.append(f"Dashboards: {exc}")

        # Update last_synced_at
        conn.last_synced_at = now
        await db.commit()

        if errors:
            return {
                "success": True,
                "message": f"Sync completed with {len(errors)} error(s): {', '.join(errors)}",
                **results,
            }
        return {"success": True, "message": "Sync completed", **results}

    except Exception as exc:
        await db.rollback()
        return {"success": False, "message": f"Sync failed: {exc}", **results}


async def sync_repository_sources(
    db: AsyncSession, repo_id: uuid.UUID
) -> dict:
    """Sync sources for a single repository (index).

    Calls ``provider.sync_sources_for_repository(index_name)`` and upserts
    into log_sources with uniqueness on (org_id, repo_id, name).
    
    Note: This can take several minutes for large indexes.
    """
    import logging
    logger = logging.getLogger(__name__)
    
    repo = await db.get(LogRepository, repo_id)
    if repo is None:
        return {"success": False, "message": "Repository not found", "sources_synced": 0}

    conn = await db.get(ProviderConnection, repo.connection_id)
    if conn is None:
        return {"success": False, "message": "Connection not found", "sources_synced": 0}

    provider = await _build_provider(conn)

    try:
        import time
        sync_start = time.time()
        logger.info(f"Syncing sources for repository '{repo.name}' (ID: {repo_id})")
        source_data = await provider.sync_sources_for_repository(repo.name, time_range="-1h")
        query_time = time.time() - sync_start
        logger.info(f"Fetched {len(source_data)} sources in {query_time:.2f}s, now persisting to database...")

        # Delete existing sources for this repo and re-insert (full refresh per repo)
        await db.execute(
            delete(LogSource).where(
                LogSource.repository_id == repo_id,
            )
        )

        for item in source_data:
            db.add(LogSource(
                connection_id=conn.id,
                organization_id=repo.organization_id,
                repository_id=repo_id,
                **item,
            ))

        await db.commit()
        total_time = time.time() - sync_start
        logger.info(f"Completed source sync for '{repo.name}': {len(source_data)} sources in {total_time:.2f}s total")
        return {
            "success": True,
            "message": f"Synced {len(source_data)} sources for index '{repo.name}' in {total_time:.2f}s",
            "sources_synced": len(source_data),
        }
    except Exception as exc:
        await db.rollback()
        return {"success": False, "message": f"Source sync failed: {exc}", "sources_synced": 0}
