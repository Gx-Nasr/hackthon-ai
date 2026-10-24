"""Import incoming JSON into SQLite. Run: python -m src.personalization.event_importer."""

import json
import os
from pathlib import Path

from pydantic import ValidationError

from . import PROJECT_ROOT
from .database import Database, get_database
from .event_adapter import adapt_event
from .models import ImportSummary, ImportWarning


class EventImportError(ValueError):
    """A file-level failure, safe to display without paths or source contents."""


def configured_events_path() -> Path:
    path = Path(os.getenv("EVENTS_JSON_PATH") or "data/events.json").expanduser()
    return path if path.is_absolute() else PROJECT_ROOT / path


def import_events(database: Database, path: str | Path | None = None) -> ImportSummary:
    try:
        with Path(path or configured_events_path()).open(encoding="utf-8") as source:
            payload = json.load(source)
    except (OSError, UnicodeError, ValueError, RecursionError):
        raise EventImportError("Configured event file is unreadable or is not valid JSON") from None
    records = payload.get("events") if isinstance(payload, dict) else payload
    if not isinstance(records, list):
        raise EventImportError("Expected an array or an object containing an events array")

    valid_events = []
    warnings = []
    seen = set()
    for index, record in enumerate(records):
        try:
            event = adapt_event(record)
            if event.id in seen:
                raise ValueError("Duplicate event ID within this file; first valid record kept")
            seen.add(event.id)
            valid_events.append(event)
        except ValidationError as error:
            fields = sorted({".".join(map(str, item["loc"])) or "event" for item in error.errors()})
            warnings.append(ImportWarning(record_index=index, message=f"Invalid fields: {', '.join(fields)}"))
        except ValueError as error:
            warnings.append(ImportWarning(record_index=index, message=str(error)))

    summary = database.upsert_events(valid_events)
    summary.failed = len(warnings)
    summary.warnings = warnings
    return summary


def main() -> None:
    try:
        summary = import_events(get_database())
    except EventImportError as error:
        raise SystemExit(str(error)) from None
    print(summary.model_dump_json(indent=2))


if __name__ == "__main__":
    main()
