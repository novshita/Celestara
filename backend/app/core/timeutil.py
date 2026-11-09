"""Timezone handling for stored timestamps.

Timestamps are always UTC and always written timezone-aware. What comes back
depends on the database: Postgres returns aware values, SQLite does not
persist `tzinfo` and returns naive ones (which are UTC, because UTC is all that
was written). `as_utc` makes both the same, so a stored time can be compared
with `utc_now()` on either.

Writing a naive value to a Postgres `timestamptz` column is not safe either:
the server reads it in *its* timezone, so a UTC wall-clock time is shifted by
the server's offset. That is why writes use `utc_now()` and never a stripped
copy of it.
"""

from __future__ import annotations

from datetime import datetime, timezone


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def as_utc(moment: datetime) -> datetime:
    """`moment` as an aware UTC datetime; a naive one is taken to be UTC."""
    if moment.tzinfo is None:
        return moment.replace(tzinfo=timezone.utc)
    return moment.astimezone(timezone.utc)
