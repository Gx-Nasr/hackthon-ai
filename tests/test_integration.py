"""Exercise real ingestion contracts, SQLite, retrieval, API and RFC 5545 output.

Only Google's paid/external extraction boundary is stubbed.
"""
import base64
import json
from io import BytesIO
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient
from icalendar import Calendar
from PIL import Image

from main import create_app
from src.application import CampusApplication
from src.extractor import normalize_announcement


@pytest.fixture
def integrated(database, monkeypatch):
    monkeypatch.setenv("PYTHON_DOTENV_DISABLED", "1")
    app = create_app(database)
    campus = CampusApplication(database)
    app.state.campus = campus
    event = {
        "id": "integrated_flyer", "title": "Quantum Robotics Workshop", "organizer": "Forgebots",
        "campus": "Ben Guerir", "venue": "Lab 42", "start_datetime": "2026-10-28T14:30:00+01:00",
        "end_datetime": "2026-10-28T15:30:00+01:00", "description": "Quantum robotics control workshop",
        "tags": ["robotics"], "registration_url": "https://example.org/register",
    }
    calls = []
    def generate(**kwargs):
        calls.append(kwargs)
        return SimpleNamespace(text=json.dumps(event))
    campus.extractor.client = SimpleNamespace(models=SimpleNamespace(generate_content=generate))
    with TestClient(app) as client:
        yield client, campus, calls


def test_flyer_to_persistence_search_conflict_and_calendar(integrated, database):
    client, campus, calls = integrated
    image = BytesIO()
    Image.new("RGB", (30, 30), "white").save(image, format="PNG")
    response = client.post("/api/announcements", files={"file": ("flyer.png", image.getvalue(), "image/png")})
    assert response.status_code == 200, response.text
    assert response.json()["announcement"]["source_type"] == "flyer"
    assert calls[0]["model"] in ("gemini-2.5-flash", "gemini-3-flash-preview")
    assert database.get_event_by_id("integrated_flyer").topics == ["robotics"]
    # A fresh application must recover the upload from SQLite.
    restored = CampusApplication(database)
    assert any(a.id == "integrated_flyer" for a in restored.announcements())
    feed = client.get("/api/events").json()["events"]
    event = next(e for e in feed if e["id"] == "integrated_flyer")
    assert event["statuses"] == ["conflict"]
    calendar = client.get(event["calendarUrl"])
    parsed = Calendar.from_ical(calendar.content)
    vevent = parsed.walk("VEVENT")[0]
    assert str(vevent["SUMMARY"]) == "Quantum Robotics Workshop"
    assert vevent.decoded("DTEND") > vevent.decoded("DTSTART")
    response = client.post("/api/chat", data={"message": "Quantum robotics workshop Ben Guerir"})
    assert response.status_code == 200, response.text
    assert any(s["url"] == event["calendarUrl"] for s in response.json()["sources"])
    assert campus.retriever.bm25_retriever is not None
    assert campus.retriever._model is not None  # Real dense + BM25, not fallback embeddings.
    negative = client.post("/api/chat", data={"message": "wach kayn chi workshop f marrakech?"}).json()
    assert negative["sources"] == []


def test_authenticated_profile_changes_badges(integrated):
    client, campus, _ = integrated
    profile = campus.profile.model_copy(update={"home_campus": "Ben Guerir", "busy_slots": [], "date_specific_commitments": []})
    headers = {"X-Student-Profile": base64.b64encode(profile.model_dump_json().encode()).decode()}
    feed = {e["id"]: e for e in client.get("/api/events", headers=headers).json()["events"]}
    assert feed["ann_004"]["statuses"] == ["relevant"]
    assert feed["ann_001"]["statuses"] == ["cross-campus"]


def test_email_pdf_and_invalid_input(integrated):
    client, campus, calls = integrated
    assert client.post("/api/announcements", data={"text": "Workshop email"}).status_code == 200
    assert client.post("/api/announcements", files={"file": ("poster.pdf", b"%PDF-test", "application/pdf")}).status_code == 200
    assert len(calls) == 2
    assert client.post("/api/announcements").status_code == 422
    assert client.post("/api/announcements", files={"file": ("bad.png", b"bad", "image/png")}).status_code == 422
    assert client.get("/api/events/missing/calendar").status_code == 404
    assert client.get("/api/events", headers={"X-Student-Profile": "invalid"}).status_code == 422


def test_legacy_email_contract_requires_real_time():
    event = normalize_announcement({"title": "Robotics", "date": "2026-10-28", "start_time": "23:00", "end_time": "01:00", "summary": "Build robots"})
    assert event.end_datetime.day == 29
    assert event.start_datetime.tzinfo is not None
    with pytest.raises(ValueError, match="date and start time"):
        normalize_announcement({"title": "Unknown date"})
