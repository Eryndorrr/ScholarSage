"""add_role_to_users

Revision ID: c441ca59ef82
Revises: f8a1dc008c9d
Create Date: 2026-04-17 11:40:03.947309

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c441ca59ef82'
down_revision: Union[str, None] = 'f8a1dc008c9d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Idempotent: check if column exists
    conn = op.get_bind()
    insp = sa.inspect(conn)
    columns = [col['name'] for col in insp.get_columns('users')]

    if 'role' not in columns:
        op.add_column('users', sa.Column('role', sa.String(length=20), nullable=False, server_default='user'))
        op.create_index(op.f('ix_users_role'), 'users', ['role'], unique=False)
    else:
        indexes = [idx['name'] for idx in insp.get_indexes('users')]
        if 'ix_users_role' not in indexes:
            op.create_index(op.f('ix_users_role'), 'users', ['role'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_users_role'), table_name='users')
    op.drop_column('users', 'role')
