"""add_repository_id_to_sources

Revision ID: 9170e1c10e2e
Revises: df12cb50878e
Create Date: 2026-02-08 01:24:08.250605

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '9170e1c10e2e'
down_revision: Union[str, None] = 'df12cb50878e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Clear old source rows — they have no repository_id
    op.execute("DELETE FROM log_sources")

    # Drop columns that no longer exist in the model (only if they exist in DB)
    op.execute("""
        DO $$ BEGIN
            ALTER TABLE log_sources DROP COLUMN IF EXISTS external_id;
            ALTER TABLE log_sources DROP COLUMN IF EXISTS source_pattern;
        END $$;
    """)

    # Add new columns
    op.add_column('log_sources', sa.Column('repository_id', sa.UUID(), nullable=False))
    op.add_column('log_sources', sa.Column('total_count', sa.BigInteger(), nullable=True))
    op.add_column('log_sources', sa.Column('last_event_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('log_sources', sa.Column('first_event_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('log_sources', sa.Column('description', sa.Text(), nullable=True))

    # Widen name column
    op.alter_column('log_sources', 'name',
               existing_type=sa.VARCHAR(length=255),
               type_=sa.String(length=512),
               existing_nullable=False)

    # Add constraints
    op.create_unique_constraint('uq_source_per_repo', 'log_sources', ['organization_id', 'repository_id', 'name'])
    op.create_foreign_key('fk_source_repository', 'log_sources', 'log_repositories', ['repository_id'], ['id'], ondelete='CASCADE')


def downgrade() -> None:
    op.drop_constraint('fk_source_repository', 'log_sources', type_='foreignkey')
    op.drop_constraint('uq_source_per_repo', 'log_sources', type_='unique')
    op.alter_column('log_sources', 'name',
               existing_type=sa.String(length=512),
               type_=sa.VARCHAR(length=255),
               existing_nullable=False)
    op.drop_column('log_sources', 'description')
    op.drop_column('log_sources', 'first_event_at')
    op.drop_column('log_sources', 'last_event_at')
    op.drop_column('log_sources', 'total_count')
    op.drop_column('log_sources', 'repository_id')
    op.add_column('log_sources', sa.Column('external_id', sa.VARCHAR(length=512), nullable=True))
