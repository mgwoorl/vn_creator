"""add is_active to users

Revision ID: 3bd1f5e45318
Revises: 
Create Date: 2026-05-20 21:31:22.301396

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '3bd1f5e45318'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """
    Добавляет поле is_active в таблицу users.
    Существующие пользователи получают значение True (активны).
    """
    op.add_column(
        'users',
        sa.Column(
            'is_active',
            sa.Boolean(),
            nullable=False,
            server_default=sa.text('true')
        )
    )


def downgrade() -> None:
    """Удаляет поле is_active из таблицы users."""
    op.drop_column('users', 'is_active')