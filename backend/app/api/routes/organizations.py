import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.schemas.organization import (
    OrganizationCreate,
    OrganizationUpdate,
    OrganizationResponse,
    OrganizationSummary,
)
from app.services import organization_service

router = APIRouter(prefix="/organizations", tags=["organizations"])


@router.post("", response_model=OrganizationResponse, status_code=201)
async def create_organization(data: OrganizationCreate, db: AsyncSession = Depends(get_db)):
    return await organization_service.create_organization(db, data)


@router.get("", response_model=list[OrganizationResponse])
async def list_organizations(db: AsyncSession = Depends(get_db)):
    return await organization_service.list_organizations(db)


@router.get("/{org_id}", response_model=OrganizationSummary)
async def get_organization(org_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    summary = await organization_service.get_organization_summary(db, org_id)
    if summary is None:
        raise HTTPException(status_code=404, detail="Organization not found")
    return summary


@router.patch("/{org_id}", response_model=OrganizationResponse)
async def update_organization(
    org_id: uuid.UUID,
    data: OrganizationUpdate,
    db: AsyncSession = Depends(get_db),
):
    org = await organization_service.update_organization(db, org_id, data)
    if org is None:
        raise HTTPException(status_code=404, detail="Organization not found")
    return org
