"""
SQLite settings store.
Simple key-value table — no ORM needed for settings of this size.
"""
from __future__ import annotations
import json
import os
import sqlite3
import sys
from pathlib import Path


def _db_path() -> Path:
    if getattr(sys, "frozen", False):
        # Running as a packaged PyInstaller binary — write to the user's AppData
        # so the file survives upgrades and doesn't touch the read-only install dir.
        local = os.environ.get("LOCALAPPDATA", str(Path.home() / "AppData" / "Local"))
        data_dir = Path(local) / "RaceVision"
        data_dir.mkdir(parents=True, exist_ok=True)
        return data_dir / "racevision.db"
    # Development — project root
    return Path(__file__).parent.parent.parent / "racevision.db"


DB_PATH = _db_path()

_CREATE_TABLE = """
CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
"""

_CREATE_TRACK_TABLE = """
CREATE TABLE IF NOT EXISTS track_paths (
    track_name TEXT PRIMARY KEY,
    path       TEXT NOT NULL
);
"""


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    with _connect() as conn:
        conn.execute(_CREATE_TABLE)
        conn.execute(_CREATE_TRACK_TABLE)
        conn.commit()


def get_track_path(track_name: str) -> list[list[float]] | None:
    with _connect() as conn:
        row = conn.execute(
            "SELECT path FROM track_paths WHERE track_name = ?", (track_name,)
        ).fetchone()
        if row is None:
            return None
        return json.loads(row["path"])


def save_track_path(track_name: str, path: list[list[float]]) -> None:
    with _connect() as conn:
        conn.execute(
            "INSERT INTO track_paths (track_name, path) VALUES (?, ?)"
            " ON CONFLICT(track_name) DO UPDATE SET path = excluded.path",
            (track_name, json.dumps(path)),
        )
        conn.commit()


def get_setting(key: str, default: object = None) -> object:
    with _connect() as conn:
        row = conn.execute("SELECT value FROM settings WHERE key = ?", (key,)).fetchone()
        if row is None:
            return default
        return json.loads(row["value"])


def set_setting(key: str, value: object) -> None:
    with _connect() as conn:
        conn.execute(
            "INSERT INTO settings (key, value) VALUES (?, ?)"
            " ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            (key, json.dumps(value)),
        )
        conn.commit()


def get_all_settings() -> dict[str, object]:
    with _connect() as conn:
        rows = conn.execute("SELECT key, value FROM settings").fetchall()
        return {row["key"]: json.loads(row["value"]) for row in rows}
