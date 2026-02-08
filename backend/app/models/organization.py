from sqlalchemy import String, Text, ARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, EntityBase


class Organization(EntityBase, Base):
    __tablename__ = "organizations"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    used_indexes: Mapped[list[str] | None] = mapped_column(ARRAY(String(255)), nullable=True, default=list)

    # Relationships
    connections = relationship("ProviderConnection", back_populates="organization", cascade="all, delete-orphan")
    repositories = relationship("LogRepository", back_populates="organization", cascade="all, delete-orphan")
    sources = relationship("LogSource", back_populates="organization", cascade="all, delete-orphan")
    applications = relationship("Application", back_populates="organization", cascade="all, delete-orphan")
    saved_queries = relationship("SavedQuery", back_populates="organization", cascade="all, delete-orphan")
    dashboards = relationship("Dashboard", back_populates="organization", cascade="all, delete-orphan")
