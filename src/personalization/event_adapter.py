"""The small, explicit mapping contract with the Gmail ingestion developer."""

from .models import Event

ALIASES = {
    "id": ("event_id",),
    "title": ("name",),
    "description": ("summary",),
    "event_type": ("type", "category"),
    "topics": ("tags",),
    "campus": ("campus_name",),
    "location": ("venue",),
    "start_datetime": ("start", "start_time"),
    "end_datetime": ("end", "end_time"),
    "registration_deadline": ("deadline",),
    "registration_url": ("registration_link",),
    "source_id": ("email_id", "message_id"),
    "source_url": ("email_url",),
}
CAMPUS_NAMES = {
    "rabat": "Rabat",
    "ben guerir": "Ben Guerir",
    "benguerir": "Ben Guerir",
    "benguérir": "Ben Guerir",
    "ben guérir": "Ben Guerir",
    "online": "Online",
    "virtual": "Online",
    "other": "Other",
    "unknown": "Unknown",
}


def adapt_event(record: object) -> Event:
    from src.models import Announcement
    if isinstance(record, Announcement):
        record = record.model_dump(mode="json")
    if not isinstance(record, dict):
        raise ValueError("Record must be a JSON object")
    data = {}
    for field in Event.model_fields:
        for source in (field, *ALIASES.get(field, ())):
            if source in record:
                data[field] = record[source]
                break
    for field, value in data.items():
        if field not in ("id", "title", "topics") and isinstance(value, str) and not value.strip():
            data[field] = None
    if isinstance(data.get("campus"), str):
        value = data["campus"].strip().casefold()
        data["campus"] = CAMPUS_NAMES.get(value, data["campus"])
    if isinstance(data.get("topics"), str):
        data["topics"] = [topic.strip() for topic in data["topics"].split(",") if topic.strip()]
    if data.get("topics") is None:
        data["topics"] = []
    return Event.model_validate(data)
