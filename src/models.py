"""
UniRadar Core Data Models & Schemas
Serves as the unified contract between Extractor (Backend 1), RAG/Advisor (Backend 2), and UI (Frontend).
"""

from __future__ import annotations
from datetime import datetime
from enum import Enum
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class BadgeType(str, Enum):
    ACTIONABLE = "actionable"       # 🟢 Free & on home campus
    CROSS_CAMPUS = "cross_campus"   # 🟡 Different campus alert (train / remote link)
    CLASH = "clash"                 # 🔴 Schedule conflict with lab/class
    NEUTRAL = "neutral"             # ⚪ Info only / virtual without conflict


class ConflictBadge(BaseModel):
    badge_type: BadgeType
    emoji: str
    headline: str
    explanation: str
    transit_needed: bool = False
    transit_mode: Optional[str] = None
    conflicting_event: Optional[str] = None


class Announcement(BaseModel):
    id: str
    title: str
    organizer: str
    source_type: str = Field(default="flyer", description="flyer, email, chat_forward, pdf")
    source_channel: Optional[str] = None
    language: str = "en"
    campus: str = "Rabat"
    venue: str
    start_datetime: datetime
    end_datetime: Optional[datetime] = None
    description: str
    tags: List[str] = Field(default_factory=list)
    target_schools: List[str] = Field(default_factory=list)
    registration_url: Optional[str] = None
    is_virtual: bool = False
    virtual_link: Optional[str] = None
    raw_image_path: Optional[str] = None

    def to_searchable_text(self) -> str:
        """Flattens the event for lexical and semantic indexing."""
        tags_str = ", ".join(self.tags)
        schools_str = ", ".join(self.target_schools)
        start_str = self.start_datetime.strftime("%Y-%m-%d %H:%M") if self.start_datetime else ""
        return (
            f"Title: {self.title}\n"
            f"Organizer: {self.organizer}\n"
            f"Campus: {self.campus} | Venue: {self.venue}\n"
            f"Date & Time: {start_str}\n"
            f"Schools: {schools_str}\n"
            f"Tags: {tags_str}\n"
            f"Description: {self.description}\n"
            f"Registration: {self.registration_url or 'None'}"
        )


class BusySlot(BaseModel):
    day_of_week: str  # Monday, Tuesday, etc.
    start_time: str   # "14:00"
    end_time: str     # "16:00"
    title: str
    campus: str
    location: str


class DateCommitment(BaseModel):
    date: str         # "2026-10-28"
    start_time: str   # "14:00"
    end_time: str     # "16:00"
    title: str
    campus: str
    location: str


class StudentProfile(BaseModel):
    student_id: str
    name: str
    home_campus: str = "Rabat"
    school: str = "College of Computing"
    program: Optional[str] = None
    interests: List[str] = Field(default_factory=list)
    preferred_languages: List[str] = Field(default_factory=lambda: ["Moroccan Darija", "French", "English"])
    busy_slots: List[BusySlot] = Field(default_factory=list)
    date_specific_commitments: List[DateCommitment] = Field(default_factory=list)


class SearchResult(BaseModel):
    announcement: Announcement
    score: float
    dense_score: float = 0.0
    bm25_score: float = 0.0
    badge: Optional[ConflictBadge] = None


class ChatAnswer(BaseModel):
    query: str
    detected_language: str = "English"  # "Moroccan Darija", "French", "English"
    answer: str
    cited_announcements: List[Announcement] = Field(default_factory=list)
    top_badge: Optional[ConflictBadge] = None
    ics_download_filename: Optional[str] = None
