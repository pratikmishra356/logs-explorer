import uuid
from datetime import datetime
from pydantic import BaseModel, Field


class OrganizationCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    slug: str = Field(..., min_length=1, max_length=255, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
    description: str | None = None
    used_indexes: list[str] | None = Field(default=None, description="List of important index names")


class OrganizationUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    is_active: bool | None = None
    used_indexes: list[str] | None = None


class OrganizationResponse(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    description: str | None
    is_active: bool
    used_indexes: list[str] | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class OrganizationSummary(OrganizationResponse):
    index_count: int = 0
    source_count: int = 0
    application_count: int = 0
    dashboard_count: int = 0
    provider_configured: bool = False


# ── Provider config ──────────────────────────────────────────────────

class ProviderConfigCreate(BaseModel):
    provider_type: str = "splunk_cloud"
    host_url: str = Field(..., min_length=1)
    auth_type: str = "cookie"
    credentials: dict  # {cookie, csrf_token}


class ProviderConfigResponse(BaseModel):
    provider_type: str
    host_url: str
    auth_type: str
    is_configured: bool = True
    last_synced_at: datetime | None = None

    model_config = {"from_attributes": True}


class ProviderTestResult(BaseModel):
    success: bool
    message: str
    details: dict | None = None


class SyncResult(BaseModel):
    success: bool
    message: str
    indexes_synced: int = 0
    applications_synced: int = 0
    dashboards_synced: int = 0
