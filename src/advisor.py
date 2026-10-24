import os
import json
from google import genai
from google.genai import types

ADVISOR_SYSTEM_PROMPT = """
You are UniRadar's Campus Advisor for UM6P students.
Your tasks:
1. Cross-check incoming campus events against the student's profile (home campus, school, and schedule).
2. Assign a Status Badge:
   - "ACTIONABLE" (🟢): Event is on the student's campus, matches interests, and has no schedule clash.
   - "CROSS_CAMPUS" (🟡): Event is hosted at another UM6P campus (e.g. Ben Guerir vs. Rabat) requiring travel/train.
   - "CLASH" (🔴): Event start/end times conflict directly with an existing class or lab.
3. Compute a Match Score between 0% and 100%.
4. Generate a one-line explanation and advice.

If answering a student question, answer directly in the language they used (Moroccan Darija, French, or English).
"""

class CampusAdvisor:
    def __init__(self, profile_path: str = "config/student_profile.json", config_path: str = "config/campus_config.json"):
        self.client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))
        self.model_id = "gemma-4-26b-a4b-it"
        with open(profile_path, "r", encoding="utf-8") as f:
            self.profile = json.load(f)
        with open(config_path, "r", encoding="utf-8") as f:
            self.config = json.load(f)

    def evaluate_event(self, event: dict) -> dict:
        payload = {
            "student_profile": self.profile,
            "campus_rules": self.config,
            "event": event
        }
        prompt = f"""
{ADVISOR_SYSTEM_PROMPT}

Evaluate this event against the student profile:
{json.dumps(payload, indent=2)}

Output raw JSON:
{{
  "badge": "ACTIONABLE | CROSS_CAMPUS | CLASH",
  "match_score": 85,
  "badge_color": "green | yellow | red",
  "advisor_note": "<Concise guidance regarding location, commute, or schedule>"
}}
"""
        response = self.client.models.generate_content(
            model=self.model_id,
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.1,
                response_mime_type="application/json"
            )
        )
        return json.loads(response.text)

    def answer_query(self, user_query: str, retrieved_events: list) -> str:
        prompt = f"""
{ADVISOR_SYSTEM_PROMPT}

Student Profile: {json.dumps(self.profile)}
Retrieved Campus Announcements:
{json.dumps(retrieved_events, indent=2)}

Student Question: "{user_query}"

Instructions:
- If the question is in Darija (e.g., "wach kayn chi hackathon..."), respond fluently in natural Moroccan Darija (Arabizi or Arabic script).
- If in French or English, respond in that language.
- Point out exact room codes, dates, and whether it requires going to Ben Guerir or staying in Rabat.
"""
        response = self.client.models.generate_content(
            model=self.model_id,
            contents=prompt,
            config=types.GenerateContentConfig(temperature=0.2)
        )
        return response.text