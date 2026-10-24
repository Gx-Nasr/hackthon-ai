import json
from zoneinfo import ZoneInfo

import pytest

from src.personalization import PROJECT_ROOT
from src.personalization.event_importer import EventImportError, import_events, main


@pytest.mark.parametrize("wrapped", [True, False])
def test_import_reimport_and_stable_id_update(database, tmp_path, event_factory, wrapped):
    path = tmp_path / "events.json"
    record = event_factory().model_dump(mode="json")

    def write():
        path.write_text(json.dumps({"events": [record]} if wrapped else [record]), encoding="utf-8")

    write()
    assert import_events(database, path).inserted == 1
    summary = import_events(database, path)
    assert (summary.inserted, summary.updated, summary.unchanged, summary.failed) == (0, 0, 1, 0)
    record["title"] = "Updated Robotics Hackathon"
    write()
    assert import_events(database, path).updated == 1
    assert len(database.get_all_events()) == 1
    assert database.get_event_by_id(record["id"]).title == record["title"]


def test_adapter_preserves_source_and_reports_bad_records(database, tmp_path):
    path = tmp_path / "events.json"
    path.write_text(json.dumps([
        {"event_id": "gmail:123:event:1", "name": "Workshop", "type": "workshop", "tags": "Python, robotics",
         "campus_name": "Benguérir", "start": "2027-11-13T09:00:00", "email_id": "123",
         "email_url": "https://example.org/messages/123"},
        {"id": "bad", "title": "", "registration_url": "javascript:secret-source-content"},
        {"id": "bad-time", "title": "Talk", "start_datetime": "2027-11-13"},
        {"id": "bad-campus", "title": "Talk", "campus": "not-a-campus"},
        {"title": "No stable ID"},
        "not an object",
    ]), encoding="utf-8")
    result = import_events(database, path)
    assert (result.inserted, result.failed) == (1, 5)
    assert [warning.record_index for warning in result.warnings] == [1, 2, 3, 4, 5]
    assert "secret-source-content" not in result.model_dump_json()
    event = database.get_event_by_id("gmail:123:event:1")
    assert event.campus == "Ben Guerir"
    assert event.topics == ["Python", "robotics"]
    assert event.start_datetime.astimezone(ZoneInfo("Africa/Casablanca")).isoformat().startswith("2027-11-13T09:00:00")
    assert event.source_id == "123"
    assert str(event.source_url) == "https://example.org/messages/123"
    assert event.end_datetime is event.location is event.registration_url is None


def test_duplicate_ids_within_file_reported(database, tmp_path, event_factory):
    path = tmp_path / "events.json"
    record = event_factory().model_dump(mode="json")
    path.write_text(json.dumps([record, {**record, "title": "Duplicate"}]), encoding="utf-8")
    summary = import_events(database, path)
    assert (summary.inserted, summary.failed) == (1, 1)
    assert database.get_event_by_id(record["id"]).title == record["title"]


@pytest.mark.parametrize("content", ["{broken", '{"events": {}}', "null", '"text"'])
def test_bad_files_fail_cleanly_without_changing_database(database, tmp_path, content):
    path = tmp_path / "events.json"
    path.write_text(content, encoding="utf-8")
    with pytest.raises(EventImportError):
        import_events(database, path)
    assert database.get_all_events() == []


def test_sync_api_reads_only_configured_file(client, database, tmp_path, monkeypatch, event_factory):
    path = tmp_path / "events.json"
    path.write_text(json.dumps([event_factory().model_dump(mode="json")]), encoding="utf-8")
    monkeypatch.setenv("EVENTS_JSON_PATH", str(path))
    response = client.post("/api/personalization/events/sync?path=/etc/passwd", json={"path": "/etc/passwd"})
    assert response.status_code == 200
    assert response.json()["inserted"] == 1
    path.unlink()
    response = client.post("/api/personalization/events/sync")
    assert response.status_code == 400
    assert str(tmp_path) not in response.text
    assert len(database.get_all_events()) == 1


def test_fictional_samples_and_cli(database, monkeypatch, capsys):
    monkeypatch.setenv("EVENTS_JSON_PATH", str(PROJECT_ROOT / "data/events.json"))
    monkeypatch.setattr("src.personalization.event_importer.get_database", lambda: database)
    main()
    assert json.loads(capsys.readouterr().out)["inserted"] == 10
    assert all("Fictional" in event.title for event in database.get_all_events())
