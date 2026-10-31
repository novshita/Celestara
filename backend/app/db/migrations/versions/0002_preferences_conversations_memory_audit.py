"""preferences, conversations, memory, AI audit

Adds the tables behind user preferences (explanation depth, saved calculation
configuration), saved conversations, user-approved memory, and the AI audit
record. Nothing here changes an existing table.

Revision ID: 0002
Revises: 0001
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = '0002'
down_revision = '0001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table('ai_audit_records',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=True),
    sa.Column('request_id', sa.String(), nullable=False),
    sa.Column('endpoint', sa.String(), nullable=False),
    sa.Column('intent', sa.String(), nullable=True),
    sa.Column('system', sa.String(), nullable=True),
    sa.Column('model', sa.String(), nullable=True),
    sa.Column('depth', sa.String(), nullable=False),
    sa.Column('factor_kinds', sa.String(), nullable=False),
    sa.Column('knowledge_ids', sa.String(), nullable=False),
    sa.Column('safety_flags', sa.String(), nullable=False),
    sa.Column('memory_count', sa.Integer(), nullable=False),
    sa.Column('history_turns', sa.Integer(), nullable=False),
    sa.Column('latency_ms', sa.Integer(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('ai_audit_records', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_ai_audit_records_user_id'), ['user_id'], unique=False)

    op.create_table('conversations',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('title', sa.String(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('conversations', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_conversations_user_id'), ['user_id'], unique=False)

    op.create_table('memories',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('kind', sa.String(), nullable=False),
    sa.Column('content', sa.Text(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('memories', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_memories_user_id'), ['user_id'], unique=False)

    op.create_table('user_preferences',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('explanation_depth', sa.String(), nullable=False),
    sa.Column('calculation_config', sa.Text(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('user_id')
    )
    op.create_table('conversation_messages',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('conversation_id', sa.Integer(), nullable=False),
    sa.Column('role', sa.String(), nullable=False),
    sa.Column('content', sa.Text(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    sa.ForeignKeyConstraint(['conversation_id'], ['conversations.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('conversation_messages', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_conversation_messages_conversation_id'), ['conversation_id'], unique=False)



def downgrade() -> None:
    with op.batch_alter_table('conversation_messages', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_conversation_messages_conversation_id'))

    op.drop_table('conversation_messages')
    op.drop_table('user_preferences')
    with op.batch_alter_table('memories', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_memories_user_id'))

    op.drop_table('memories')
    with op.batch_alter_table('conversations', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_conversations_user_id'))

    op.drop_table('conversations')
    with op.batch_alter_table('ai_audit_records', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_ai_audit_records_user_id'))

    op.drop_table('ai_audit_records')
