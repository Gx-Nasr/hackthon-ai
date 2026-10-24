"""Shared recommendation orchestration; imported events always come from SQLite."""

import hashlib
import json
from datetime import UTC, datetime

from .ai_ranker import GemmaRanker
from .database import Database
from .models import Event, RecommendationResponse, StudentProfile
from .profile_service import get_profile
from .scoring import SCORING_CONFIG, event_timing, score_event


class Recommender:
    def __init__(self, database: Database, ranker: GemmaRanker | None = None):
        self.database = database
        self.ranker = ranker or GemmaRanker()

    def recommend(
        self, user_id: str, limit: int | None = None, *, now: datetime | None = None,
    ) -> RecommendationResponse:
        profile = get_profile(self.database, user_id)
        return self._rank(profile, self.database.get_all_events(), limit, now, cache=True)

    def rank(
        self, profile: StudentProfile, events: list[Event] | None = None,
        limit: int | None = None, *, now: datetime | None = None,
    ) -> RecommendationResponse:
        if events is None:
            events = self.database.get_all_events()
        return self._rank(profile, events, limit, now, cache=False)

    def _rank(
        self, profile: StudentProfile, events: list[Event], limit: int | None,
        now: datetime | None, *, cache: bool,
    ) -> RecommendationResponse:
        if limit is not None and limit < 1:
            raise ValueError("limit must be positive")
        now = now or datetime.now(UTC)
        if now.tzinfo is None:
            raise ValueError("now must be timezone-aware")
        now = now.astimezone(UTC)
        if len({event.id for event in events}) != len(events):
            raise ValueError("Event IDs must be unique")
        candidates = sorted(
            (event for event in events if event.end_datetime is None or event.end_datetime > now),
            key=lambda event: event.id,
        )
        fingerprint = {
            "profile": profile.model_dump(mode="json"),
            "events": [event.model_dump(mode="json") for event in candidates],
            "model": self.ranker.cache_config,
            "scoring": SCORING_CONFIG,
            # Exact timing states invalidate cache at starts, ends, deadlines and score boundaries.
            "timing": [event_timing(event, now) for event in candidates],
        }
        input_hash = hashlib.sha256(json.dumps(fingerprint, sort_keys=True, ensure_ascii=False).encode()).hexdigest()
        response = self.database.get_cached_recommendations(profile.user_id, input_hash, now=now) if cache else None
        if response is None:
            assessments, mode = self.ranker.assess(profile, candidates)
            by_id = {assessment.event_id: assessment for assessment in assessments}
            recommendations = [score_event(profile, event, by_id[event.id], now) for event in candidates]
            recommendations.sort(key=lambda recommendation: (-recommendation.score, recommendation.event_id))
            response = RecommendationResponse(
                user_id=profile.user_id, total_events=len(candidates), ranking_mode=mode,
                recommendations=recommendations,
            )
            if cache:
                self.database.save_recommendation_cache(profile.user_id, input_hash, response, now=now)
        if limit is not None:
            return response.model_copy(update={"recommendations": response.recommendations[:limit]})
        return response
