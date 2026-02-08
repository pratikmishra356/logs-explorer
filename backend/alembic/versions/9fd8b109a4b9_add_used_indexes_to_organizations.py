"""add_used_indexes_to_organizations

Revision ID: 9fd8b109a4b9
Revises: 9170e1c10e2e
Create Date: 2026-02-08 16:23:13.407479

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9fd8b109a4b9'
down_revision: Union[str, None] = '9170e1c10e2e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('organizations', sa.Column('used_indexes', sa.ARRAY(sa.String(255)), nullable=True))


def downgrade() -> None:
    op.drop_column('organizations', 'used_indexes')
