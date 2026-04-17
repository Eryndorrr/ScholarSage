"""add_user_id_to_collections

Revision ID: f8a1dc008c9d
Revises: cb869cf7e573
Create Date: 2026-04-16 19:39:28.674155

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f8a1dc008c9d'
down_revision: Union[str, None] = 'cb869cf7e573'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Idempotent: check if column already exists (create_all fallback)
    conn = op.get_bind()
    insp = sa.inspect(conn)
    columns = [col['name'] for col in insp.get_columns('collections')]

    if 'user_id' not in columns:
        op.add_column('collections', sa.Column('user_id', sa.String(), nullable=True))
        op.create_index(op.f('ix_collections_user_id'), 'collections', ['user_id'], unique=False)
        op.create_foreign_key(None, 'collections', 'users', ['user_id'], ['id'])
    else:
        # Ensure index exists
        indexes = [idx['name'] for idx in insp.get_indexes('collections')]
        if 'ix_collections_user_id' not in indexes:
            op.create_index(op.f('ix_collections_user_id'), 'collections', ['user_id'], unique=False)


def downgrade() -> None:
    op.drop_constraint(None, 'collections', type_='foreignkey')
    op.drop_index(op.f('ix_collections_user_id'), table_name='collections')
    op.drop_column('collections', 'user_id')
