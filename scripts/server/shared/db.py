from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from typing import Iterator

from server.shared import runtime


@contextmanager
def get_db_connection(*, row_factory: bool = False) -> Iterator[sqlite3.Connection]:
    conn = sqlite3.connect(runtime.AUTH_DB_PATH, timeout=5)
    try:
        conn.execute("PRAGMA foreign_keys = ON")
        conn.execute("PRAGMA journal_mode = WAL")
        conn.execute("PRAGMA synchronous = NORMAL")
        conn.execute("PRAGMA busy_timeout = 5000")
        if row_factory:
            conn.row_factory = sqlite3.Row
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
