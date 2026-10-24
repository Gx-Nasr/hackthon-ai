"""All attendance decisions and final points are deterministic Python logic."""

from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from .models import Assessment, Event, Recommendation, ScoreBreakdown, StudentProfile, local_instants

SCORING_CONFIG = {
    "version": 1,
    "weights": {"semantic_relevance": 50, "event_type": 10, "campus": 15, "schedule": 20, "timing": 5},
    "campus_travel": 8,
    "campus_no_travel": 0,
    "campus_travel_unknown": 4,
    "campus_unknown": 7,
    "schedule_unknown": 10,
    "timing_days": [7, 30],
    "timing_points": [5, 3, 1],
}
BADGE_PRIORITY = ("SCHEDULE_CLASH", "CROSS_CAMPUS", "UNCERTAIN", "ACTIONABLE")


def overlaps(start: datetime, end: datetime, busy_start: datetime, busy_end: datetime) -> bool:
    return start < busy_end and busy_start < end


def schedule_compatibility(profile: StudentProfile, event: Event) -> tuple[float, list[str]]:
    start, end = event.start_datetime, event.end_datetime
    if start is None or end is None:
        return SCORING_CONFIG["schedule_unknown"], ["SCHEDULE_UNKNOWN"]
    availability = profile.availability
    for busy in availability.date_specific_busy:
        if overlaps(start, end, busy.start_datetime, busy.end_datetime):
            return 0, ["SCHEDULE_CLASH"]

    zone = ZoneInfo(availability.timezone)
    first_day = start.astimezone(zone).date() - timedelta(days=1)
    last_day = end.astimezone(zone).date()
    uncertain = not availability.is_complete
    for busy in availability.weekly_busy:
        day = first_day + timedelta(days=(busy.weekday - first_day.weekday()) % 7)
        while day <= last_day:
            end_day = day + timedelta(days=int(busy.end_time < busy.start_time))
            starts = local_instants(datetime.combine(day, busy.start_time), zone)
            ends = local_instants(datetime.combine(end_day, busy.end_time), zone)
            possibilities = [
                overlaps(start, end, busy_start, busy_end)
                for busy_start in starts for busy_end in ends if busy_start < busy_end
            ]
            if possibilities and all(possibilities):
                return 0, ["SCHEDULE_CLASH"]
            # A skipped/repeated local time cannot establish that the student is free or busy.
            if not possibilities or any(possibilities):
                uncertain = True
            if (last_day - day).days < 7:
                break
            day += timedelta(days=7)
    if uncertain:
        return SCORING_CONFIG["schedule_unknown"], ["SCHEDULE_UNKNOWN"]
    return SCORING_CONFIG["weights"]["schedule"], []


def campus_compatibility(profile: StudentProfile, event: Event) -> tuple[float, list[str]]:
    if event.campus == "Online":
        return SCORING_CONFIG["weights"]["campus"], []
    known_campuses = {"Rabat", "Ben Guerir"}
    if event.campus not in known_campuses or profile.campus not in known_campuses:
        return SCORING_CONFIG["campus_unknown"], ["CAMPUS_UNKNOWN"]
    if profile.campus == event.campus:
        return SCORING_CONFIG["weights"]["campus"], []
    if profile.willing_to_travel is None:
        return SCORING_CONFIG["campus_travel_unknown"], ["CROSS_CAMPUS", "TRAVEL_UNKNOWN"]
    points = SCORING_CONFIG["campus_travel"] if profile.willing_to_travel else SCORING_CONFIG["campus_no_travel"]
    return points, ["CROSS_CAMPUS"]


def event_timing(event: Event, now: datetime) -> tuple[float, list[str]]:
    flags = []
    if event.start_datetime is None or event.end_datetime is None:
        flags.append("TIME_UNKNOWN")
    if event.start_datetime is None:
        points = 2
    elif event.start_datetime <= now:
        points = 0
        flags.append("ALREADY_STARTED")
    else:
        days = (event.start_datetime - now).total_seconds() / 86400
        near, upcoming = SCORING_CONFIG["timing_days"]
        near_points, upcoming_points, later_points = SCORING_CONFIG["timing_points"]
        points = near_points if days <= near else upcoming_points if days <= upcoming else later_points
    if event.registration_deadline and event.registration_deadline <= now:
        points = 0
        flags.append("REGISTRATION_CLOSED")
    return points, flags


def score_event(
    profile: StudentProfile, event: Event, assessment: Assessment, now: datetime,
) -> Recommendation:
    if assessment.event_id != event.id:
        raise ValueError("Assessment belongs to a different event")
    weights = SCORING_CONFIG["weights"]
    campus_points, campus_flags = campus_compatibility(profile, event)
    schedule_points, schedule_flags = schedule_compatibility(profile, event)
    timing_points, timing_flags = event_timing(event, now)
    preferred_types = {value.casefold() for value in profile.preferred_event_types}
    breakdown = ScoreBreakdown(
        semantic_relevance=round(assessment.relevance_score / 5 * weights["semantic_relevance"], 2),
        event_type=weights["event_type"] if event.event_type and event.event_type.casefold() in preferred_types else 0,
        campus=campus_points,
        schedule=schedule_points,
        timing=timing_points,
    )
    flags = list(dict.fromkeys([*schedule_flags, *campus_flags, *timing_flags]))
    if any(flag not in ("SCHEDULE_CLASH", "CROSS_CAMPUS") for flag in flags):
        flags.append("UNCERTAIN")
    badge = next((badge for badge in BADGE_PRIORITY if badge in flags), "ACTIONABLE")
    return Recommendation(
        event_id=event.id,
        event=event,
        score=round(max(0, min(100, sum(breakdown.model_dump().values()))), 2),
        score_breakdown=breakdown,
        badge=badge,
        flags=flags,
        reason=assessment.reason,
        matched_interests=assessment.matched_interests,
    )
