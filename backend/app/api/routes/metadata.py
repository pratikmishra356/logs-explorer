"""Org-level routes: provider config, indexes, sources, applications, dashboards."""

import re
import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.models.log_repository import LogRepository
from app.models.log_source import LogSource
from app.models.application import Application
from app.models.dashboard import Dashboard
from app.schemas.organization import (
    ProviderConfigCreate,
    ProviderConfigResponse,
    ProviderTestResult,
    SyncResult,
)
from app.schemas.metadata import (
    IndexResponse,
    SourceResponse,
    SourceSyncResult,
    ApplicationResponse,
    DashboardResponse,
    SourceSearchRequest,
    SourceSearchResponse,
    SourceSearchResult,
)
from app.services import organization_service, sync_service

router = APIRouter(prefix="/organizations/{org_id}", tags=["metadata"])


# ── Provider config ──────────────────────────────────────────────────

@router.put("/provider", response_model=ProviderConfigResponse)
async def set_provider(
    org_id: uuid.UUID, data: ProviderConfigCreate, db: AsyncSession = Depends(get_db)
):
    """Set or update the provider connection for this org."""
    org = await organization_service.get_organization(db, org_id)
    if org is None:
        raise HTTPException(status_code=404, detail="Organization not found")

    conn = await organization_service.set_provider_config(
        db, org_id,
        provider_type=data.provider_type,
        host_url=data.host_url,
        auth_type=data.auth_type,
        credentials=data.credentials,
    )
    return ProviderConfigResponse(
        provider_type=conn.provider_type,
        host_url=conn.host_url,
        auth_type=conn.auth_type,
        is_configured=True,
        last_synced_at=conn.last_synced_at,
    )


@router.get("/provider", response_model=ProviderConfigResponse)
async def get_provider(org_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Get provider config status (no credentials exposed)."""
    conn = await organization_service.get_org_connection(db, org_id, raise_if_missing=False)
    if conn is None:
        return ProviderConfigResponse(
            provider_type="",
            host_url="",
            auth_type="",
            is_configured=False,
            last_synced_at=None,
        )
    return ProviderConfigResponse(
        provider_type=conn.provider_type,
        host_url=conn.host_url,
        auth_type=conn.auth_type,
        is_configured=True,
        last_synced_at=conn.last_synced_at,
    )


@router.post("/provider/test", response_model=ProviderTestResult)
async def test_provider(org_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Test the provider connection."""
    conn = await organization_service.get_org_connection(db, org_id)
    return await sync_service.test_connection(db, conn.id)


@router.post("/provider/sync", response_model=SyncResult)
async def sync_provider(org_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Sync all metadata (indexes, apps, dashboards) from the provider."""
    conn = await organization_service.get_org_connection(db, org_id)
    return await sync_service.sync_all(db, conn.id)


# ── Indexes ──────────────────────────────────────────────────────────

@router.get("/indexes", response_model=list[IndexResponse])
async def list_indexes(org_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(LogRepository)
        .where(LogRepository.organization_id == org_id)
        .order_by(LogRepository.name)
    )
    return list(result.scalars().all())


# ── Sources ──────────────────────────────────────────────────────────

@router.get("/indexes/{index_id}/sources", response_model=list[SourceResponse])
async def list_sources_for_index(
    org_id: uuid.UUID, index_id: uuid.UUID, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(LogSource)
        .where(LogSource.organization_id == org_id, LogSource.repository_id == index_id)
        .order_by(LogSource.total_count.desc().nullslast(), LogSource.name)
    )
    return list(result.scalars().all())


@router.post("/indexes/{index_id}/sync-sources", response_model=SourceSyncResult)
async def sync_sources_for_index(
    org_id: uuid.UUID, index_id: uuid.UUID, db: AsyncSession = Depends(get_db)
):
    """Trigger source sync for a specific index."""
    repo = await db.get(LogRepository, index_id)
    if repo is None or repo.organization_id != org_id:
        raise HTTPException(status_code=404, detail="Index not found")
    return await sync_service.sync_repository_sources(db, index_id)


@router.get("/sources", response_model=list[SourceResponse])
async def list_all_sources(org_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """List all sources across all indexes for this org."""
    result = await db.execute(
        select(LogSource)
        .where(LogSource.organization_id == org_id)
        .order_by(LogSource.total_count.desc().nullslast(), LogSource.name)
    )
    return list(result.scalars().all())


@router.post("/sources/search", response_model=SourceSearchResponse)
async def search_sources(
    org_id: uuid.UUID,
    req: SourceSearchRequest,
    db: AsyncSession = Depends(get_db),
):
    """Search sources by regex matching.

    - Splits space-separated search string into multiple terms
    - Each term is searched as a case-insensitive regex pattern
    - Returns matches with repository name and id included
    - Optionally filter to a specific repository_id
    """
    # Build query
    query = select(LogSource, LogRepository.name.label("repository_name")).join(
        LogRepository, LogSource.repository_id == LogRepository.id
    ).where(LogSource.organization_id == org_id)

    if req.repository_id:
        query = query.where(LogSource.repository_id == req.repository_id)

    # Split search string and build regex conditions
    search_terms = [t.strip() for t in req.search.split() if t.strip()]
    if not search_terms:
        return SourceSearchResponse(matches=[])

    # Build OR conditions: source name matches any term (case-insensitive regex)
    conditions = []
    for term in search_terms:
        # Escape special regex chars except * which we treat as wildcard
        pattern = term.replace("*", ".*").replace("+", "\\+").replace("?", "\\?")
        conditions.append(LogSource.name.ilike(f"%{pattern}%"))

    query = query.where(or_(*conditions))
    query = query.order_by(LogSource.total_count.desc().nullslast(), LogSource.name)

    result = await db.execute(query)
    rows = result.all()

    matches = []
    for source, repo_name in rows:
        matches.append(SourceSearchResult(
            id=source.id,
            organization_id=source.organization_id,
            repository_id=source.repository_id,
            repository_name=repo_name,
            name=source.name,
            total_count=source.total_count,
            last_event_at=source.last_event_at,
            first_event_at=source.first_event_at,
        ))

    return SourceSearchResponse(matches=matches)


# ── Applications ─────────────────────────────────────────────────────

@router.get("/applications", response_model=list[ApplicationResponse])
async def list_applications(org_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Application)
        .where(Application.organization_id == org_id)
        .order_by(Application.name)
    )
    return list(result.scalars().all())


# ── Dashboards ───────────────────────────────────────────────────────

@router.get("/dashboards", response_model=list[DashboardResponse])
async def list_dashboards(org_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Dashboard)
        .where(Dashboard.organization_id == org_id)
        .order_by(Dashboard.name)
    )
    return list(result.scalars().all())
