# UniRadar — Personalization Backend

Developer 2's standalone Python 3.11+ backend for UM6P-style student profiles,
event imports and personalized recommendations. All application persistence is
local SQLite at **`data/uniradar.db`**. It works without an API key.

## Run locally

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
cp .env.example .env
python -m src.personalization.event_importer
uvicorn main:app --reload --host 127.0.0.1 --no-access-log
```

Open **http://127.0.0.1:8000/docs** for the interactive API and
`/openapi.json` for the frontend's generated types. The database and its tables are
created automatically at API startup or CLI import. The server does not import
JSON on startup; use the CLI command above or the sync endpoint.

`data/events.json` contains **10 explicitly fictional events**. Its dates are
fixed in November 2027, with one deliberately archived event and one undated
event. Adjust fictional dates for a later demo; normal expiry filtering applies.
`data/sample_profile.json` is also fictional. Importing events never creates a
student profile.

### Demo requests

```bash
curl -s http://127.0.0.1:8000/api/health

curl -s -X POST http://127.0.0.1:8000/api/personalization/events/sync

curl -s -X PUT http://127.0.0.1:8000/api/profiles/student_demo \
  -H 'Content-Type: application/json' \
  --data-binary @data/sample_profile.json

curl -s http://127.0.0.1:8000/api/profiles/student_demo

curl -s 'http://127.0.0.1:8000/api/recommendations/student_demo?limit=5'
```

The first sync returns:

```json
{"inserted":10,"updated":0,"unchanged":0,"failed":0,"warnings":[]}
```

Reimporting it returns `unchanged: 10`. Counts describe records in this import,
not the total number of stored events.

## Configuration and Gemma 4

| Environment variable | Meaning |
| --- | --- |
| `GEMINI_API_KEY` | Google API key; empty means deterministic offline fallback |
| `GEMMA_MODEL` | Exact API model name; empty also selects fallback |
| `EVENTS_JSON_PATH` | Incoming file; default `data/events.json`, relative to the project root |

`.env` is read from the project root without overriding existing environment
variables. Restart the server after editing it. No database environment setting
is needed: production persistence stays at `data/uniradar.db`; tests inject a
temporary SQLite repository.

Google's [Gemma-on-Gemini-API documentation](https://ai.google.dev/gemma/docs/core/gemma_on_gemini_api)
currently lists `gemma-4-26b-a4b-it` and `gemma-4-31b-it` (checked October 24,
2026). `.env.example` uses the former. Account access is verified through
`client.models.get()` before uncached model ranking; model availability is not
assumed. To inspect models accessible to your own account:

```bash
python - <<'PY'
import os
from dotenv import load_dotenv
from google import genai

load_dotenv('.env')
with genai.Client(api_key=os.environ['GEMINI_API_KEY']) as client:
    for model in client.models.list():
        if 'gemma' in (model.name or '').lower():
            print(model.name, model.supported_actions)
PY
```

The implementation uses the [Google GenAI SDK](https://googleapis.github.io/python-genai/)
and its typed generation/HTTP configuration:

- Batches of 20 events; one generation call per batch.
- Structured JSON schema is attempted first. An explicit unsupported-schema
  response switches to prompt-based JSON for the remaining batches.
- Pydantic checks scores, exact event coverage, duplicate IDs, interest ownership
  and unexpected fields. Invalid or incomplete output falls back for the entire
  request, consistently setting `ranking_mode: "fallback"`.
- Missing configuration, credential errors, unavailable models, rate limits,
  timeouts and invalid JSON all select the same offline fallback. SDK calls have
  a 15-second timeout and one attempt; a schema-capability retry is separate.
- Only semantic profile fields and event text are sent. User IDs, schedules,
  campuses, URLs and event times are excluded from the model prompt. Event text
  is explicitly untrusted. No tools are available to the model, and its output
  cannot modify canonical events, attendance decisions or final score weights.
- Reasons are short semantic explanations. They are model-generated plain text;
  the frontend should render all imported/model text as text, never raw HTML.

Offline relevance uses case-insensitive whole-token overlap, weighted across
interests (3), skills (1), goals (1) and academic fields (1), normalized over the
fields actually supplied. It has no external calls or persistent JSON storage.

## API contract

All routes already include `/api` in the exported router.

| Method | Path | Behavior |
| --- | --- | --- |
| `PUT` | `/api/profiles/{user_id}` | Create or fully replace a validated profile |
| `GET` | `/api/profiles/{user_id}` | Read a saved profile; 404 if missing |
| `POST` | `/api/personalization/events/sync` | Import the administrator-configured file |
| `GET` | `/api/recommendations/{user_id}?limit=5` | Rank a saved profile against SQLite events |
| `POST` | `/api/recommendations/rank` | Rank an explicit profile and optional events, without saving them |
| `GET` | `/api/health` | Basic status, with no private configuration |

`PUT` is a full replacement, not a patch: submit the whole onboarding form on
updates. The body may omit `user_id`; if present it must match the URL. Missing
academic fields remain `null`, missing lists become `[]`, and unknown travel
willingness remains `null`. The saved response is the complete canonical profile.

Minimal structured form example:

```json
{
  "user_id": "student_001",
  "campus": "Rabat",
  "school": "Computing Department",
  "major": "Computer Science",
  "academic_year": "2",
  "interests": ["robotics", "AI"],
  "skills": ["Python", "teamwork"],
  "goals": ["internships"],
  "preferred_event_types": ["hackathon", "workshop"],
  "languages": ["English", "French"],
  "willing_to_travel": true,
  "availability": {
    "timezone": "Africa/Casablanca",
    "is_complete": true,
    "weekly_busy": [
      {"weekday": 0, "start_time": "09:00", "end_time": "12:00"}
    ],
    "date_specific_busy": [
      {"start_datetime": "2027-11-16T14:00:00+01:00", "end_datetime": "2027-11-16T16:00:00+01:00"}
    ]
  }
}
```

**Schedule semantics:** `weekday` is Monday=0 through Sunday=6. Weekly times use
the supplied IANA timezone, defaulting to `Africa/Casablanca`. An end clock time
earlier than its start means overnight into the next day; equal times are invalid.
Date-specific intervals require both datetimes. Both kinds of busy intervals are
combined. `is_complete: true` means the student has confirmed all busy intervals;
an empty complete schedule means free. Missing/incomplete schedules never imply
confirmed availability. A known overlap still counts as a clash with an incomplete
schedule. Overlap uses half-open intervals: one event ending when a busy interval
starts is not a clash. No event duration is guessed. Recurring DST ambiguity is
treated conservatively as uncertain unless every possible interval clashes.

Dates are normalized to UTC for storage and API responses. Naive datetimes are
interpreted with `zoneinfo.ZoneInfo("Africa/Casablanca")`, following installed
timezone rules rather than a fixed UTC offset. Ambiguous or nonexistent naive
local times need an explicit offset. Bare dates and numeric timestamps are
rejected: converting them would invent a time. Unknown event fields may be `null`.

`limit` is 1–500 when supplied. `total_events` counts eligible events **before**
limiting; known-ended events are excluded. Equal scores sort by event ID for
stable results. Omitting `events` in the rank request reads SQLite; passing `[]`
explicitly means rank nothing. Explicit event IDs must be unique. Inline ranking
does not create profiles, import events or change recommendation caches.

Validation errors return 422; missing students return 404. File-level sync
failures return 400 without exposing filesystem paths. Individual invalid event
records produce 200 with `failed` and zero-based `warnings[].record_index`; valid
records still import. Sync accepts no caller-controlled filesystem path.

### Self-contained ranking example

```bash
curl -s -X POST http://127.0.0.1:8000/api/recommendations/rank \
  -H 'Content-Type: application/json' \
  -d '{
    "profile": {
      "user_id": "student_001", "campus": "Rabat",
      "interests": ["robotics"], "skills": ["Python"],
      "preferred_event_types": ["hackathon"],
      "availability": {"is_complete": true}
    },
    "events": [{
      "id": "demo_robotics", "title": "Fictional Robotics Hackathon",
      "description": "Build robots with Python.",
      "event_type": "hackathon", "topics": ["robotics", "Python"],
      "campus": "Rabat"
    }]
  }'
```

Without an API key, this returns the following complete response schema:

```json
{
  "user_id": "student_001",
  "total_events": 1,
  "ranking_mode": "fallback",
  "recommendations": [{
    "event_id": "demo_robotics",
    "event": {
      "id": "demo_robotics",
      "title": "Fictional Robotics Hackathon",
      "description": "Build robots with Python.",
      "event_type": "hackathon",
      "topics": ["robotics", "Python"],
      "campus": "Rabat",
      "location": null,
      "start_datetime": null,
      "end_datetime": null,
      "registration_deadline": null,
      "registration_url": null,
      "source_id": null,
      "source_url": null
    },
    "score": 87,
    "score_breakdown": {
      "semantic_relevance": 50,
      "event_type": 10,
      "campus": 15,
      "schedule": 10,
      "timing": 2
    },
    "badge": "UNCERTAIN",
    "flags": ["SCHEDULE_UNKNOWN", "TIME_UNKNOWN", "UNCERTAIN"],
    "reason": "Keyword match with your interests: robotics",
    "matched_interests": ["robotics"]
  }]
}
```

## Deterministic scoring and badges

| Component | Rule |
| --- | --- |
| Semantic / 50 | Validated Gemma or fallback relevance (0–5) × 10 |
| Event type / 10 | 10 for a case-insensitive match to a preferred type; otherwise 0 |
| Campus / 15 | Same known campus or online: 15; other known campus: 8 if willing to travel, 0 if not, 4 if unknown; unknown campus: 7 |
| Schedule / 20 | Confirmed free: 20; confirmed clash: 0; incomplete schedule or unknown duration: 10 |
| Timing / 5 | Starts within 7 days: 5; within 30: 3; later: 1; unknown start: 2; already started or registration closed: 0 |

Scores are clamped to 0–100. Events with a known end at or before the current time
are excluded. A past start without an end is retained as uncertain. `Other` is not
a known campus identity, even when both student and event say `Other`. Missing
URLs or venues stay missing; no transport availability is inferred.

Primary badge precedence is **SCHEDULE_CLASH → CROSS_CAMPUS → UNCERTAIN → ACTIONABLE**.
`flags` retains all applicable conditions. Uncertainty details include
`CAMPUS_UNKNOWN`, `TRAVEL_UNKNOWN`, `SCHEDULE_UNKNOWN`, `TIME_UNKNOWN`,
`ALREADY_STARTED` and `REGISTRATION_CLOSED`. Any of these also adds `UNCERTAIN`.
`ACTIONABLE` means compatible under the supplied information, not guaranteed
admission or verified transport.

## SQLite and cache behavior

`database.py` owns SQL, connections and transactions. `initialize_database()`
returns a `Database` repository; its methods are `save_student`, `get_student`,
`update_student`, `upsert_events`, `get_all_events`, `get_event_by_id`,
`get_cached_recommendations` and `save_recommendation_cache`. `save_student` is an
upsert; `update_student` requires an existing row. All values are parameterized.

Connections enable foreign keys and a 10-second busy timeout. Initialization
enables WAL and creates tables/indexes idempotently. Multi-row imports are one
transaction, with rollback on a storage failure. Lists and availability are JSON
**inside SQLite TEXT columns**, not separate persistent JSON files. Indexes cover
event campus, start time and source; the unique cache user ID is indexed by SQLite
and references `students` with cascading deletion.

One latest full ranking per student is cached in SQLite, independent of API
`limit`. SHA-256 fingerprints include the validated profile, sorted candidate
event content, model/configuration, prompt, scoring configuration and exact
timing states. Profile changes invalidate that student's cache; event inserts or
updates invalidate all caches in the same transaction. Identical upserts preserve
the cache. Time-boundary changes invalidate it even within the TTL. Successful
Gemma results expire after 15 minutes; fallback results after 60 seconds, allowing
recovery from transient model failures. Cache contents are validated on read.
Bump the algorithm version constants when changing fallback/scoring logic.

SQLite databases, WAL/journal files, `.env`, and non-sample data files are ignored
by Git. Only the fictional sample exchange files and schema code belong in source
control. Runtime creation is intentional; no generated database is committed.

## Team integration

### Developer 1 — Gmail ingestion

Write either `[{...}, {...}]` or `{"events": [{...}, {...}]}` to the configured
JSON file, then call sync. Write to a temporary sibling file and atomically rename
it over the configured file to avoid readers observing partially written JSON.

Use a **stable unique ID per event**, such as `gmail:<message_id>:<event_index>`
with a stable event index. Keep that ID when correcting an event. `source_id`
alone is not an event ID because one email may contain several events. Records
without IDs fail validation rather than receiving an unstable generated ID.
Duplicate IDs within one input file are reported; the first valid record wins.
Omitting an event from a later file does not delete it. An updated record replaces
its canonical content, so include the complete extracted record on each import.

Use the canonical Event names shown above. The adapter also accepts these explicit
aliases; canonical fields take precedence when present:

| Canonical | Accepted aliases |
| --- | --- |
| `id` | `event_id` |
| `title` | `name` |
| `description` | `summary` |
| `event_type` | `type`, `category` |
| `topics` | `tags` (array or comma-separated string) |
| `campus` | `campus_name` |
| `location` | `venue` |
| `start_datetime` | `start`, `start_time` |
| `end_datetime` | `end`, `end_time` |
| `registration_deadline` | `deadline` |
| `registration_url` | `registration_link` |
| `source_id` | `email_id`, `message_id` |
| `source_url` | `email_url` |

Additional ingestion metadata is ignored. Campuses normalize case and common
`Benguerir`/`Benguérir` spellings; `virtual` maps to `Online`. Canonical campus
values are `Rabat`, `Ben Guerir`, `Other`, `Online`, `Unknown`, or `null`.
Unrecognized campus names are reported rather than silently guessed. Empty
optional strings become `null`; registration/source URLs must be HTTP(S).

### Developer 3 — frontend and main application

Use the profile and recommendation endpoints above. Import this router once:

```python
from fastapi import FastAPI
from src.personalization.routes import router

app = FastAPI()
app.include_router(router)  # Already includes /api; do not add it again.
```

The repository initializes lazily through its FastAPI dependency; the standalone
`main.py` also initializes it at startup. Keep ownership of these routes here.
The host application owns authentication, authorization and CORS. This standalone
demo has no authentication: before exposing real profiles, the host must enforce
student ownership for profile/recommendation routes and restrict sync to the
ingestion team. Use the localhost command above for independent development.
Disable/redact access logging in the host because URL paths contain user IDs;
this module does not log model prompts, student bodies, credentials or SDK errors.

### Developer 4 — chatbot

Use the same HTTP profile/recommendation endpoints or these synchronous Python
services. No chatbot-specific route or response format is introduced:

```python
from src.personalization.database import get_database
from src.personalization.profile_service import get_profile
from src.personalization.recommender import Recommender

database = get_database()
profile = get_profile(database, "student_demo")  # KeyError if missing
events = database.get_all_events()
event = database.get_event_by_id("fictional_robotics_001")  # None if missing
result = Recommender(database).recommend(profile.user_id, limit=5)
payload = result.model_dump(mode="json")
```

`Recommender.rank(profile, events=None, limit=None)` is available for unsaved
profiles. All API and Python callers share `RecommendationResponse` from
`models.py`. Services are synchronous; async hosts should run them in a worker
thread (FastAPI already does this for the supplied synchronous routes).

## Tests

```bash
python -m pytest -q
python -m pip check
```

Tests use temporary SQLite files, not `data/uniradar.db`, and mock the Google SDK.
They cover profile CRUD/validation, JSON list round trips, parameterized SQL,
foreign keys, transaction rollback, idempotent imports, invalid records, campus
and schedule checks, overnight/DST boundaries, unknown times, expiry, semantic
batch validation, SDK failures, sorted responses, API contracts and cache
invalidation/recovery. No API key is needed. The installed SDK's configuration
types are exercised by the mocked integration tests; live account access is
checked only when you configure and run real ranking.

The optional free-text profile draft endpoint and automatic file watching are
omitted from this MVP. Structured onboarding and explicit synchronization are
the supported paths.
