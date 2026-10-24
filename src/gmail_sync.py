import imaplib
import email
from email.header import decode_header
import json
import os
from google import genai
from google.genai import types

CLASSIFY_AND_EXTRACT_PROMPT = """
You are UniRadar's Campus Email Filter.
Analyze this raw email text. 
First, decide if this email is an announcement for an event, hackathon, workshop, conference, club meeting, or academic competition.
If it is NOT an event (e.g. personal correspondence, spam, newsletters, password resets, simple chat), return:
{"is_event": false}

If it IS an event, return:
{
  "is_event": true,
  "title": "<event name>",
  "campus": "<Rabat | Ben Guerir | Virtual | Other>",
  "location_details": "<room, hall, or Teams/Zoom link>",
  "date": "<YYYY-MM-DD or date specified>",
  "start_time": "<HH:MM 24h format, or null>",
  "end_time": "<HH:MM 24h format, or null>",
  "organizer": "<club or department name>",
  "tags": ["<relevant tags, e.g. Hackathon, AI, Club>"],
  "summary": "<2-sentence summary in English>",
  "action_url": "<registration URL or null>"
}
Output strictly valid JSON. No markdown fences.
"""

class GmailEventSync:
    def __init__(self, email_user: str, app_password: str):
        self.user = email_user
        self.password = app_password
        self.client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))
        self.model_id = "gemma-4-26b-a4b-it"

    def _get_clean_body(self, msg) -> str:
        body = ""
        if msg.is_multipart():
            for part in msg.walk():
                content_type = part.get_content_type()
                disposition = str(part.get("Content-Disposition"))
                if content_type == "text/plain" and "attachment" not in disposition:
                    charset = part.get_content_charset() or "utf-8"
                    body = part.get_payload(decode=True).decode(charset, errors="ignore")
                    break
        else:
            charset = msg.get_content_charset() or "utf-8"
            body = msg.get_payload(decode=True).decode(charset, errors="ignore")
        return body[:3000]  # truncate to avoid bloated signatures

    def fetch_and_filter_events(self, max_emails: int = 5) -> list:
        events_found = []
        try:
            # Connect to Gmail via IMAP
            mail = imaplib.IMAP4_SSL("imap.gmail.com")
            mail.login(self.user, self.password)
            mail.select("inbox")

            # Search for unread emails or specific campus terms
            status, messages = mail.search(None, '(UNSEEN)')
            email_ids = messages[0].split()

            if not email_ids:
                # If no unread, search for the last few emails with keyword "hackathon" or "UM6P"
                status, messages = mail.search(None, 'OR (BODY "hackathon") (BODY "UM6P")')
                email_ids = messages[0].split()

            # Process latest emails (up to max_emails)
            for e_id in reversed(email_ids[-max_emails:]):
                _, msg_data = mail.fetch(e_id, "(RFC822)")
                for response_part in msg_data:
                    if isinstance(response_part, tuple):
                        msg = email.message_from_bytes(response_part[1])
                        
                        subject, encoding = decode_header(msg["Subject"])[0]
                        if isinstance(subject, bytes):
                            subject = subject.decode(encoding if encoding else "utf-8", errors="ignore")
                        
                        body = self._get_clean_body(msg)
                        raw_payload = f"Subject: {subject}\nSender: {msg.get('From')}\n\nBody:\n{body}"

                        # Send to Gemma 4 for classification + extraction
                        response = self.client.models.generate_content(
                            model=self.model_id,
                            contents=f"{CLASSIFY_AND_EXTRACT_PROMPT}\n\nEmail Content:\n{raw_payload}",
                            config=types.GenerateContentConfig(
                                temperature=0.1,
                                response_mime_type="application/json"
                            )
                        )
                        parsed = json.loads(response.text)

                        # If Gemma verifies it's an event, keep it
                        if parsed.get("is_event"):
                            parsed.pop("is_event", None)
                            events_found.append(parsed)

            mail.close()
            mail.logout()
        except Exception as e:
            print(f"[!] Gmail sync error: {e}")

        return events_found