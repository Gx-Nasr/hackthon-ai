from datetime import UTC, datetime

import pytest
from pydantic import ValidationError

from src.personalization.models import Assessment, Availability, Event
from src.personalization.scoring import score_event


def score(profile, event, now):
    assessment = Assessment(event_id=event.id, relevance_score=5, reason="Robotics match.", matched_interests=["robotics"])
    return score_event(profile, event, assessment, now)


def test_full_match_has_explainable_score(profile, event_factory, now):
    result = score(profile, event_factory(), now)
    assert result.score == 100
    assert result.score_breakdown.model_dump() == {"semantic_relevance": 50, "event_type": 10, "campus": 15, "schedule": 20, "timing": 5}
    assert result.badge == "ACTIONABLE"
    assert result.flags == []


@pytest.mark.parametrize("willing,points", [(True, 8), (False, 0), (None, 4)])
def test_cross_campus_travel_weight(profile, event_factory, now, willing, points):
    profile.willing_to_travel = willing
    result = score(profile, event_factory(campus="Ben Guerir"), now)
    assert result.badge == "CROSS_CAMPUS"
    assert "CROSS_CAMPUS" in result.flags
    assert result.score_breakdown.campus == points


def test_online_never_cross_campus(profile, event_factory, now):
    result = score(profile, event_factory(campus="Online"), now)
    assert result.score_breakdown.campus == 15
    assert "CROSS_CAMPUS" not in result.flags


def test_weekly_clash_has_priority_over_cross_campus(profile, event_factory, now):
    profile.availability = Availability(weekly_busy=[{"weekday": 0, "start_time": "09:00", "end_time": "12:00"}])
    event = event_factory(campus="Ben Guerir", start_datetime="2027-11-15T10:00:00+01:00", end_datetime="2027-11-15T11:00:00+01:00")
    result = score(profile, event, now)
    assert result.badge == "SCHEDULE_CLASH"
    assert {"SCHEDULE_CLASH", "CROSS_CAMPUS"} <= set(result.flags)
    assert result.score_breakdown.schedule == 0


def test_date_specific_overlap_and_touching_boundaries(profile, event_factory, now):
    profile.availability = Availability(is_complete=True, date_specific_busy=[{
        "start_datetime": "2027-11-13T17:00Z", "end_datetime": "2027-11-13T19:00Z",
    }])
    assert score(profile, event_factory(), now).badge == "ACTIONABLE"
    result = score(profile, event_factory(end_datetime="2027-11-13T17:01Z"), now)
    assert result.badge == "SCHEDULE_CLASH"


def test_overnight_and_multi_day_events(profile, event_factory, now):
    profile.availability = Availability(is_complete=True, weekly_busy=[{"weekday": 6, "start_time": "23:00", "end_time": "02:00"}])
    overnight = event_factory(start_datetime="2027-11-15T01:00+01:00", end_datetime="2027-11-15T01:30+01:00")
    assert score(profile, overnight, now).badge == "SCHEDULE_CLASH"
    multi_day = event_factory(start_datetime="2027-11-13T09:00+01:00", end_datetime="2027-11-23T12:00+01:00")
    assert score(profile, multi_day, now).badge == "SCHEDULE_CLASH"


@pytest.mark.parametrize("timestamps", [
    {"start_datetime": None, "end_datetime": None},
    {"start_datetime": None},
    {"end_datetime": None},
])
def test_unknown_times_never_invent_a_conflict(profile, event_factory, now, timestamps):
    profile.availability = Availability(is_complete=True, weekly_busy=[{"weekday": 5, "start_time": "09:00", "end_time": "18:00"}])
    result = score(profile, event_factory(**timestamps), now)
    assert result.badge == "UNCERTAIN"
    assert "TIME_UNKNOWN" in result.flags
    assert "SCHEDULE_CLASH" not in result.flags
    assert result.score_breakdown.schedule == 10


def test_missing_schedule_and_unknown_campus_are_uncertain(profile, event_factory, now):
    profile.availability = Availability()
    result = score(profile, event_factory(campus="Unknown"), now)
    assert result.badge == "UNCERTAIN"
    assert {"CAMPUS_UNKNOWN", "SCHEDULE_UNKNOWN"} <= set(result.flags)
    profile.campus = "Other"
    assert score(profile, event_factory(campus="Other"), now).score_breakdown.campus == 7


def test_registration_closed_and_already_started_are_not_actionable(profile, event_factory, now):
    closed = event_factory(registration_deadline="2027-11-12T08:00Z")
    assert score(profile, closed, now).score_breakdown.timing == 0
    assert "REGISTRATION_CLOSED" in score(profile, closed, now).flags
    ongoing = event_factory(start_datetime="2027-11-12T07:00Z")
    assert score(profile, ongoing, now).badge == "UNCERTAIN"
    assert "ALREADY_STARTED" in score(profile, ongoing, now).flags


@pytest.mark.parametrize("timestamp", ["2026-02-15T02:30:00", "2026-03-22T02:30:00", "2027-11-13", 1826092800])
def test_ambiguous_nonexistent_or_incomplete_timestamps_rejected(timestamp):
    with pytest.raises(ValidationError):
        Event(id="bad-time", title="Test", start_datetime=timestamp)


def test_recurring_dst_ambiguity_remains_uncertain(profile, event_factory):
    profile.availability = Availability(is_complete=True, weekly_busy=[{"weekday": 6, "start_time": "02:15", "end_time": "02:45"}])
    event = event_factory(start_datetime="2026-02-15T02:20+01:00", end_datetime="2026-02-15T02:30+01:00")
    result = score(profile, event, datetime(2026, 2, 14, tzinfo=UTC))
    assert result.badge == "UNCERTAIN"
    assert "SCHEDULE_CLASH" not in result.flags


@pytest.mark.parametrize("updates", [
    {"title": "   "}, {"start_datetime": "nonsense"}, {"registration_url": "javascript:alert(1)"},
    {"end_datetime": "2027-11-13T08:00:00+01:00"},
])
def test_invalid_events_are_rejected(event_factory, updates):
    with pytest.raises(ValidationError):
        event_factory(**updates)
