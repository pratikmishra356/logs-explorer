import uuid
from datetime import datetime
from pydantic import BaseModel, Field


class ConnectionCreate(BaseModel):
    provider_type: str = Field(..., description="e.g. splunk_cloud, opensearch")
    name: str = Field(..., min_length=1, max_length=255)
    host_url: str = Field(..., min_length=1)
    auth_type: str = Field(..., description="cookie, token, api_key")
    credentials: dict | None = None
    config: dict | None = None


class ConnectionUpdate(BaseModel):
    name: str | None = None
    host_url: str | None = None
    auth_type: str | None = None
    credentials: dict | None = None
    config: dict | None = None
    is_active: bool | None = None


class ConnectionResponse(BaseModel):
    id: uuid.UUID
    organization_id: uuid.UUID
    provider_type: str
    name: str
    host_url: str
    auth_type: str
    config: dict | None
    is_active: bool
    last_synced_at: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ConnectionTestResult(BaseModel):
    success: bool
    message: str
    details: dict | None = None


class SyncResult(BaseModel):
    success: bool
    message: str
    repositories_synced: int = 0
    applications_synced: int = 0
    saved_queries_synced: int = 0
    dashboards_synced: int = 0
