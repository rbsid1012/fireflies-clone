"""FTS5 index over transcript segments, kept in sync by triggers

Revision ID: 0002
Revises: 0001
"""
from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # External-content FTS5: the index stores no copy of the text, it reads it
    # back from transcript_segments (rowid == segment id). `meeting_id` is
    # UNINDEXED so it is returned with hits for grouping but never tokenized.
    # porter+unicode61 gives stemming ("deploying" matches "deploy").
    op.execute(
        """
        CREATE VIRTUAL TABLE transcript_fts USING fts5(
            text,
            meeting_id UNINDEXED,
            content='transcript_segments',
            content_rowid='id',
            tokenize='porter unicode61'
        )
        """
    )
    op.execute(
        """
        CREATE TRIGGER transcript_segments_ai AFTER INSERT ON transcript_segments BEGIN
            INSERT INTO transcript_fts(rowid, text, meeting_id)
            VALUES (new.id, new.text, new.meeting_id);
        END
        """
    )
    # With external content, removal must replay the OLD values via the
    # special 'delete' command, otherwise the index drifts out of sync.
    # This also fires for rows removed by ON DELETE CASCADE from meetings.
    op.execute(
        """
        CREATE TRIGGER transcript_segments_ad AFTER DELETE ON transcript_segments BEGIN
            INSERT INTO transcript_fts(transcript_fts, rowid, text, meeting_id)
            VALUES ('delete', old.id, old.text, old.meeting_id);
        END
        """
    )
    op.execute(
        """
        CREATE TRIGGER transcript_segments_au AFTER UPDATE OF text, meeting_id
        ON transcript_segments BEGIN
            INSERT INTO transcript_fts(transcript_fts, rowid, text, meeting_id)
            VALUES ('delete', old.id, old.text, old.meeting_id);
            INSERT INTO transcript_fts(rowid, text, meeting_id)
            VALUES (new.id, new.text, new.meeting_id);
        END
        """
    )
    # Index any rows that already exist (no-op on a fresh database).
    op.execute("INSERT INTO transcript_fts(transcript_fts) VALUES ('rebuild')")


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS transcript_segments_au")
    op.execute("DROP TRIGGER IF EXISTS transcript_segments_ad")
    op.execute("DROP TRIGGER IF EXISTS transcript_segments_ai")
    op.execute("DROP TABLE IF EXISTS transcript_fts")
