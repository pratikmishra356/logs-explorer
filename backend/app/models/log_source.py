import uuid
from datetime import datetime
from sqlalchemy import String, Text, ForeignKey, DateTime, BigInteger, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, EntityBase


class LogSource(EntityBase, Base):
    """Log source synced per-index from the provider.

    In Splunk: source field values discovered via ``| metadata type=sources index=...``.
    Unique per (organization_id, repository_id, name).
    """

    __tablename__ = "log_sources"
    __table_args__ = (
        UniqueConstraint("organization_id", "repository_id", "name", name="uq_source_per_repo"),
    )

    connection_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("provider_connections.id", ondelete="CASCADE"), nullable=False
    )
    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    repository_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("log_repositories.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(512), nullable=False)                  # full source value from provider
    total_count: Mapped[int | None] = mapped_column(BigInteger, nullable=True)       # totalCount from metadata
    last_event_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)  # lastTime
    first_event_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)  # firstTime
    category: Mapped[str | None] = mapped_column(String(255), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    config: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    connection = relationship("ProviderConnection", back_populates="sources")
    organization = relationship("Organization", back_populates="sources")
    repository = relationship("LogRepository", back_populates="sources")
