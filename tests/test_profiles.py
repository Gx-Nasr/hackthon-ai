import pytest


def test_profile_creation_retrieval_and_replacement(client, database, profile):
    body = profile.model_dump(mode="json")
    response = client.put("/api/profiles/student_001", json=body)
    assert response.status_code == 200
    assert response.json() == body
    assert client.get("/api/profiles/student_001").json() == body
    body["major"] = "Computer Science"
    body["interests"] = ["AI"]
    assert client.put("/api/profiles/student_001", json=body).status_code == 200
    assert database.get_student("student_001").major == "Computer Science"
    assert database.get_student("student_001").interests == ["AI"]


def test_minimal_profile_is_valid_but_availability_is_unknown(client):
    response = client.put("/api/profiles/minimal", json={})
    assert response.status_code == 200
    assert response.json()["user_id"] == "minimal"
    assert response.json()["campus"] is None
    assert response.json()["willing_to_travel"] is None
    assert response.json()["availability"]["is_complete"] is False


@pytest.mark.parametrize("body", [
    {"user_id": "different"},
    {"campus": "Online"},
    {"interests": "robotics"},
    {"interests": ["   "]},
    {"willing_to_travel": "maybe"},
    {"unrecognized_field": True},
    {"availability": {"timezone": "invalid/timezone"}},
    {"availability": {"weekly_busy": [{"weekday": 7, "start_time": "09:00", "end_time": "10:00"}]}},
    {"availability": {"weekly_busy": [{"weekday": 1, "start_time": "09:00", "end_time": "09:00"}]}},
    {"availability": {"date_specific_busy": [{"start_datetime": "2027-11-10T10:00Z", "end_datetime": "2027-11-10T09:00Z"}]}},
])
def test_invalid_profiles_do_not_get_saved(client, database, body):
    assert client.put("/api/profiles/student_001", json=body).status_code == 422
    assert database.get_student("student_001") is None


def test_missing_profiles_return_404(client):
    assert client.get("/api/profiles/missing").status_code == 404
    assert client.get("/api/recommendations/missing").status_code == 404


def test_health_has_no_private_configuration(client):
    assert client.get("/api/health").json() == {"status": "ok", "service": "uniradar-personalization"}
