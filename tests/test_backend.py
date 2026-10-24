"""
UniRadar Backend 2 Unit & Integration Tests
Validates:
1. Hybrid Retrieval (Dense + BM25s + Darija/FR/EN queries)
2. Conflict & Commute Detector (Rabat vs Ben Guerir + Schedule Clashes)
3. Trilingual Advisor (Language Detection + Grounded Answers)
4. Calendar Generator (RFC 5545 .ics generation)
"""

import os
import json
import pytest
from datetime import datetime

from src.models import Announcement, StudentProfile, BadgeType
from src.extractor import load_announcements_from_file
from src.retriever import HybridRetriever
from src.advisor import ConflictDetector, TrilingualAdvisor
from src.calendar_gen import generate_ics_content, generate_ics_bytes


@pytest.fixture
def sample_announcements():
    return load_announcements_from_file("data/sample_announcements.json")


@pytest.fixture
def student_profile():
    with open("config/student_profile.json", "r", encoding="utf-8") as f:
        data = json.load(f)
    return StudentProfile(**data)


def test_announcements_loaded(sample_announcements):
    assert len(sample_announcements) == 10
    first = sample_announcements[0]
    assert first.id == "ann_001"
    assert "Forgebots" in first.title
    assert first.campus == "Rabat"


def test_conflict_detector_actionable(sample_announcements, student_profile):
    detector = ConflictDetector(student_profile)
    # ann_001 is in Rabat at 17:30 on Wednesday. Student has lab 14:00-16:00, so 17:30 is free!
    badge = detector.evaluate(sample_announcements[0])
    assert badge.badge_type == BadgeType.ACTIONABLE
    assert badge.emoji == "🟢"
    assert "Actionable" in badge.headline


def test_conflict_detector_cross_campus(sample_announcements, student_profile):
    detector = ConflictDetector(student_profile)
    # ann_003 is in Ben Guerir at 10:00 AM on Thursday. Student is in Rabat!
    ann_benguerir = next(a for a in sample_announcements if a.campus == "Ben Guerir" and not a.is_virtual)
    # Let's test ann_004 (1337 Coding Battle in Ben Guerir)
    ann_1337 = next(a for a in sample_announcements if a.id == "ann_004")
    badge = detector.evaluate(ann_1337)
    assert badge.badge_type == BadgeType.CROSS_CAMPUS
    assert badge.emoji == "🟡"
    assert badge.transit_needed is True
    assert "ONCF" in badge.transit_mode


def test_conflict_detector_schedule_clash(sample_announcements, student_profile):
    detector = ConflictDetector(student_profile)
    # ann_005 is on Wednesday 2026-10-28 at 14:30. Student has lab 14:00-16:00!
    ann_clash = next(a for a in sample_announcements if a.id == "ann_005")
    badge = detector.evaluate(ann_clash)
    assert badge.badge_type == BadgeType.CLASH
    assert badge.emoji == "🔴"
    assert "Conflict" in badge.headline or "Conflicts" in badge.explanation


def test_hybrid_retrieval_darija_query(sample_announcements):
    retriever = HybridRetriever(cache_path="data/cache_embeddings.npy")
    retriever.index_announcements(sample_announcements)

    # Moroccan Darija query for hackathon in rabat
    query = "wach kayn chi hackathon f rabat had weekend?"
    results = retriever.search(query, top_k=3)
    assert len(results) > 0
    top_title = results[0].announcement.title.lower()
    assert "hackathon" in top_title


def test_hybrid_retrieval_robotics_query(sample_announcements):
    retriever = HybridRetriever(cache_path="data/cache_embeddings.npy")
    retriever.index_announcements(sample_announcements)

    # French query
    query = "où aura lieu l'atelier robotique Forgebots ?"
    results = retriever.search(query, top_k=2)
    assert len(results) > 0
    assert "Forgebots" in results[0].announcement.title


def test_calendar_ics_generation(sample_announcements):
    first = sample_announcements[0]
    ics_text = generate_ics_content(first)
    assert "BEGIN:VCALENDAR" in ics_text
    assert "BEGIN:VEVENT" in ics_text
    assert "Forgebots Robotics Workshop" in ics_text
    assert "Room B12" in ics_text
    assert "END:VCALENDAR" in ics_text

    ics_bytes = generate_ics_bytes(first)
    assert isinstance(ics_bytes, bytes)
    assert len(ics_bytes) > 100


def test_trilingual_advisor_language_detection(sample_announcements, student_profile):
    retriever = HybridRetriever()
    retriever.index_announcements(sample_announcements)
    advisor = TrilingualAdvisor(retriever, student_profile)

    assert advisor.detect_language("wach kayn chi event lyoma?") == "Moroccan Darija"
    assert advisor.detect_language("Est-ce qu'il y a un atelier demain ?") == "French"
    assert advisor.detect_language("Where is the cybersecurity workshop held?") == "English"


def test_trilingual_advisor_ask(sample_announcements, student_profile):
    retriever = HybridRetriever()
    retriever.index_announcements(sample_announcements)
    advisor = TrilingualAdvisor(retriever, student_profile)

    ans = advisor.ask("wach kayn chi hackathon f rabat?")
    assert ans.detected_language == "Moroccan Darija"
    assert len(ans.cited_announcements) > 0
    assert "Hackathon" in ans.cited_announcements[0].title
    assert ans.top_badge is not None


def test_strict_retrieval_and_no_match_location(sample_announcements, student_profile):
    retriever = HybridRetriever()
    retriever.index_announcements(sample_announcements)
    advisor = TrilingualAdvisor(retriever, student_profile)

    # 1. Search for a non-existent campus / city: Marrakech
    results = retriever.search("wach kayn chi workshop f marrakech?")
    assert len(results) == 0

    # 2. Ask advisor about Marrakech: must not cite any irrelevant event or generate ics
    ans = advisor.ask("wach kayn chi workshop f marrakech?")
    assert ans.detected_language == "Moroccan Darija"
    assert len(ans.cited_announcements) == 0
    assert ans.top_badge is None
    assert ans.ics_download_filename is None
    assert "Marrakech" in ans.answer
    assert "Rabat" in ans.answer or "Ben Guerir" in ans.answer
