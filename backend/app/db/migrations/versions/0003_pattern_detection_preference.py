"""pattern detection preference

Adds `user_preferences.pattern_detection`, the per-user switch for showing
recurring themes in the user's saved questions (product spec §20). Existing
rows get `true`, the same as a user with no row at all.

Revision ID: 0003
Revises: 0002
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = '0003'
down_revision = '0002'
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table('user_preferences', schema=None) as batch_op:
        batch_op.add_column(
            sa.Column(
                'pattern_detection',
                sa.Boolean(),
                nullable=False,
                server_default=sa.true(),
            )
        )


def downgrade() -> None:
    with op.batch_alter_table('user_preferences', schema=None) as batch_op:
        batch_op.drop_column('pattern_detection')
