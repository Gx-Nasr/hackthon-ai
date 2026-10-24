import os
import json
from PIL import Image
from google import genai
from google.genai import types

EXTRACTION_SYSTEM_PROMPT = """
You are UniRadar's Multimodal Campus Parser.
Analyze the provided event flyer image or raw announcement text (French, English, or mixed Darija).
Extract the event details into a valid JSON object matching this schema exactly:
{
  "title": "<event name>",
  "campus": "<Rabat | Ben Guerir | Virtual | Other>",
  "location_details": "<room, building, or online link>",
  "date": "<YYYY-MM-DD or specific day/date mentioned>",
  "start_time": "<HH:MM in 24h format, or null>",
  "end_time": "<HH:MM in 24h format, or null>",
  "organizer": "<club or department name, e.g., Forgebots, 1337, UM6P>",
  "tags": ["<relevant tags such as AI, Workshop, Sports, Hackathon>"],
  "summary": "<concise 2-sentence summary in English>",
  "action_url": "<registration or submission URL, or null>"
}
Do not include backticks, markdown markers, or commentary. Output raw JSON only.
"""

class AnnouncementExtractor:
    def __init__(self, api_key: str = None):
        self.api_key = api_key or os.environ.get("GEMINI_API_KEY")
        self.client = genai.Client(api_key=self.api_key)
        self.model_id = "gemma-4-26b-a4b-it"

    def extract_from_image(self, image_path: str):
        img = Image.open(image_path)
        response = self.client.models.generate_content(
            model=self.model_id,
            contents=[img, EXTRACTION_SYSTEM_PROMPT],
            config=types.GenerateContentConfig(
                temperature=0.1,
                response_mime_type="application/json"
            )
        )
        data = json.loads(response.text)
        # Flatten if it's a single-item list
        if isinstance(data, list) and len(data) == 1:
            return data[0]
        return data

    def extract_from_text(self, text_payload: str):
        prompt = f"{EXTRACTION_SYSTEM_PROMPT}\n\nAnnouncement content:\n{text_payload}"
        response = self.client.models.generate_content(
            model=self.model_id,
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.1,
                response_mime_type="application/json"
            )
        )
        data = json.loads(response.text)
        if isinstance(data, list) and len(data) == 1:
            return data[0]
        return data