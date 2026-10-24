# 📡 UniRadar: The Multimodal Anti-Chaos Campus Engine for UM6P

> **Transforming dense UM6P emails, WhatsApp flyers, and club forwards into a structured, conflict-aware, trilingual campus memory.**

---

## 🌟 1. The Problem & The UM6P Reality

At UM6P (Mohammed VI Polytechnic University), students across **Rabat** and **Ben Guerir** face daily information fragmentation:
1. **Multimodal Chaos**: Official announcements arrive as dense French/English Outlook emails, while club workshops (like *Forgebots*, robotics, or hackathons) circulate on WhatsApp and Instagram as graphic posters with zero selectable text.
2. **Cross-Campus Confusion**: Students in Rabat constantly receive emails meant for Ben Guerir (or vice versa), leading to missed shuttles, ONCF train commute issues, or accidental cross-campus travel.
3. **Schedule Clashes**: Academic defense preps, mandatory lab sessions, and midterm schedules regularly clash with high-value club events without any automated warning.
4. **Trilingual Language Gap**: Students naturally search and inquire in **Moroccan Darija** (*"wach kayn chi hackathon f rabat had weekend?"*), **French**, or **English**.

---

## 💡 2. The Three Creative Twists (Hook for the Jury)

### Twist 1: "Drop Anything" Multimodal Ingestion (Flyers + Emails + WhatsApp)
- Ingests image flyers (PNG, JPG), PDF announcements, and raw text/email pastes.
- Extracts visual layouts, dates, times, venues, target schools, registration links, and organizers into structured JSON event cards.

### Twist 2: The "Rabat $\leftrightarrow$ Ben Guerir" Conflict & Commute Detector
A personal radar comparing every announcement against the student's profile (`config/student_profile.json`):
- 🟢 **Actionable for You:** Event is in your home campus (e.g. Rabat) and you are completely free.
- 🟡 **Cross-Campus Alert:** Event is hosted on the other campus (e.g. Ben Guerir) — alerts student to take the ONCF train (~2h30) or use a Teams/virtual link.
- 🔴 **Schedule Clash:** Automated detection of overlaps with mandatory lab sessions, midterms, or recurring lectures.

### Twist 3: Trilingual "Campus Memory" Hybrid RAG (Darija + French + English)
- **Hybrid Search Engine**: Combines Dense Semantic Retrieval (`sentence-transformers/all-MiniLM-L6-v2`) and Lexical Search (`bm25s`) with Reciprocal Rank Fusion.
- **Trilingual Conversational Advisor**: Grounded question answering in Moroccan Darija (Arabizi & Arabic script), French, and English powered by Gemini 2.5 Flash / Gemma.
- **1-Click `.ics` Calendar Sync**: Instantly generate and download RFC 5545 iCalendar files for Google Calendar, Outlook, and Apple Calendar.

---

## 🏗️ 3. Repository Architecture

```
UniRadar/
├── LICENSE                     # Apache-2.0 License (Gate 03 Compliant)
├── README.md                   # Full documentation & team integration contracts
├── requirements.txt            # Python dependencies (google-genai, sentence-transformers, bm25s, etc.)
├── .gitignore                  # Git hygiene (ignoring .venv, caches, credentials, .ics files)
├── .env.example                # Template for GEMINI_API_KEY and GEMINI_MODEL
├── config/
│   ├── campus_config.json      # UM6P Rabat & Ben Guerir campus map, venues & commute rules
│   └── student_profile.json    # Student schedule, home campus, school & commitments
├── data/
│   ├── sample_announcements.json # 10 high-fidelity UM6P sample announcements (emails + flyers)
│   ├── sample_posters/         # Event poster images (e.g., Hackathon flyer) for live OCR testing
│   └── calendars/              # Generated .ics files for 1-click sync
├── src/
│   ├── models.py               # Shared Pydantic contracts (Announcement, ConflictBadge, StudentProfile)
│   ├── extractor.py            # Multimodal extraction interfaces and JSON loaders
│   ├── retriever.py            # Strict hybrid dense (MiniLM) + lexical (BM25s) search with local caching
│   ├── advisor.py              # Conflict & commute detector + Trilingual Darija/FR/EN RAG advisor
│   └── calendar_gen.py         # RFC 5545 iCalendar generator (.ics)
├── scripts/
│   └── demo_backend.py         # Interactive terminal demo for judges and team
└── tests/
    └── test_backend.py         # Automated pytest test suite (10/10 passing)
```

---

## 🤖 4. OpenCode & Agent Data Linking Guide

UniRadar is designed to be fully linkable with **OpenCode** CLI agents, Model Context Protocol (MCP) servers, and automated pipelines.

### Data Assets Linked to OpenCode:
| Asset File | OpenCode Role / Target | Description |
|---|---|---|
| [`config/student_profile.json`](config/student_profile.json) | **Personal Context Store** | Supplies the active student's identity, school (e.g. 1337 Coding School / College of Computing), home campus, and busy time slots to OpenCode agents. |
| [`config/campus_config.json`](config/campus_config.json) | **Campus Knowledge Base** | Contains UM6P campus taxonomy (Rabat vs Ben Guerir, venues, buildings, shuttle commute buffers). |
| [`data/sample_announcements.json`](data/sample_announcements.json) | **Ground-Truth RAG Index** | 10 pre-loaded, verified multimodal UM6P events ready for hybrid retrieval. |
| [`data/sample_posters/`](data/sample_posters/) | **Multimodal Ingestion Bucket** | Sample graphic flyers used to evaluate OpenCode agent vision extraction capabilities. |
| [`.env`](.env) | **Agent Auth Credentials** | Ingested by OpenCode for `GEMINI_API_KEY` and `GEMINI_MODEL=gemini-2.5-flash`. |

### How to Run UniRadar with OpenCode:
You can trigger OpenCode tasks directly against the codebase:
```bash
# 1. Ask OpenCode to verify the hybrid retrieval pipeline
opencode run "Run python -m pytest tests/test_backend.py -v and report status"

# 2. Execute a conversational test via OpenCode
opencode run "Run scripts/demo_backend.py and check that the Darija query returns the AI Hackathon"

# 3. Interactive OpenCode session
opencode --directory .
```

---

## 👥 5. Team Workstreams: What Backend 2 Built & How Teammates Link In

To guarantee **zero merge conflicts**, each team member operates on dedicated files while sharing the strict contract defined in [`src/models.py`](src/models.py).

### 🛠️ What Backend 2 (You) Has Completed & Pushed:
- ✅ **Hybrid Retrieval Engine ([`src/retriever.py`](src/retriever.py))**:
  - Dense search via `sentence-transformers/all-MiniLM-L6-v2` (cached in `data/cache_embeddings.npy`).
  - Lexical search via `bm25s`.
  - Strict location constraint extractor (rejects non-existent campuses like Marrakech with zero hallucinations).
- ✅ **Conflict & Commute Radar ([`src/advisor.py`](src/advisor.py))**:
  - Automatically matches events against `config/student_profile.json`.
  - Flags 🟢 **Actionable for You**, 🟡 **Cross-Campus Alert** (ONCF train commute needed), or 🔴 **Schedule Clash**.
- ✅ **Trilingual Conversational Advisor ([`src/advisor.py`](src/advisor.py))**:
  - Automatic language detection for Moroccan Darija (Arabizi/Arabic script), French, and English.
  - Powered by Gemini 2.5 Flash with sub-second response latency (`thinking_budget=0`).
- ✅ **Calendar Generator ([`src/calendar_gen.py`](src/calendar_gen.py))**:
  - Generates RFC 5545 `.ics` files with automatic 2-hour reminder alarms and venue links.
- ✅ **Full Test Suite ([`tests/test_backend.py`](tests/test_backend.py))**: 10/10 unit tests passing.

---

### 📡 Instructions for Backend Developer 1 (Multimodal Extractor)
1. **Branching**:
   ```bash
   git fetch origin
   git checkout -b feature/backend-multimodal-extractor origin/feature/backend-rag-chatbot
   ```
2. **Where to code**:
   - Only edit [`src/extractor.py`](src/extractor.py) and store raw image flyers in `data/sample_posters/`.
   - **Do NOT modify**: `src/retriever.py`, `src/advisor.py`, `src/calendar_gen.py`.
3. **Contract Requirement**:
   Your extraction function must return an instance of `Announcement` from [`src/models.py`](src/models.py):
   ```python
   from src.models import Announcement
   from src.extractor import save_announcements_to_file

   def extract_from_image(image_path: str) -> Announcement:
       # Extract structured data via Gemini Multimodal / OCR
       return Announcement(...)
   ```
4. **Data Sync**:
   Call `save_announcements_to_file(announcements, "data/sample_announcements.json")`. Backend 2's hybrid retriever will automatically index your newly ingested events on the next query!

---

### 🎨 Instructions for Frontend Developer (Streamlit UI `app.py`)
1. **Branching**:
   ```bash
   git fetch origin
   git checkout -b feature/frontend-ui origin/feature/backend-rag-chatbot
   ```
2. **Where to code**:
   - Create and build `app.py`.
3. **How to connect the 3 Tabs**:
   - **Tab 1: "Drop Anything" Ingestion**:
     Call Backend 1's extractor to ingest uploaded flyers/emails, then reload announcements.
   - **Tab 2: "Smart Radar Feed"**:
     ```python
     from src.extractor import load_announcements_from_file
     from src.models import StudentProfile
     from src.advisor import ConflictDetector
     import json

     profile = StudentProfile(**json.load(open("config/student_profile.json")))
     announcements = load_announcements_from_file("data/sample_announcements.json")
     detector = ConflictDetector(profile)

     for ann in announcements:
         badge = detector.evaluate(ann)
         # Render card with badge.emoji (🟢, 🟡, 🔴) and badge.headline
     ```
   - **Tab 3: "Ask in Darija / FR / EN"**:
     ```python
     from src.retriever import HybridRetriever
     from src.advisor import TrilingualAdvisor
     from src.calendar_gen import generate_ics_bytes

     retriever = HybridRetriever()
     retriever.index_announcements(announcements)
     advisor = TrilingualAdvisor(retriever, profile)

     response = advisor.ask(user_query)
     st.write(response.answer)

     if response.cited_announcements:
         ics_bytes = generate_ics_bytes(response.cited_announcements[0])
         st.download_button("📅 Add to Calendar (.ics)", data=ics_bytes, file_name=response.ics_download_filename)
     ```

---

## 🚀 6. Quick Start & Verification

### 1. Environment Setup
```bash
git clone https://github.com/Gx-Nasr/hackthon-ai.git
cd hackthon-ai

git checkout feature/backend-rag-chatbot

python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 2. Configure API Key
```bash
cp .env.example .env
# Add your GEMINI_API_KEY in .env
```

### 3. Run Automated Tests
```bash
python -m pytest tests/test_backend.py -v
```

### 4. Run Live Backend Demo
```bash
python scripts/demo_backend.py
```

---

## 📄 7. License
This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.
