import uuid
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.provider_connection import ProviderConnection
from app.schemas.connection import ConnectionCreate, ConnectionUpdate


async def create_connection(
    db: AsyncSession, org_id: uuid.UUID, data: ConnectionCreate
) -> ProviderConnection:
    conn = ProviderConnection(organization_id=org_id, **data.model_dump())
    db.add(conn)
    await db.commit()
    await db.refresh(conn)
    return conn


async def list_connections(db: AsyncSession, org_id: uuid.UUID) -> list[ProviderConnection]:
    result = await db.execute(
        select(ProviderConnection)
        .where(ProviderConnection.organization_id == org_id)
        .order_by(ProviderConnection.created_at.desc())
    )
    return list(result.scalars().all())


async def get_connection(db: AsyncSession, conn_id: uuid.UUID) -> ProviderConnection | None:
    return await db.get(ProviderConnection, conn_id)


async def update_connection(
    db: AsyncSession, conn_id: uuid.UUID, data: ConnectionUpdate
) -> ProviderConnection | None:
    conn = await db.get(ProviderConnection, conn_id)
    if conn is None:
        return None
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(conn, field, value)
    await db.commit()
    await db.refresh(conn)
    return conn


async def delete_connection(db: AsyncSession, conn_id: uuid.UUID) -> bool:
    conn = await db.get(ProviderConnection, conn_id)
    if conn is None:
        return False
    await db.delete(conn)
    await db.commit()
    return True
