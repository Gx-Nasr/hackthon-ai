"""
UniRadar Backend 2 Live Interactive Demo
Demonstrates:
1. Conflict & Commute Detection across Rabat & Ben Guerir campuses
2. Hybrid Semantic + BM25s Retrieval
3. Trilingual Campus Q&A (Moroccan Darija, French, English)
4. Instant .ics Calendar File Generation
"""

from __future__ import annotations
import sys
import os
import json

if "--offline" in sys.argv:
    os.environ["PYTHON_DOTENV_DISABLED"] = "1"
    os.environ.pop("GEMINI_API_KEY", None)

# Ensure project root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from src.extractor import load_announcements_from_file
from src.models import StudentProfile
from src.retriever import HybridRetriever
from src.advisor import ConflictDetector, TrilingualAdvisor
from src.calendar_gen import save_ics_file


def run_demo():
    print("=" * 70)
    print(" 📡 UNIRADAR: Multimodal Anti-Chaos Campus Engine (Backend 2 Demo)")
    print("=" * 70)

    # 1. Load Profile & Announcements
    with open("config/student_profile.json", "r", encoding="utf-8") as f:
        profile_data = json.load(f)
    profile = StudentProfile(**profile_data)

    announcements = load_announcements_from_file("data/sample_announcements.json")

    print(f"\n👤 Active Student Profile:")
    print(f"   Name: {profile.name} | School: {profile.school}")
    print(f"   Home Campus: {profile.home_campus}")
    print(f"   Interests: {', '.join(profile.interests[:4])}")
    print(f"   Loaded Announcements: {len(announcements)} events\n")

    # 2. Conflict & Commute Radar Feed
    print("-" * 70)
    print("📍 [TWIST 2] Conflict & Commute Radar Feed (Rabat <-> Ben Guerir)")
    print("-" * 70)
    detector = ConflictDetector(profile)

    for ann in announcements[:5]:
        badge = detector.evaluate(ann)
        start_time = ann.start_datetime.strftime("%a %b %d at %H:%M")
        print(f"\n{badge.emoji} [{badge.headline.upper()}] - {ann.title}")
        print(f"   Campus: {ann.campus} ({ann.venue}) | Time: {start_time}")
        print(f"   Status Note: {badge.explanation}")

    # 3. Hybrid Indexing & Trilingual Search
    print("\n" + "-" * 70)
    print("🔍 [TWIST 3] Trilingual Hybrid Retrieval & Advisor")
    print("-" * 70)
    print("Indexing announcements into Hybrid Retriever (Dense + BM25s)...")
    retriever = HybridRetriever()
    retriever.index_announcements(announcements)
    advisor = TrilingualAdvisor(retriever, profile)

    test_queries = [
        ("Moroccan Darija (Strict Negative)", "wach kayn chi workshop f marrakech?"),
        ("Moroccan Darija (Actionable Match)", "wach kayn chi hackathon f rabat had weekend?"),
        ("French (Same-Campus Match)", "Où se déroule le workshop de robotique Forgebots ?"),
        ("English (Cross-Campus Match)", "Where is the 1337 coding contest taking place?")
    ]

    for lang_label, query in test_queries:
        print(f"\n💬 Student Query ({lang_label}): \"{query}\"")
        ans = advisor.ask(query, top_k=1)
        print(f"   Detected Language: {ans.detected_language}")
        print(f"   Response:\n   {ans.answer.replace(chr(10), chr(10) + '   ')}")

        if ans.cited_announcements:
            top_event = ans.cited_announcements[0]
            ics_path = save_ics_file(top_event)
            print(f"   📅 Calendar: Generated 1-click sync file at `{ics_path}`")

    print("\n" + "=" * 70)
    print("✅ Backend 2 Demo Completed Successfully!")
    print("=" * 70)


if __name__ == "__main__":
    run_demo()
