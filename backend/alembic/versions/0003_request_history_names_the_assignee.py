"""request history names the assignee

Revision ID: 0003
Revises: 0002
Create Date: 2026-11-15 01:39:50.617669

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0003'
down_revision: Union[str, Sequence[str], None] = '0002'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('request_status_events', sa.Column('assignee_id', sa.Integer(), nullable=True))
    op.create_foreign_key(op.f('fk_request_status_events_assignee_id_users'), 'request_status_events', 'users', ['assignee_id'], ['id'])


def downgrade() -> None:
    op.drop_constraint(op.f('fk_request_status_events_assignee_id_users'), 'request_status_events', type_='foreignkey')
    op.drop_column('request_status_events', 'assignee_id')
