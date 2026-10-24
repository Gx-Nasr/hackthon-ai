import json
import sqlite3

import pytest

from src.personalization.models import Event, RecommendationResponse, StudentProfile


def test_profile_round_trip_preserves_json_fields(database, profile):
    profile.goals = ["internships", "research"]
    profile.languages = ["English", "العربية"]
    database.save_student(profile)
    assert database.get_student(profile.user_id) == profile
    with database.connection() as connection:
        row = connection.execute("SELECT * FROM students").fetchone()
        assert json.loads(row["interests"]) == ["robotics"]
        assert json.loads(row["availability"])["is_complete"] is True
        assert row["willing_to_travel"] == 1
        assert row["created_at"] == row["updated_at"]
        assert connection.execute("PRAGMA foreign_keys").fetchone()[0] == 1
        assert connection.execute("PRAGMA journal_mode").fetchone()[0] == "wal"


def test_updating_profile_keeps_one_row_and_creation_timestamp(database, profile):
    database.save_student(profile)
    with database.connection() as connection:
        created_at = connection.execute("SELECT created_at FROM students").fetchone()[0]
    profile.interests = ["cybersecurity"]
    database.update_student(profile)
    assert database.get_student(profile.user_id).interests == ["cybersecurity"]
    with database.connection() as connection:
        rows = connection.execute("SELECT * FROM students").fetchall()
        assert len(rows) == 1
        assert rows[0]["created_at"] == created_at
    with pytest.raises(KeyError):
        database.update_student(StudentProfile(user_id="missing"))


def test_parameterized_identifiers_and_missing_records(database, event_factory):
    malicious_id = "x'; DROP TABLE students; --"
    profile = StudentProfile(user_id=malicious_id)
    event = event_factory(id=malicious_id)
    database.save_student(profile)
    database.upsert_events([event])
    assert database.get_student(malicious_id) == profile
    assert database.get_event_by_id(malicious_id) == event
    assert database.get_student("missing") is None
    assert database.get_event_by_id("missing") is None


def test_event_upserts_and_list_storage(database, event_factory):
    event = event_factory()
    assert database.upsert_events([event]).inserted == 1
    assert database.upsert_events([event]).unchanged == 1
    event.description = "Updated source content"
    assert database.upsert_events([event]).updated == 1
    assert database.get_all_events() == [event]
    with database.connection() as connection:
        assert json.loads(connection.execute("SELECT topics FROM events").fetchone()[0]) == event.topics


def test_multi_row_import_rolls_back_on_database_failure(database, event_factory):
    invalid = Event.model_construct(id="invalid", title=None)
    with pytest.raises(sqlite3.IntegrityError):
        database.upsert_events([event_factory(), invalid])
    assert database.get_all_events() == []


def test_cache_foreign_key_and_cascade(database, profile, now):
    response = RecommendationResponse(user_id=profile.user_id, total_events=0, ranking_mode="fallback", recommendations=[])
    with pytest.raises(sqlite3.IntegrityError):
        database.save_recommendation_cache(profile.user_id, "hash", response, now=now)
    database.save_student(profile)
    database.save_recommendation_cache(profile.user_id, "hash", response, now=now)
    assert database.get_cached_recommendations(profile.user_id, "hash", now=now) == response
    assert database.get_cached_recommendations(profile.user_id, "different", now=now) is None
    with database.connection() as connection:
        connection.execute("DELETE FROM students WHERE user_id = ?", (profile.user_id,))
        assert connection.execute("SELECT count(*) FROM recommendation_cache").fetchone()[0] == 0


def test_corrupt_cache_is_ignored(database, profile, now):
    database.save_student(profile)
    with database.connection() as connection:
        connection.execute(
            "INSERT INTO recommendation_cache (user_id, input_hash, recommendations_json, ranking_mode, created_at) VALUES (?, ?, ?, ?, ?)",
            (profile.user_id, "hash", "not JSON", "fallback", now.isoformat()),
        )
    assert database.get_cached_recommendations(profile.user_id, "hash", now=now) is None
