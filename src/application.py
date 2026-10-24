"""Integration boundary shared by the React API and Streamlit interface."""
import calendar
import json
from pathlib import Path
from threading import RLock
from zoneinfo import ZoneInfo

from src.advisor import ConflictDetector, TrilingualAdvisor
from src.extractor import AnnouncementExtractor, load_announcements_from_file
from src.models import Announcement, StudentProfile
from src.personalization.database import Database
from src.personalization.event_adapter import adapt_event
from src.personalization.models import StudentProfile as RankingProfile
from src.personalization.recommender import Recommender
from src.retriever import HybridRetriever

ROOT = Path(__file__).resolve().parent.parent


def ranking_profile(profile):
    return RankingProfile(
        user_id=profile.student_id, campus=profile.home_campus, school=profile.school,
        major=profile.program, interests=profile.interests, languages=profile.preferred_languages,
        availability={"is_complete": True, "weekly_busy": [
            {"weekday": list(calendar.day_name).index(s.day_of_week),
             "start_time": s.start_time, "end_time": s.end_time} for s in profile.busy_slots
        ], "date_specific_busy": [
            {"start_datetime": f"{s.date}T{s.start_time}", "end_datetime": f"{s.date}T{s.end_time}"}
            for s in profile.date_specific_commitments
        ]},
    )


class CampusApplication:
    def __init__(self, database: Database):
        self.database = database
        self.lock = RLock()
        self.profile = StudentProfile.model_validate_json((ROOT / "config/student_profile.json").read_text())
        self.extractor = AnnouncementExtractor()
        self.retriever = HybridRetriever(cache_path=str(database.path.parent / "cache_embeddings.npy"))
        self._indexed = None
        with database.connection() as connection:
            connection.execute("CREATE TABLE IF NOT EXISTS announcements (id TEXT PRIMARY KEY, payload TEXT NOT NULL)")
            count = connection.execute("SELECT COUNT(*) FROM announcements").fetchone()[0]
        if not count:
            for announcement in load_announcements_from_file(ROOT / "data/sample_announcements.json"):
                self.add(announcement)

    def announcements(self):
        with self.database.connection() as connection:
            return [Announcement.model_validate_json(row[0]) for row in
                    connection.execute("SELECT payload FROM announcements ORDER BY id")]

    def add(self, announcement):
        # Validate both contracts before persisting either representation.
        event = adapt_event(announcement)
        with self.lock:
            with self.database.connection() as connection:
                connection.execute("INSERT INTO announcements VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload",
                                   (announcement.id, announcement.model_dump_json()))
            self.database.upsert_events([event])
            self._indexed = None
        return announcement

    def feed(self, profile=None):
        profile = profile or self.profile
        ranked = ranking_profile(profile)
        self.database.save_student(ranked)
        scores = {r.event_id: r.score for r in Recommender(self.database).recommend(ranked.user_id).recommendations}
        detector = ConflictDetector(profile)
        result = []
        for ann in self.announcements():
            badge = detector.evaluate(ann)
            def local_iso(value):
                if value is None:
                    return None
                if value.tzinfo is None:
                    value = value.replace(tzinfo=ZoneInfo("Africa/Casablanca"))
                return value.isoformat()
            result.append({
                "id": ann.id, "title": ann.title, "summary": ann.description,
                "startAt": local_iso(ann.start_datetime), "endAt": local_iso(ann.end_datetime),
                "timezone": "Africa/Casablanca", "campus": ann.campus,
                "category": ann.tags[0] if ann.tags else "Campus", "relevanceScore": scores.get(ann.id, 0),
                "statuses": [{"clash": "conflict", "cross_campus": "cross-campus"}.get(badge.badge_type.value, "relevant")],
                "sourceName": ann.organizer, "actionUrl": ann.registration_url,
                "calendarUrl": f"/api/events/{ann.id}/calendar", "badge": badge.model_dump(mode="json"), "isDemo": False,
            })
        return sorted(result, key=lambda e: -e["relevanceScore"])

    def ask(self, query, profile=None):
        with self.lock:
            announcements = self.announcements()
            fingerprint = tuple(a.model_dump_json() for a in announcements)
            if fingerprint != self._indexed:
                self.retriever.index_announcements(announcements, force_rebuild=True)
                self._indexed = fingerprint
            return TrilingualAdvisor(self.retriever, profile or self.profile).ask(query)
