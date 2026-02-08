import uuid
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.organization import Organization
from app.models.provider_connection import ProviderConnection
from app.models.log_repository import LogRepository
from app.models.log_source import LogSource
from app.models.application import Application
from app.models.dashboard import Dashboard
from app.schemas.organization import OrganizationCreate, OrganizationUpdate


async def create_organization(db: AsyncSession, data: OrganizationCreate) -> Organization:
    org = Organization(**data.model_dump())
    db.add(org)
    await db.commit()
    await db.refresh(org)
    return org


async def list_organizations(db: AsyncSession) -> list[Organization]:
    result = await db.execute(select(Organization).order_by(Organization.created_at.desc()))
    return list(result.scalars().all())


async def get_organization(db: AsyncSession, org_id: uuid.UUID) -> Organization | None:
    return await db.get(Organization, org_id)


async def get_organization_summary(db: AsyncSession, org_id: uuid.UUID) -> dict | None:
    org = await db.get(Organization, org_id)
    if org is None:
        return None

    counts = {}
    for label, model in [
        ("index_count", LogRepository),
        ("source_count", LogSource),
        ("application_count", Application),
        ("dashboard_count", Dashboard),
    ]:
        result = await db.execute(
            select(func.count()).select_from(model).where(model.organization_id == org_id)
        )
        counts[label] = result.scalar() or 0

    # Check if provider is configured
    conn = await get_org_connection(db, org_id, raise_if_missing=False)
    counts["provider_configured"] = conn is not None

    return {
        "id": org.id,
        "name": org.name,
        "slug": org.slug,
        "description": org.description,
        "is_active": org.is_active,
        "used_indexes": org.used_indexes or [],
        "created_at": org.created_at,
        "updated_at": org.updated_at,
        **counts,
    }


async def update_organization(
    db: AsyncSession, org_id: uuid.UUID, data: OrganizationUpdate
) -> Organization | None:
    org = await db.get(Organization, org_id)
    if org is None:
        return None
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(org, field, value)
    await db.commit()
    await db.refresh(org)
    return org


# ── Provider connection helper ───────────────────────────────────────

async def get_org_connection(
    db: AsyncSession,
    org_id: uuid.UUID,
    raise_if_missing: bool = True,
) -> ProviderConnection | None:
    """Look up the single provider connection for an org."""
    result = await db.execute(
        select(ProviderConnection)
        .where(ProviderConnection.organization_id == org_id)
        .order_by(ProviderConnection.created_at.desc())
        .limit(1)
    )
    conn = result.scalar_one_or_none()
    if conn is None and raise_if_missing:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Provider not configured for this organization")
    return conn


async def set_provider_config(
    db: AsyncSession,
    org_id: uuid.UUID,
    provider_type: str,
    host_url: str,
    auth_type: str,
    credentials: dict,
) -> ProviderConnection:
    """Create or update the single provider connection for an org."""
    conn = await get_org_connection(db, org_id, raise_if_missing=False)

    if conn is None:
        conn = ProviderConnection(
            organization_id=org_id,
            provider_type=provider_type,
            name=f"{provider_type} connection",
            host_url=host_url,
            auth_type=auth_type,
            credentials=credentials,
        )
        db.add(conn)
    else:
        conn.provider_type = provider_type
        conn.host_url = host_url
        conn.auth_type = auth_type
        conn.credentials = credentials

    await db.commit()
    await db.refresh(conn)
    return conn
