# UniRadar — UM6P Campus Intelligence Radar

> **Unified Release:** `release/v1-uniradar`  
> React Dashboard + Authenticated Node Gateway + Python Hybrid RAG (Dense + BM25s) + Multimodal Flyer/Email Ingestion + Personalized Schedule Conflict Detection + RFC 5545 Calendar Sync.

---

## 🚀 Quick Start: Run in 1 Command

### Prerequisites
- **Python 3.11+** (tested on 3.12)
- **Node.js 22+** and **npm**

### 1. Configure `.env`
Ensure `.env` exists in the project root with your Gemini API key:
```bash
GEMINI_API_KEY="your-google-ai-studio-key"
GEMINI_MODEL=gemini-3-flash-preview
```
*(Tip: `gemini-3-flash-preview` is recommended for low latency and high free-tier quota).*

### 2. Launch Services
From the repository root, run:

```bash
python3 scripts/run.py
```

This single command automatically:
- Creates `.venv` and installs Python dependencies.
- Installs Node dependencies and deploys SQLite Prisma migrations.
- Compiles TypeScript and builds the React frontend.
- Starts both services:
  - **Node Web Gateway**: `http://localhost:3000`
  - **Python AI Engine**: `http://127.0.0.1:8000`

👉 **Open [http://localhost:3000](http://localhost:3000)**, create an account, and complete your campus/availability onboarding. Press `Ctrl+C` anytime to shut down all processes cleanly.

---

## ⚡ Verify in 1 Command (Test Suite)

Run the automated test and smoke suite:

```bash
python3 scripts/run.py --test
```

Or run individual test modules:
```bash
# Run all 98 pytest unit & integration tests
.venv/bin/python -m pytest tests/ -v

# Run the backend terminal demo
.venv/bin/python scripts/demo_backend.py --offline

# Verify frontend types and production build
npm run typecheck
npm run build
```

---

## 🎯 Key Features & Walkthrough

1. **Multimodal Ingestion (Radar → Add Announcement)**:
   - Upload any event poster (`.png`, `.jpg`, `.jpeg`, `.webp`), PDF brochure, or paste an email body.
   - The AI extractor normalizes dates to Casablanca time (`Africa/Casablanca`), extracts venues, tags, and registration links.
2. **Personalized Radar & Conflict Detection**:
   - Compares incoming events against the student's home campus and recurring course commitments:
     - 🟢 **Actionable for You**: On your campus and schedule is free.
     - 🟡 **Cross-Campus Alert**: Event is on another campus (e.g., Rabat ↔ Ben Guerir ONCF commute needed).
     - 🔴 **Schedule Clash**: Directly conflicts with a lecture, exam, or lab slot.
3. **Trilingual Campus Memory Chatbot**:
   - Ask natural language questions in **Moroccan Darija** (`wach kayn chi hackathon f rabat had weekend?`), **French** (`Où se déroule le workshop de robotique Forgebots ?`), or **English** (`Where is the coding battle?`).
   - Cites exact campus events with 1-click `.ics` calendar sync links.
   - **Zero-hallucination constraint**: Queries for nonexistent cities (e.g. Marrakech) return an honest negative answer.
4. **1-Click RFC 5545 Calendar Sync**:
   - Download `.ics` files to immediately sync events with Google Calendar, Apple Calendar, or Outlook.

---

## 🎥 Demo Walkthrough Videos

Recorded live demonstrations showing UniRadar in action:
- **UI & Dashboard Walkthrough**: [`Screencast from 2026-10-24 17-00-37.mp4`](file:///home/khalil/Desktop/salah_dirs/hackthon-ai/Screencast%20from%202026-10-24%2017-00-37.mp4) (Navigation, calendar onboarding, and radar overview)
- **Interactive Features Demo**: [`Screencast from 2026-10-24 17-02-18.mp4`](file:///home/khalil/Desktop/salah_dirs/hackthon-ai/Screencast%20from%202026-10-24%2017-02-18.mp4) (Flyer upload extraction, trilingual Darija/FR/EN chat, and 1-click .ics export)

---

## 📬 Note on Gmail Automatic Sync Feature

- **Intended Feature**: Background synchronization of campus email announcements directly from university mailboxes via the Gmail / IMAP API.
- **Current Status**:
  - The classification prompt and event extraction logic are fully built in [`src/gmail_sync.py`](file:///home/khalil/Desktop/salah_dirs/hackthon-ai/src/gmail_sync.py) and available in the Streamlit companion interface (`app.py`).
  - **Hackathon Time Constraint**: Due to the strict hackathon time limits, unattended 24/7 OAuth background inbox polling was scoped as a post-hackathon roadmap milestone. We prioritized perfecting **live multimodal poster extraction**, **trilingual RAG accuracy**, and **personal schedule clash detection**.
  - In the current web UI, students can instantly paste any university email text via **Radar → Add Announcement → Paste text**, which utilizes the exact same parsing and indexing pipeline.

---

## 🛠️ Architecture & Integration Map

```
                    Browser / Student
                            │
                            ▼
              ┌───────────────────────────┐
              │  Node / Express Gateway   │  (Port 3000)
              │  - React 19 / Vite UI     │
              │  - Session Auth & Prisma  │
              └─────────────┬─────────────┘
                            │ (forwards authenticated profile)
                            ▼
              ┌───────────────────────────┐
              │  FastAPI Python Backend   │  (Port 8000)
              │  - Gemini Multimodal      │
              │  - Hybrid RAG (MiniLM+BM25│
              │  - Conflict Detector      │
              │  - RFC 5545 Calendar Gen  │
              └───────────────────────────┘
```

- **`src/retriever.py`**: Strict hybrid retrieval (all-MiniLM-L6-v2 embeddings + BM25s with location filtering).
- **`src/advisor.py`**: Trilingual advisor handling Darija (Arabizi/Arabic), French, and English with fallback resilience.
- **`src/extractor.py`**: Multimodal poster & email parsing with automatic model failover (`gemini-3-flash-preview` / `gemini-flash-latest`).
- **`src/personalization/`**: SQLite-backed recommendation and student constraint scoring.
- **`src/calendar_gen.py`**: RFC 5545 `.ics` generator with Africa/Casablanca timezones.
- **`server/src/routes/campus.ts`**: Proxies authenticated user profiles from Node to FastAPI.

---

## 🐍 Standalone Streamlit Interface (Optional)

To explore the backend inspection tool with the three original tabs:

```bash
.venv/bin/python -m streamlit run app.py
```
