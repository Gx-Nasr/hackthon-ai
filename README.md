# UniRadar — UM6P campus radar

Integrated release: `release/v1-uniradar`. React dashboard + authenticated Node
gateway + Python hybrid RAG, multimodal ingestion, SQLite personalization and
RFC 5545 calendar downloads. The original React layout and navigation are preserved.

## Jury: run in one command

Requires Python 3.11+ (tested on 3.12), Node.js 22+, npm and internet for the first
dependency/model download. From the repository root:

```bash
python3 scripts/run.py
```

This creates `.venv`, installs dependencies, generates Prisma, applies the two
database migrations, typechecks/builds React, and starts both services.
Open **http://localhost:3000**, create an account, and complete your campus,
interests and weekly availability. Ctrl+C stops both services.

The launcher creates `.env` from `.env.example` only if it does not exist.
For live extraction, set `GEMINI_API_KEY` and `GEMINI_MODEL=gemini-2.5-flash` in
`.env` before launching. Without a key, the seeded radar, personalization,
grounded trilingual chat and calendars still work; extraction returns an explicit
configuration error. An exhausted Gemini quota produces a retryable extraction
error, while chat falls back to grounded responses. `GEMMA_MODEL` optionally enables
AI relevance ranking; leave it blank for deterministic scoring.

## Jury: verify in one command

```bash
python3 scripts/run.py --test
```

Runs installation, migrations, TypeScript checks, production build, all pytest
tests and the terminal demo in offline-LLM mode. The MiniLM model downloads on
first use; subsequent runs can use `HF_HUB_OFFLINE=1` with a populated cache.

Individual checks:

```bash
.venv/bin/python -m pytest tests/ -v
.venv/bin/python scripts/demo_backend.py
.venv/bin/python scripts/demo_backend.py --offline
npm run typecheck
npm run build
```

The integration suite tests image/email/PDF extraction contracts with a stubbed
Google response, actual SQLite persistence across restarts, actual MiniLM + BM25s
search, strict no-match behavior, profile-dependent badges, and parsed `.ics`
downloads. It does not claim to verify live Google extraction or inbox credentials.

## Walkthrough

1. **Radar → Add announcement:** upload a JPG/PNG/WebP/PDF or paste an email.
   Gemini returns a validated `src.models.Announcement`; it is persisted in SQLite
   and becomes available to feed, ranking, search and calendars.
2. **Radar:** cards use the signed-in student's campus and weekly busy times.
   Green = actionable, yellow = cross-campus commute, red = schedule clash.
3. **Chat:** try `wach kayn chi hackathon f rabat had weekend?`,
   `Où se déroule le workshop de robotique Forgebots ?`, or
   `Where is the 1337 coding contest taking place?`. Calendar links appear with
   the cited sources. `wach kayn chi workshop f marrakech?` must return no matches.
4. **Calendar / event details:** existing export actions download the Python
   RFC 5545 calendar, rather than rebuilding it in the browser.

The ten initial announcements are realistic sample fixtures from October–November
2026, not a verified live UM6P feed. Uploaded announcements share the campus feed.

## Python interface

After installation, the preserved three-tab Streamlit interface is available with:

```bash
.venv/bin/python -m streamlit run app.py
```

It uses `config/student_profile.json` and the same persistent announcement store.
Its Gmail expander supports IMAP with a Gmail app password. Outlook messages can
be pasted into ingestion; automated Outlook OAuth synchronization is not included.

For development, run `.venv/bin/python -m uvicorn main:app --host 127.0.0.1 --port 8000`
and `npm run dev` in separate terminals. Set `DATABASE_URL=file:./uniradar.db`
and `COOKIE_MODE=local` in `.env`. `VITE_USE_MOCKS=true` explicitly enables the
original frontend mocks; the release defaults to the connected backend.

## Integration map

- `feature/backend-rag-chatbot`: strict `src/retriever.py`, trilingual
  `src/advisor.py`, `src/calendar_gen.py` and shared `src/models.py` preserved.
- `origin/ichtioui`: extractor, Gmail ingestion, posters and three-tab `app.py`,
  adapted to the canonical Announcement model.
- `origin/azahi`: `src/personalization/` SQLite repository, ranking and tests;
  `src/application.py` maps canonical announcements and student profiles.
- `origin/ui`: React/Vite/Tailwind views, Node auth and Prisma profile storage.
  `server/src/routes/campus.ts` forwards authenticated student context to Python.
- `src/api.py`: `/api/events`, `/api/announcements`, `/api/chat`,
  `/api/events/{id}/calendar`. The original personalization API remains available
  on the private Python service, including `/api/recommendations/{user_id}`.

Node serves React and browser API routes on port 3000. Python binds to loopback
port 8000 and trusts student context from the Node gateway. Keep it private.
Account data lives in `prisma/uniradar.db`; campus announcements, ranking profiles
and recommendations live in `data/uniradar.db`. Databases and credentials are ignored
by Git. The launcher uses the committed npm lockfile; the team's pnpm lockfile is
also retained.

## Release verification / pending assets

- 98 pytest tests pass, including four cross-module integration tests.
- TypeScript checks, production build and both Prisma migrations pass.
- Production HTTP smoke check passes: signup, onboarding, authenticated feed,
  Node-to-Python multipart chat, calendar download and logout. Streamlit renders
  all three tabs without exceptions.
- Terminal demo completes; `--offline` avoids external Gemini quota failures.
- Live Gemini calls encountered HTTP 429 (daily free-tier quota exhausted).
  Re-test real flyer extraction when quota is available.
- Logo recoloring is pending the logo asset. No supplied logo was available during
  integration, so no palette was guessed.
