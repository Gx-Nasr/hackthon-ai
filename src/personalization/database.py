"""SQLite repository; connections are short-lived and never shared across threads."""

import json
import sqlite3
from contextlib import contextmanager
from datetime import UTC, datetime
from functools import lru_cache
from pathlib import Path
from typing import Iterator

from pydantic import ValidationError

from . import PROJECT_ROOT
from .models import Event, ImportSummary, RecommendationResponse, StudentProfile

DATABASE_PATH = PROJECT_ROOT / "data" / "uniradar.db"
STUDENT_JSON_FIELDS = (
    "interests", "skills", "goals", "preferred_event_types", "languages", "availability",
)
CACHE_TTL_SECONDS = {"gemma": 900, "fallback": 60}

SCHEMA = """
CREATE TABLE IF NOT EXISTS students (
    user_id TEXT PRIMARY KEY,
    campus TEXT,
    school TEXT,
    major TEXT,
    academic_year TEXT,
    interests TEXT NOT NULL,
    skills TEXT NOT NULL,
    goals TEXT NOT NULL,
    preferred_event_types TEXT NOT NULL,
    languages TEXT NOT NULL,
    willing_to_travel INTEGER CHECK (willing_to_travel IN (0, 1)),
    availability TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    event_type TEXT,
    topics TEXT NOT NULL,
    campus TEXT,
    location TEXT,
    start_datetime TEXT,
    end_datetime TEXT,
    registration_deadline TEXT,
    registration_url TEXT,
    source_id TEXT,
    source_url TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS recommendation_cache (
    id INTEGER PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE REFERENCES students(user_id) ON DELETE CASCADE,
    input_hash TEXT NOT NULL,
    recommendations_json TEXT NOT NULL,
    ranking_mode TEXT NOT NULL CHECK (ranking_mode IN ('gemma', 'fallback')),
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_events_campus ON events(campus);
CREATE INDEX IF NOT EXISTS idx_events_start ON events(start_datetime);
CREATE INDEX IF NOT EXISTS idx_events_source ON events(source_id);
"""


def _encode(model: StudentProfile | Event, json_fields: tuple[str, ...]) -> dict:
    data = model.model_dump(mode="json")
    for field in json_fields:
        data[field] = json.dumps(data[field], ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return data


def _decode(row: sqlite3.Row, model: type[StudentProfile] | type[Event], json_fields: tuple[str, ...]):
    data = {field: row[field] for field in model.model_fields}
    for field in json_fields:
        data[field] = json.loads(data[field])
    if "willing_to_travel" in data and data["willing_to_travel"] is not None:
        data["willing_to_travel"] = bool(data["willing_to_travel"])
    return model.model_validate(data)


def _upsert(connection: sqlite3.Connection, table: str, key: str, data: dict) -> str:
    # Identifiers come only from our models and repository code; all values are bound.
    row = connection.execute(f"SELECT * FROM {table} WHERE {key} = ?", (data[key],)).fetchone()
    if row is not None and all(row[field] == value for field, value in data.items()):
        return "unchanged"
    timestamp = datetime.now(UTC).isoformat()
    fields = [*data, "created_at", "updated_at"]
    updates = ", ".join(f"{field} = excluded.{field}" for field in fields if field not in (key, "created_at"))
    placeholders = ", ".join("?" for _ in fields)
    connection.execute(
        f"INSERT INTO {table} ({', '.join(fields)}) VALUES ({placeholders}) "
        f"ON CONFLICT({key}) DO UPDATE SET {updates}",
        (*data.values(), timestamp, timestamp),
    )
    return "inserted" if row is None else "updated"


class Database:
    def __init__(self, path: str | Path = DATABASE_PATH):
        self.path = Path(path)

    @contextmanager
    def connection(self) -> Iterator[sqlite3.Connection]:
        connection = sqlite3.connect(self.path, timeout=10)
        connection.row_factory = sqlite3.Row
        try:
            connection.execute("PRAGMA foreign_keys = ON")
            with connection:
                yield connection
        finally:
            connection.close()

    def initialize_database(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self.connection() as connection:
            connection.execute("PRAGMA journal_mode = WAL")
            connection.executescript(SCHEMA)

    def save_student(self, profile: StudentProfile) -> StudentProfile:
        return self._save_student(profile, require_existing=False)

    def update_student(self, profile: StudentProfile) -> StudentProfile:
        return self._save_student(profile, require_existing=True)

    def _save_student(self, profile: StudentProfile, require_existing: bool) -> StudentProfile:
        with self.connection() as connection:
            connection.execute("BEGIN IMMEDIATE")
            if require_existing and connection.execute(
                "SELECT 1 FROM students WHERE user_id = ?", (profile.user_id,),
            ).fetchone() is None:
                raise KeyError("Student not found")
            result = _upsert(connection, "students", "user_id", _encode(profile, STUDENT_JSON_FIELDS))
            if result != "unchanged":
                connection.execute("DELETE FROM recommendation_cache WHERE user_id = ?", (profile.user_id,))
        return profile

    def get_student(self, user_id: str) -> StudentProfile | None:
        with self.connection() as connection:
            row = connection.execute("SELECT * FROM students WHERE user_id = ?", (user_id,)).fetchone()
        return _decode(row, StudentProfile, STUDENT_JSON_FIELDS) if row else None

    def upsert_events(self, events: list[Event]) -> ImportSummary:
        summary = ImportSummary()
        with self.connection() as connection:
            connection.execute("BEGIN IMMEDIATE")
            for event in events:
                result = _upsert(connection, "events", "id", _encode(event, ("topics",)))
                setattr(summary, result, getattr(summary, result) + 1)
            if summary.inserted or summary.updated:
                connection.execute("DELETE FROM recommendation_cache")
        return summary

    def get_all_events(self) -> list[Event]:
        with self.connection() as connection:
            rows = connection.execute("SELECT * FROM events ORDER BY id").fetchall()
        return [_decode(row, Event, ("topics",)) for row in rows]

    def get_event_by_id(self, event_id: str) -> Event | None:
        with self.connection() as connection:
            row = connection.execute("SELECT * FROM events WHERE id = ?", (event_id,)).fetchone()
        return _decode(row, Event, ("topics",)) if row else None

    def get_cached_recommendations(
        self, user_id: str, input_hash: str, *, now: datetime | None = None,
    ) -> RecommendationResponse | None:
        with self.connection() as connection:
            row = connection.execute(
                "SELECT * FROM recommendation_cache WHERE user_id = ? AND input_hash = ?",
                (user_id, input_hash),
            ).fetchone()
        if row is None:
            return None
        now = now or datetime.now(UTC)
        try:
            age = (now - datetime.fromisoformat(row["created_at"])).total_seconds()
            if not 0 <= age < CACHE_TTL_SECONDS[row["ranking_mode"]]:
                return None
            result = RecommendationResponse.model_validate_json(row["recommendations_json"])
            if result.user_id == user_id and result.ranking_mode == row["ranking_mode"]:
                return result
        except (ValidationError, ValueError, TypeError, KeyError):
            pass
        return None

    def save_recommendation_cache(
        self, user_id: str, input_hash: str, response: RecommendationResponse,
        *, now: datetime | None = None,
    ) -> None:
        if response.user_id != user_id:
            raise ValueError("Cache response must belong to the student")
        with self.connection() as connection:
            connection.execute(
                """INSERT INTO recommendation_cache
                (user_id, input_hash, recommendations_json, ranking_mode, created_at)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(user_id) DO UPDATE SET
                    input_hash = excluded.input_hash,
                    recommendations_json = excluded.recommendations_json,
                    ranking_mode = excluded.ranking_mode,
                    created_at = excluded.created_at""",
                (user_id, input_hash, response.model_dump_json(), response.ranking_mode,
                 (now or datetime.now(UTC)).isoformat()),
            )


def initialize_database(path: str | Path = DATABASE_PATH) -> Database:
    database = Database(path)
    database.initialize_database()
    return database


@lru_cache(maxsize=1)
def get_database() -> Database:
    return initialize_database()
