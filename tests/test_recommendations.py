import json
from datetime import timedelta
from types import SimpleNamespace
from unittest.mock import Mock

import httpx
import pytest
from google.genai import errors

from src.personalization.ai_ranker import BATCH_SIZE, GemmaRanker, fallback_assessments
from src.personalization.models import AssessmentBatch, StudentProfile
from src.personalization.recommender import Recommender
from src.personalization.scoring import SCORING_CONFIG


@pytest.fixture
def sdk(monkeypatch):
    client = Mock()
    client.models.get.return_value = SimpleNamespace(supported_actions=["generateContent"])
    context = Mock()
    context.__enter__ = Mock(return_value=client)
    context.__exit__ = Mock(return_value=False)
    constructor = Mock(return_value=context)
    monkeypatch.setattr("src.personalization.ai_ranker.genai.Client", constructor)

    def generate(**kwargs):
        payload = json.loads(kwargs["contents"])
        return SimpleNamespace(text=json.dumps({"assessments": [
            {"event_id": event["id"], "relevance_score": 4.8, "reason": "Fits your robotics interest.", "matched_interests": ["robotics"]}
            for event in payload["events"]
        ]}))

    client.models.generate_content.side_effect = generate
    return client, constructor


def test_robotics_interest_high_relevance_and_sorted_results(database, profile, event_factory, now):
    robotics = event_factory()
    unrelated = event_factory(id="unrelated", title="Poetry Reading", description="Literature and poetry.", topics=["literature"], event_type="talk")
    result = Recommender(database).rank(profile, [unrelated, robotics], now=now)
    assert result.ranking_mode == "fallback"
    assert result.total_events == 2
    assert [item.event_id for item in result.recommendations] == [robotics.id, unrelated.id]
    assert result.recommendations[0].score_breakdown.semantic_relevance == 50
    assert result.recommendations[0].score == 100
    assert result.recommendations[0].matched_interests == ["robotics"]
    assert result.recommendations[0].event == robotics
    assert result.recommendations[1].score < result.recommendations[0].score


def test_keyword_fallback_does_not_match_substrings(event_factory):
    profile = StudentProfile(user_id="student", interests=["AI"])
    event = event_factory(title="Train maintenance", description="Rain and railways", topics=[], event_type="talk")
    assert fallback_assessments(profile, [event])[0].relevance_score == 0


def test_expired_events_excluded_but_unknown_end_not_invented(database, profile, event_factory, now):
    ended = event_factory(id="ended", start_datetime=now - timedelta(hours=2), end_datetime=now)
    unknown_end = event_factory(id="unknown-end", start_datetime=now - timedelta(hours=2), end_datetime=None)
    result = Recommender(database).rank(profile, [ended, unknown_end], now=now)
    assert result.total_events == 1
    assert result.recommendations[0].event_id == "unknown-end"
    assert result.recommendations[0].badge == "UNCERTAIN"


def test_gemma_batches_validates_and_minimizes_profile_data(database, sdk, profile, event_factory, now):
    client, constructor = sdk
    events = [event_factory(id=f"event_{number:03}") for number in range(BATCH_SIZE + 1)]
    ranker = GemmaRanker(api_key="test-key", model="configured-model")
    result = Recommender(database, ranker).rank(profile, events, now=now)
    assert result.ranking_mode == "gemma"
    assert result.recommendations[0].score_breakdown.semantic_relevance == 48
    assert client.models.generate_content.call_count == 2
    client.models.get.assert_called_once_with(model="configured-model")
    options = constructor.call_args.kwargs["http_options"]
    assert options.timeout == 15000
    assert options.retry_options.attempts == 1
    for call in client.models.generate_content.call_args_list:
        assert call.kwargs["config"].response_schema == AssessmentBatch
        assert "UNTRUSTED DATA" in call.kwargs["config"].system_instruction
        sent = json.loads(call.kwargs["contents"])
        assert {"user_id", "availability", "campus"}.isdisjoint(sent["student"])
        assert {"start_datetime", "registration_url", "source_url"}.isdisjoint(sent["events"][0])


@pytest.mark.parametrize("text", [
    "not JSON", "{}", '{"assessments": []}',
    '{"assessments": [{"event_id": "unknown", "relevance_score": 5, "reason": "Fit"}]}',
    '{"assessments": [{"event_id": "event_001", "relevance_score": 6, "reason": "Fit"}]}',
    '{"assessments": [{"event_id": "event_001", "relevance_score": "5", "reason": "Fit"}]}',
    '{"assessments": [{"event_id": "event_001", "relevance_score": NaN, "reason": "Fit"}]}',
    '{"assessments": [{"event_id": "event_001", "relevance_score": 5, "reason": "Fit", "matched_interests": ["invented"]}]}',
    '{"assessments": [{"event_id": "event_001", "relevance_score": 5, "reason": "Register at https://invented.example"}]}',
    '{"assessments": [{"event_id": "event_001", "relevance_score": 5, "reason": "Fit"}, {"event_id": "event_001", "relevance_score": 5, "reason": "Fit"}]}',
])
def test_invalid_model_output_triggers_full_fallback(sdk, profile, event_factory, text):
    sdk[0].models.generate_content.side_effect = None
    sdk[0].models.generate_content.return_value = SimpleNamespace(text=text)
    assessments, mode = GemmaRanker(api_key="test-key", model="configured-model").assess(profile, [event_factory()])
    assert mode == "fallback"
    assert assessments[0].relevance_score == 5


@pytest.mark.parametrize("error", [
    errors.ClientError(401, {"error": {"message": "Invalid credential secret-test-key"}}),
    errors.ClientError(403, {"error": {"message": "Model access denied"}}),
    errors.ClientError(404, {"error": {"message": "Unsupported model"}}),
    errors.ClientError(429, {"error": {"message": "Rate limited"}}),
    httpx.ReadTimeout("Timed out"),
])
def test_external_failures_fall_back_without_sensitive_logs(sdk, profile, event_factory, error, caplog):
    sdk[0].models.generate_content.side_effect = error
    assessments, mode = GemmaRanker(api_key="secret-test-key", model="configured-model").assess(profile, [event_factory()])
    assert mode == "fallback"
    assert assessments[0].event_id == "event_001"
    assert "secret-test-key" not in caplog.text
    assert profile.user_id not in caplog.text


def test_unsupported_generate_action_and_missing_config_do_not_call_generation(sdk, profile, event_factory):
    sdk[0].models.get.return_value = SimpleNamespace(supported_actions=["embedContent"])
    ranker = GemmaRanker(api_key="test-key", model="configured-model")
    assert ranker.assess(profile, [event_factory()])[1] == "fallback"
    sdk[0].models.generate_content.assert_not_called()
    sdk[1].reset_mock()
    assert GemmaRanker(api_key="", model="configured-model").assess(profile, [event_factory()])[1] == "fallback"
    assert GemmaRanker(api_key="test-key", model="").assess(profile, [event_factory()])[1] == "fallback"
    sdk[1].assert_not_called()


def test_schema_unsupported_retries_plain_json_once(sdk, profile, event_factory):
    valid_json = json.dumps({"assessments": [{"event_id": "event_001", "relevance_score": 4, "reason": "Robotics match.", "matched_interests": ["robotics"]}]})
    sdk[0].models.generate_content.side_effect = [
        errors.ClientError(400, {"error": {"message": "JSON mode is not enabled for this model"}}),
        SimpleNamespace(text="```json\n" + valid_json + "\n```"),
    ]
    assessments, mode = GemmaRanker(api_key="test-key", model="configured-model").assess(profile, [event_factory()])
    assert mode == "gemma"
    assert assessments[0].relevance_score == 4
    second = sdk[0].models.generate_content.call_args_list[1].kwargs
    assert second["config"].response_schema is None
    assert "UNTRUSTED DATA" in second["contents"]


def test_empty_database_and_incomplete_profile_work(database, sdk, now):
    profile = StudentProfile(user_id="minimal")
    database.save_student(profile)
    response = Recommender(database).recommend(profile.user_id, now=now)
    assert response.total_events == 0
    assert response.recommendations == []
    sdk[1].assert_not_called()


def test_cache_reused_for_limits_and_invalidated_by_real_changes(database, profile, event_factory, now):
    database.save_student(profile)
    events = [event_factory(), event_factory(id="event_002")]
    database.upsert_events(events)
    ranker = GemmaRanker(api_key="")
    ranker.assess = Mock(wraps=ranker.assess)
    service = Recommender(database, ranker)
    assert len(service.recommend(profile.user_id, limit=1, now=now).recommendations) == 1
    assert len(service.recommend(profile.user_id, now=now).recommendations) == 2
    assert ranker.assess.call_count == 1
    database.save_student(profile)
    database.upsert_events(events)
    service.recommend(profile.user_id, now=now)
    assert ranker.assess.call_count == 1

    profile.interests = ["cybersecurity"]
    database.update_student(profile)
    with database.connection() as connection:
        assert connection.execute("SELECT count(*) FROM recommendation_cache").fetchone()[0] == 0
    result = service.recommend(profile.user_id, now=now)
    assert ranker.assess.call_count == 2
    assert result.recommendations[0].score_breakdown.semantic_relevance < 50

    events[0].title = "Updated hackathon title"
    database.upsert_events(events)
    with database.connection() as connection:
        assert connection.execute("SELECT count(*) FROM recommendation_cache").fetchone()[0] == 0
    result = service.recommend(profile.user_id, now=now)
    assert ranker.assess.call_count == 3
    assert result.recommendations[0].event.title == events[0].title


def test_model_and_scoring_configuration_invalidate_cache(database, profile, event_factory, now, monkeypatch):
    database.save_student(profile)
    database.upsert_events([event_factory()])
    ranker = GemmaRanker(api_key="")
    ranker.assess = Mock(wraps=ranker.assess)
    service = Recommender(database, ranker)
    service.recommend(profile.user_id, now=now)
    ranker.model = "different-model"
    service.recommend(profile.user_id, now=now)
    assert ranker.assess.call_count == 2
    monkeypatch.setitem(SCORING_CONFIG, "version", 2)
    service.recommend(profile.user_id, now=now)
    assert ranker.assess.call_count == 3


def test_transient_failure_cache_expires_and_gemma_recovers(database, sdk, profile, event_factory, now):
    database.save_student(profile)
    database.upsert_events([event_factory()])
    generate = sdk[0].models.generate_content.side_effect
    sdk[0].models.generate_content.side_effect = httpx.ReadTimeout("Timed out")
    service = Recommender(database, GemmaRanker(api_key="test-key", model="configured-model"))
    assert service.recommend(profile.user_id, now=now).ranking_mode == "fallback"
    sdk[0].models.generate_content.side_effect = generate
    assert service.recommend(profile.user_id, now=now + timedelta(seconds=30)).ranking_mode == "fallback"
    assert sdk[0].models.generate_content.call_count == 1
    assert service.recommend(profile.user_id, now=now + timedelta(seconds=60)).ranking_mode == "gemma"


@pytest.mark.parametrize("boundary", ["start", "end", "deadline", "seven_days"])
def test_cache_respects_exact_time_boundaries(database, profile, event_factory, now, boundary):
    if boundary == "start":
        event = event_factory(start_datetime=now + timedelta(seconds=1))
    elif boundary == "end":
        event = event_factory(start_datetime=now - timedelta(hours=1), end_datetime=now + timedelta(seconds=1))
    elif boundary == "deadline":
        event = event_factory(registration_deadline=now + timedelta(seconds=1))
    else:
        event = event_factory(start_datetime=now + timedelta(days=7, seconds=1), end_datetime=now + timedelta(days=8))
    database.save_student(profile)
    database.upsert_events([event])
    service = Recommender(database)
    before = service.recommend(profile.user_id, now=now)
    after = service.recommend(profile.user_id, now=now + timedelta(seconds=1))
    if boundary == "end":
        assert after.total_events == 0
    elif boundary == "start":
        assert "ALREADY_STARTED" in after.recommendations[0].flags
    elif boundary == "deadline":
        assert "REGISTRATION_CLOSED" in after.recommendations[0].flags
    else:
        assert before.recommendations[0].score_breakdown.timing == 3
        assert after.recommendations[0].score_breakdown.timing == 5


def test_api_rank_reads_sqlite_when_events_omitted_and_never_saves_drafts(client, database, profile, event_factory):
    database.upsert_events([event_factory(start_datetime=None, end_datetime=None)])
    response = client.post("/api/recommendations/rank", json={"profile": profile.model_dump(mode="json")})
    assert response.status_code == 200
    assert response.json()["total_events"] == 1
    assert database.get_student(profile.user_id) is None
    response = client.post("/api/recommendations/rank", json={"profile": profile.model_dump(mode="json"), "events": []})
    assert response.json()["total_events"] == 0
    event = event_factory().model_dump(mode="json")
    duplicate = client.post("/api/recommendations/rank", json={"profile": profile.model_dump(mode="json"), "events": [event, event]})
    assert duplicate.status_code == 422


def test_saved_recommendations_api_limit_and_sorting(client, database, profile, event_factory):
    database.save_student(profile)
    database.upsert_events([event_factory(id="z", start_datetime=None, end_datetime=None), event_factory(id="a", start_datetime=None, end_datetime=None)])
    response = client.get(f"/api/recommendations/{profile.user_id}?limit=1")
    assert response.status_code == 200
    assert response.json()["total_events"] == 2
    assert len(response.json()["recommendations"]) == 1
    assert response.json()["recommendations"][0]["event_id"] == "a"
    assert client.get(f"/api/recommendations/{profile.user_id}?limit=0").status_code == 422
