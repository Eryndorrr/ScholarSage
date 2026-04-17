"""add_users_table

Revision ID: cb869cf7e573
Revises: bf1a5ab78157
Create Date: 2026-04-16 17:49:38.891015

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'cb869cf7e573'
down_revision: Union[str, None] = 'bf1a5ab78157'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Idempotent: only create users table if it doesn't exist
    conn = op.get_bind()
    result = conn.execute(sa.text(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='users'"
    ))
    if result.fetchone() is None:
        op.create_table('users',
            sa.Column('id', sa.String(), nullable=False),
            sa.Column('username', sa.String(length=50), nullable=False),
            sa.Column('email', sa.String(length=255), nullable=False),
            sa.Column('hashed_password', sa.String(length=255), nullable=False),
            sa.Column('is_active', sa.Boolean(), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=True),
            sa.PrimaryKeyConstraint('id'),
        )
        op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=True)
        op.create_index(op.f('ix_users_username'), 'users', ['username'], unique=True)
    else:
        # Ensure indexes exist even if table was created by create_all
        insp = sa.inspect(conn)
        existing_indexes = [idx['name'] for idx in insp.get_indexes('users')]
        if 'ix_users_email' not in existing_indexes:
            op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=True)
        if 'ix_users_username' not in existing_indexes:
            op.create_index(op.f('ix_users_username'), 'users', ['username'], unique=True)


def downgrade() -> None:
    op.drop_index(op.f('ix_users_username'), table_name='users')
    op.drop_index(op.f('ix_users_email'), table_name='users')
    op.drop_table('users')
