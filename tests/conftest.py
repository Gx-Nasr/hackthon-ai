from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient

from main import create_app
from src.personalization.database import initialize_database
from src.personalization.models import Event, StudentProfile


@pytest.fixture(autouse=True)
def offline_environment(monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.delenv("GEMMA_MODEL", raising=False)
    monkeypatch.delenv("EVENTS_JSON_PATH", raising=False)


@pytest.fixture
def database(tmp_path):
    return initialize_database(tmp_path / "test.db")


@pytest.fixture
def client(database):
    with TestClient(create_app(database)) as client:
        yield client


@pytest.fixture
def now():
    return datetime(2027, 11, 12, 8, tzinfo=UTC)


@pytest.fixture
def profile():
    return StudentProfile(
        user_id="student_001", campus="Rabat", interests=["robotics"], skills=["Python"],
        preferred_event_types=["hackathon"], willing_to_travel=True,
        availability={"is_complete": True},
    )


@pytest.fixture
def event_factory():
    def make_event(**updates):
        return Event.model_validate({
            "id": "event_001", "title": "Robotics Hackathon", "description": "Build robots with Python.",
            "event_type": "hackathon", "topics": ["robotics", "Python"], "campus": "Rabat",
            "start_datetime": "2027-11-13T09:00:00+01:00",
            "end_datetime": "2027-11-13T18:00:00+01:00",
            **updates,
        })
    return make_event
