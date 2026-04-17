"""add_last_login_at_to_users

Revision ID: 43d4d5594050
Revises: c441ca59ef82
Create Date: 2026-04-17 12:44:15.714305

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '43d4d5594050'
down_revision: Union[str, None] = 'c441ca59ef82'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)
    columns = [col['name'] for col in insp.get_columns('users')]
    if 'last_login_at' not in columns:
        op.add_column('users', sa.Column('last_login_at', sa.DateTime(), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'last_login_at')
