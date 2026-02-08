import uuid
from datetime import datetime
from pydantic import BaseModel


class IndexResponse(BaseModel):
    id: uuid.UUID
    organization_id: uuid.UUID
    name: str
    external_id: str | None
    description: str | None
    config: dict | None
    is_active: bool
    synced_at: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class SourceResponse(BaseModel):
    id: uuid.UUID
    organization_id: uuid.UUID
    repository_id: uuid.UUID
    name: str
    total_count: int | None
    last_event_at: datetime | None
    first_event_at: datetime | None
    category: str | None
    description: str | None
    is_active: bool
    synced_at: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class SourceSyncResult(BaseModel):
    success: bool
    message: str
    sources_synced: int = 0


class ApplicationResponse(BaseModel):
    id: uuid.UUID
    organization_id: uuid.UUID
    name: str
    label: str | None
    version: str | None
    external_id: str | None
    is_active: bool
    synced_at: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class DashboardResponse(BaseModel):
    id: uuid.UUID
    organization_id: uuid.UUID
    name: str
    label: str | None
    description: str | None
    external_id: str | None
    is_active: bool
    synced_at: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ── Source search ──────────────────────────────────────────────────────

class SourceSearchRequest(BaseModel):
    search: str  # Space-separated terms will be split and searched
    repository_id: uuid.UUID | None = None  # Optional: filter to specific repo


class SourceSearchResult(BaseModel):
    id: uuid.UUID
    organization_id: uuid.UUID
    repository_id: uuid.UUID
    repository_name: str
    name: str
    total_count: int | None
    last_event_at: datetime | None
    first_event_at: datetime | None

    model_config = {"from_attributes": True}


class SourceSearchResponse(BaseModel):
    matches: list[SourceSearchResult]
