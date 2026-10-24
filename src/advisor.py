"""
UniRadar Campus Advisor & Conflict Detector
1. "Rabat <-> Ben Guerir" Conflict & Commute Detector
2. Trilingual Campus Memory Chatbot (Moroccan Darija + French + English)
"""

from __future__ import annotations
import os
import json
import re
from datetime import datetime, time
from typing import List, Optional, Tuple, Dict, Any

from dotenv import load_dotenv
load_dotenv()

from src.models import (
    Announcement,
    StudentProfile,
    ConflictBadge,
    BadgeType,
    SearchResult,
    ChatAnswer,
)
from src.retriever import HybridRetriever
from src.calendar_gen import generate_ics_content

# Google GenAI SDK support
try:
    from google import genai
    from google.genai import types
    GENAI_AVAILABLE = True
except ImportError:
    GENAI_AVAILABLE = False


class ConflictDetector:
    """
    Evaluates campus announcements against a student's profile, schedule, and campus.
    Produces high-impact badges:
    🟢 Actionable for You
    🟡 Cross-Campus Alert (Rabat <-> Ben Guerir train / transit needed)
    🔴 Schedule Clash (Conflicts with lab, defense, or exam)
    """

    def __init__(
        self,
        profile: StudentProfile,
        campus_config_path: str = "config/campus_config.json"
    ):
        self.profile = profile
        self.campus_config = self._load_campus_config(campus_config_path)

    def _load_campus_config(self, path: str) -> Dict[str, Any]:
        if os.path.exists(path):
            try:
                with open(path, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception:
                pass
        return {}

    def _parse_time(self, t_str: str) -> time:
        parts = t_str.strip().split(":")
        return time(int(parts[0]), int(parts[1]))

    def evaluate(self, announcement: Announcement) -> ConflictBadge:
        """Evaluates an announcement and returns a rich ConflictBadge."""
        # 1. Schedule Clash Check
        event_dt = announcement.start_datetime
        event_date_str = event_dt.strftime("%Y-%m-%d")
        event_weekday = event_dt.strftime("%A")
        event_start_time = event_dt.time()
        event_end_time = (
            announcement.end_datetime.time()
            if announcement.end_datetime
            else time(min(event_start_time.hour + 2, 23), event_start_time.minute)
        )

        # Check date-specific commitments first (e.g. Midterms, Mandatory labs)
        for commit in self.profile.date_specific_commitments:
            if commit.date == event_date_str:
                c_start = self._parse_time(commit.start_time)
                c_end = self._parse_time(commit.end_time)
                # Overlap test: startA < endB and endA > startB
                if (event_start_time < c_end) and (event_end_time > c_start):
                    return ConflictBadge(
                        badge_type=BadgeType.CLASH,
                        emoji="🔴",
                        headline="Schedule Clash",
                        explanation=f"Conflicts with '{commit.title}' scheduled on {commit.date} ({commit.start_time}–{commit.end_time} in {commit.location}).",
                        conflicting_event=commit.title
                    )

        # Check weekly recurring classes / labs
        for slot in self.profile.busy_slots:
            if slot.day_of_week.lower() == event_weekday.lower():
                s_start = self._parse_time(slot.start_time)
                s_end = self._parse_time(slot.end_time)
                if (event_start_time < s_end) and (event_end_time > s_start):
                    return ConflictBadge(
                        badge_type=BadgeType.CLASH,
                        emoji="🔴",
                        headline="Schedule Clash",
                        explanation=f"Conflicts with your weekly '{slot.title}' ({slot.start_time}–{slot.end_time} at {slot.campus} {slot.location}).",
                        conflicting_event=slot.title
                    )

        # 2. Cross-Campus Commute Check
        home_campus = self.profile.home_campus.strip().lower()
        event_campus = announcement.campus.strip().lower()

        if event_campus != home_campus and not announcement.is_virtual:
            transit_note = "ONCF Train Rabat <-> Ben Guerir (~2h30)"
            virtual_note = (
                f" Alternatively, join online: {announcement.virtual_link}"
                if announcement.virtual_link
                else " Consider requesting a Teams broadcast."
            )
            return ConflictBadge(
                badge_type=BadgeType.CROSS_CAMPUS,
                emoji="🟡",
                headline="Cross-Campus Alert",
                explanation=(
                    f"Hosted in {announcement.campus} ({announcement.venue}). "
                    f"You are based at {self.profile.home_campus} Campus — requires {transit_note} or traveling in advance.{virtual_note}"
                ),
                transit_needed=True,
                transit_mode=transit_note
            )

        # 3. Virtual event or Same-campus actionable
        if announcement.is_virtual:
            return ConflictBadge(
                badge_type=BadgeType.ACTIONABLE,
                emoji="🟢",
                headline="Virtual Event (Free to Join)",
                explanation=f"Online event — you have no schedule clash at {event_dt.strftime('%H:%M')}.",
                transit_needed=False
            )

        # 4. Same Campus & Schedule is Free: Actionable!
        return ConflictBadge(
            badge_type=BadgeType.ACTIONABLE,
            emoji="🟢",
            headline="Actionable for You",
            explanation=f"Happening in {announcement.campus} Campus, {announcement.venue} — you are free at {event_dt.strftime('%H:%M')}.",
            transit_needed=False
        )


class TrilingualAdvisor:
    """
    RAG-powered conversational advisor answering student queries in:
    - Moroccan Darija (e.g. "wach kayn chi hackathon had weekend?")
    - French ("Où et quand se déroule le workshop Forgebots ?")
    - English ("Where do I submit the robotics registration?")
    """

    def __init__(
        self,
        retriever: HybridRetriever,
        profile: StudentProfile,
        model_name: str = "gemini-2.5-flash"
    ):
        self.retriever = retriever
        self.profile = profile
        self.detector = ConflictDetector(profile)
        self.model_name = os.getenv("GEMINI_MODEL", model_name)
        self.api_key = os.getenv("GEMINI_API_KEY", "").strip()
        self._client = None
        if GENAI_AVAILABLE and self.api_key and not self.api_key.startswith("your_"):
            try:
                self._client = genai.Client(api_key=self.api_key)
            except Exception as e:
                self._client = None

    def detect_language(self, query: str) -> str:
        """Detects whether user query is in Moroccan Darija, French, or English."""
        q_lower = query.lower()
        darija_keywords = [
            "wach", "wash", "kayn", "kayna", "dyal", "dial", "fayn", "feen",
            "fin", "bghit", "bghina", "had", "chhal", "chouf", "m3a", "mzyan",
            "daba", "ghadi", "imta", "3afak", "kidayr", "chi", "chouff", "wakha"
        ]
        # Also check for Arabic script Darija
        arabic_characters = re.findall(r"[\u0600-\u06FF]", query)
        if len(arabic_characters) > 3 or any(w in q_lower.split() for w in darija_keywords):
            return "Moroccan Darija"

        french_keywords = [
            "est-ce", "que", "qui", "quand", "comment", "pourquoi", "où", "ou",
            "horaire", "salle", "bâtiment", "campus", "atelier", "conférence",
            "inscription", "demain", "semaine", "merci", "bonjour", "salut"
        ]
        if any(w in q_lower.split() for w in french_keywords) or any(
            phrase in q_lower for phrase in ["est ce", "y a-t-il", "y a t il", "c'est quoi"]
        ):
            return "French"

        return "English"

    def ask(self, query: str, top_k: int = 3) -> ChatAnswer:
        """
        Executes strict hybrid retrieval, checks student conflicts, and generates
        a culturally fluent and personalized response in the user's language.
        """
        detected_lang = self.detect_language(query)
        detected_loc = self.retriever.extract_location_filter(query)

        # 1. Strict Hybrid Search
        results = self.retriever.search(query, top_k=top_k)
        cited_announcements = [r.announcement for r in results]

        # 2. Add Conflict Badges
        top_badge = None
        if cited_announcements:
            top_badge = self.detector.evaluate(cited_announcements[0])
            for r in results:
                r.badge = self.detector.evaluate(r.announcement)

        # 3. Generate Answer (Strict: zero hallucinations when no matches exist)
        if not cited_announcements:
            answer_text = self._generate_no_match_answer(query, detected_lang, detected_loc)
            ics_filename = None
        elif self._client is not None:
            answer_text = self._generate_gemini_answer(query, detected_lang, results)
            top_ann = cited_announcements[0]
            clean_title = re.sub(r"[^\w\-]", "_", top_ann.title[:20].lower())
            ics_filename = f"{top_ann.id}_{clean_title}.ics"
        else:
            answer_text = self._generate_rule_based_answer(query, detected_lang, results)
            top_ann = cited_announcements[0]
            clean_title = re.sub(r"[^\w\-]", "_", top_ann.title[:20].lower())
            ics_filename = f"{top_ann.id}_{clean_title}.ics"

        return ChatAnswer(
            query=query,
            detected_language=detected_lang,
            answer=answer_text,
            cited_announcements=cited_announcements,
            top_badge=top_badge,
            ics_download_filename=ics_filename
        )

    def _generate_no_match_answer(
        self,
        query: str,
        detected_lang: str,
        detected_loc: Optional[str]
    ) -> str:
        """Strict and helpful message when no announcements match query or requested location."""
        if detected_loc:
            if detected_lang == "Moroccan Darija":
                return (
                    f"Makayn hta chi event aw workshop f **{detected_loc}** f les annonces l-halyin. "
                    "Les événements d'UM6P l-moujoudin dabba kaynin ghir f campus **Rabat** wla **Ben Guerir**."
                )
            elif detected_lang == "French":
                return (
                    f"Aucun événement ou atelier n'est répertorié à **{detected_loc}**. "
                    "Les annonces actuelles de l'UM6P concernent uniquement les campus de **Rabat** et **Ben Guerir**."
                )
            else:
                return (
                    f"No events or workshops found for **{detected_loc}**. "
                    "Current UM6P announcements are exclusively for the **Rabat** and **Ben Guerir** campuses."
                )

        if detected_lang == "Moroccan Darija":
            return (
                "Smh lia, malqit hta chi event kaynaseb had l-bahth f les annonces l-halyin. "
                "Jreb tqelleb b kelmat khrin (matalan: *hackathon, robotics, IA, 1337, CTF*)!"
            )
        elif detected_lang == "French":
            return (
                "Désolé, aucun événement correspondant n'a été trouvé dans la base actuelle. "
                "Essayez avec d'autres mots-clés (ex: *hackathon, robotique, IA, 1337, CTF*)."
            )
        else:
            return (
                "Sorry, no matching events were found in the current campus database. "
                "Try searching with different keywords (e.g., *hackathon, robotics, AI, 1337, CTF*)."
            )

    def _generate_gemini_answer(
        self,
        query: str,
        detected_lang: str,
        results: List[SearchResult]
    ) -> str:
        """Calls Gemini API with student context, grounded announcements, and language rules."""
        context_parts = []
        for idx, r in enumerate(results, start=1):
            ann = r.announcement
            badge = r.badge
            context_parts.append(
                f"[Announcement #{idx}]\n"
                f"Title: {ann.title}\n"
                f"Organizer: {ann.organizer}\n"
                f"Campus: {ann.campus} (Venue: {ann.venue})\n"
                f"Date & Time: {ann.start_datetime.strftime('%A, %d %B %Y at %H:%M')}\n"
                f"Status for Student: {badge.headline} ({badge.explanation})\n"
                f"Registration / Link: {ann.registration_url or ann.virtual_link or 'None'}\n"
                f"Summary: {ann.description}\n"
            )

        context_str = "\n".join(context_parts)

        system_instruction = (
            "You are UniRadar, the intelligent, friendly, and ultra-accurate campus engine for UM6P "
            "(Mohammed VI Polytechnic University), serving students across Rabat and Ben Guerir.\n\n"
            f"STUDENT PROFILE:\n"
            f"- Name: {self.profile.name}\n"
            f"- Home Campus: {self.profile.home_campus}\n"
            f"- School: {self.profile.school}\n\n"
            "RULES:\n"
            f"1. Respond in the EXACT language of the user: {detected_lang}.\n"
            "   - If Moroccan Darija: Use authentic, warm Moroccan Darija (Arabizi or Arabic script matching user query, e.g. 'Iyeh kayn...', 'Rah f Rabat...', 'Attention rah m3a lwaqt dyal lab...').\n"
            "   - If French: Professional, crisp, and helpful French.\n"
            "   - If English: Clear, friendly, and concise English.\n"
            "2. Ground your answer strictly in the provided Announcements context.\n"
            "3. ALWAYS state the campus (Rabat vs Ben Guerir) and clearly highlight if there is a conflict or if travel is required.\n"
            "4. Keep the answer structured and under 150 words. Offer the 1-click calendar (.ics) option.\n"
            "5. CRITICAL NEGATIVE CONSTRAINT: If the user query specifies a city/campus with no events (e.g. Marrakech, Casablanca), "
            "or asks for an event type that does not exist in the announcements, YOU MUST CLEARLY STATE THAT NO EVENT EXISTS THERE. "
            "NEVER hallucinate, invent an event, or substitute an event from another city!\n"
        )

        user_prompt = (
            f"Student Query: {query}\n\n"
            f"Retrieved Announcements:\n{context_str}\n\n"
            f"Provide your personalized answer in {detected_lang}:"
        )

        try:
            response = self._client.models.generate_content(
                model=self.model_name,
                contents=user_prompt,
                config=types.GenerateContentConfig(
                    system_instruction=system_instruction,
                    temperature=0.3,
                )
            )
            return response.text.strip()
        except Exception as e:
            print(f"[Warning] Gemini API call failed: {e}")
            return self._generate_rule_based_answer(query, detected_lang, results)

    def _generate_rule_based_answer(
        self,
        query: str,
        detected_lang: str,
        results: List[SearchResult]
    ) -> str:
        """Reliable grounded fallback answering in Darija, French, or English."""
        if not results:
            if detected_lang == "Moroccan Darija":
                return "Smh lia, malqit hta chi event kaynaseb had l-bahth dyalk f les annonces l-halyin. Jreb tbeddel l-kalimat aw chouf les tags!"
            elif detected_lang == "French":
                return "Désolé, aucune annonce correspondante n'a été trouvée pour votre recherche sur les campus UM6P."
            else:
                return "Sorry, no matching announcement was found in the current UM6P campus database."

        top_res = results[0]
        top = top_res.announcement
        badge = top_res.badge or self.detector.evaluate(top)
        dt_str = top.start_datetime.strftime("%A %d %b à %H:%M")

        if detected_lang == "Moroccan Darija":
            ans = f"**{top.title}**\n\n"
            ans += f"📍 **Fin:** {top.venue} ({top.campus} Campus)\n"
            ans += f"🕒 **Waqt:** {dt_str}\n"
            ans += f"{badge.emoji} **Status dyalk:** {badge.explanation}\n\n"
            if top.registration_url:
                ans += f"🔗 **Inscription:** [{top.registration_url}]({top.registration_url})\n"
            ans += "💡 *Tqder telechargi fichier `.ics` b click wahda bach tzidha f Google Calendar dyalk!*"
            return ans

        elif detected_lang == "French":
            ans = f"**{top.title}** (Organisé par {top.organizer})\n\n"
            ans += f"📍 **Lieu :** {top.venue} — Campus {top.campus}\n"
            ans += f"🕒 **Date & Heure :** {dt_str}\n"
            ans += f"{badge.emoji} **Statut pour vous :** {badge.explanation}\n\n"
            ans += f"{top.description}\n\n"
            if top.registration_url:
                ans += f"🔗 **Lien d'inscription :** [{top.registration_url}]({top.registration_url})\n"
            ans += "📅 *Vous pouvez télécharger le fichier `.ics` en 1 clic pour l'ajouter à votre calendrier Outlook/Google.*"
            return ans

        else:  # English
            ans = f"**{top.title}** (by {top.organizer})\n\n"
            ans += f"📍 **Location:** {top.venue} — {top.campus} Campus\n"
            ans += f"🕒 **Date & Time:** {dt_str}\n"
            ans += f"{badge.emoji} **Your Status:** {badge.explanation}\n\n"
            ans += f"{top.description}\n\n"
            if top.registration_url:
                ans += f"🔗 **Register here:** [{top.registration_url}]({top.registration_url})\n"
            ans += "📅 *Download the 1-click `.ics` file below to sync with Google Calendar or Outlook.*"
            return ans
