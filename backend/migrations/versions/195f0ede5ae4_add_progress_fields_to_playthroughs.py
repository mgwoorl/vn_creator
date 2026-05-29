"""add progress fields to playthroughs

Revision ID: 195f0ede5ae4
Revises: 3bd1f5e45318
Create Date: 2026-05-22 23:22:40.415416

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '195f0ede5ae4'
down_revision: Union[str, Sequence[str], None] = '3bd1f5e45318'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Добавляет поля для сохранения прогресса прохождения."""
    op.add_column('playthroughs', sa.Column('current_scene_index', sa.Integer(), nullable=True, server_default='0'))
    op.add_column('playthroughs', sa.Column('current_node_id', sa.String(), nullable=True))
    op.add_column('playthroughs', sa.Column('updated_at', sa.DateTime(), nullable=True))


def downgrade() -> None:
    """Удаляет поля прогресса."""
    op.drop_column('playthroughs', 'updated_at')
    op.drop_column('playthroughs', 'current_node_id')
    op.drop_column('playthroughs', 'current_scene_index')