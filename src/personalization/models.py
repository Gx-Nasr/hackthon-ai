"""Shared API, persistence and ranking contracts (Pydantic v2)."""

from datetime import UTC, datetime, time
from typing import Annotated, Literal, Self
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import (
    AfterValidator,
    BaseModel,
    BeforeValidator,
    ConfigDict,
    Field,
    HttpUrl,
    StrictBool,
    StringConstraints,
    field_validator,
    model_validator,
)

MOROCCO = ZoneInfo("Africa/Casablanca")
Identifier = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
ShortText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
Tags = Annotated[list[ShortText], Field(max_length=50)]
StudentCampus = Literal["Rabat", "Ben Guerir", "Other"]
EventCampus = Literal["Rabat", "Ben Guerir", "Other", "Online", "Unknown"]
Badge = Literal["ACTIONABLE", "CROSS_CAMPUS", "SCHEDULE_CLASH", "UNCERTAIN"]
RankingMode = Literal["gemma", "fallback"]


class Model(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True, allow_inf_nan=False)


def local_instants(value: datetime, zone: ZoneInfo) -> list[datetime]:
    """Return real UTC instants for a wall clock time, including both DST folds."""
    candidates = {value.replace(tzinfo=zone, fold=fold).astimezone(UTC) for fold in (0, 1)}
    return sorted(
        instant for instant in candidates
        if instant.astimezone(zone).replace(tzinfo=None) == value
    )


def require_datetime(value: object) -> object:
    if isinstance(value, datetime):
        return value
    if not isinstance(value, str) or ("T" not in value and " " not in value.strip()):
        raise ValueError("Provide an ISO 8601 datetime, not a date or numeric timestamp")
    return value


def normalize_datetime(value: datetime) -> datetime:
    if value.tzinfo is None:
        instants = local_instants(value, MOROCCO)
        if len(instants) != 1:
            raise ValueError("Ambiguous or nonexistent Casablanca time; provide an explicit UTC offset")
        return instants[0]
    return value.astimezone(UTC)


Timestamp = Annotated[datetime, BeforeValidator(require_datetime), AfterValidator(normalize_datetime)]


class WeeklyBusyInterval(Model):
    weekday: int = Field(ge=0, le=6, description="Monday=0, Sunday=6")
    start_time: time
    end_time: time

    @model_validator(mode="after")
    def validate_times(self) -> Self:
        if self.start_time.tzinfo or self.end_time.tzinfo:
            raise ValueError("Weekly times are local clock times without UTC offsets")
        if self.start_time == self.end_time:
            raise ValueError("Busy interval must have a nonzero duration")
        return self


class BusyInterval(Model):
    start_datetime: Timestamp
    end_datetime: Timestamp

    @model_validator(mode="after")
    def validate_order(self) -> Self:
        if self.end_datetime <= self.start_datetime:
            raise ValueError("Busy interval end must be after its start")
        return self


class Availability(Model):
    timezone: str = "Africa/Casablanca"
    is_complete: StrictBool = False
    weekly_busy: list[WeeklyBusyInterval] = Field(default_factory=list, max_length=100)
    date_specific_busy: list[BusyInterval] = Field(default_factory=list, max_length=500)

    @field_validator("timezone")
    @classmethod
    def validate_timezone(cls, value: str) -> str:
        try:
            ZoneInfo(value)
        except (ZoneInfoNotFoundError, ValueError):
            raise ValueError("Use a valid IANA timezone") from None
        return value


class ProfileInput(Model):
    user_id: Identifier | None = None
    campus: StudentCampus | None = None
    school: ShortText | None = None
    major: ShortText | None = None
    academic_year: ShortText | None = None
    interests: Tags = Field(default_factory=list)
    skills: Tags = Field(default_factory=list)
    goals: Tags = Field(default_factory=list)
    preferred_event_types: Tags = Field(default_factory=list)
    languages: Tags = Field(default_factory=list)
    willing_to_travel: StrictBool | None = None
    availability: Availability = Field(default_factory=Availability)


class StudentProfile(ProfileInput):
    user_id: Identifier


class Event(Model):
    id: Identifier
    title: str = Field(min_length=1, max_length=300)
    description: str | None = Field(default=None, max_length=10000)
    event_type: ShortText | None = None
    topics: Tags = Field(default_factory=list)
    campus: EventCampus | None = None
    location: str | None = Field(default=None, max_length=500)
    start_datetime: Timestamp | None = None
    end_datetime: Timestamp | None = None
    registration_deadline: Timestamp | None = None
    registration_url: HttpUrl | None = None
    source_id: Identifier | None = None
    source_url: HttpUrl | None = None

    @model_validator(mode="after")
    def validate_order(self) -> Self:
        if self.start_datetime and self.end_datetime and self.end_datetime <= self.start_datetime:
            raise ValueError("Event end must be after its start")
        return self


class ImportWarning(Model):
    record_index: int = Field(ge=0)
    message: str


class ImportSummary(Model):
    inserted: int = 0
    updated: int = 0
    unchanged: int = 0
    failed: int = 0
    warnings: list[ImportWarning] = Field(default_factory=list)


class Assessment(Model):
    event_id: Identifier
    relevance_score: float = Field(ge=0, le=5, strict=True)
    reason: str = Field(min_length=1, max_length=300)
    matched_interests: Tags = Field(default_factory=list)


class AssessmentBatch(Model):
    assessments: list[Assessment]


class ScoreBreakdown(Model):
    semantic_relevance: float = Field(ge=0, le=50)
    event_type: float = Field(ge=0, le=10)
    campus: float = Field(ge=0, le=15)
    schedule: float = Field(ge=0, le=20)
    timing: float = Field(ge=0, le=5)


class Recommendation(Model):
    event_id: Identifier
    event: Event
    score: float = Field(ge=0, le=100)
    score_breakdown: ScoreBreakdown
    badge: Badge
    flags: list[str]
    reason: str
    matched_interests: Tags


class RecommendationResponse(Model):
    user_id: Identifier
    total_events: int = Field(ge=0)
    ranking_mode: RankingMode
    recommendations: list[Recommendation]


class RankRequest(Model):
    profile: StudentProfile
    events: list[Event] | None = Field(default=None, max_length=500)
    limit: int | None = Field(default=None, ge=1, le=500)

    @field_validator("events")
    @classmethod
    def unique_events(cls, events: list[Event] | None) -> list[Event] | None:
        if events is not None and len({event.id for event in events}) != len(events):
            raise ValueError("Event IDs must be unique")
        return events
