import uuid
from datetime import datetime
from sqlalchemy import String, ForeignKey, DateTime
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, EntityBase


class ProviderConnection(EntityBase, Base):
    __tablename__ = "provider_connections"

    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    provider_type: Mapped[str] = mapped_column(String(50), nullable=False)  # splunk_cloud, opensearch, etc.
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    host_url: Mapped[str] = mapped_column(String(512), nullable=False)
    auth_type: Mapped[str] = mapped_column(String(50), nullable=False)  # cookie, token, api_key
    credentials: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    config: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    last_synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    organization = relationship("Organization", back_populates="connections")
    repositories = relationship("LogRepository", back_populates="connection", cascade="all, delete-orphan")
    sources = relationship("LogSource", back_populates="connection", cascade="all, delete-orphan")
    applications = relationship("Application", back_populates="connection", cascade="all, delete-orphan")
    saved_queries = relationship("SavedQuery", back_populates="connection", cascade="all, delete-orphan")
    dashboards = relationship("Dashboard", back_populates="connection", cascade="all, delete-orphan")
