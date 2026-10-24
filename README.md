# 📡 UniRadar: The Multimodal Anti-Chaos Campus Engine for UM6P

> **Transforming dense UM6P emails, WhatsApp flyers, and club forwards into a structured, conflict-aware, trilingual campus memory.**

---

## 🌟 The Problem & The UM6P Reality

At UM6P (Mohammed VI Polytechnic University), students across **Rabat** and **Ben Guerir** face daily information fragmentation:
1. **Multimodal Chaos**: Official announcements arrive as dense French/English Outlook emails, while club workshops (like *Forgebots*, robotics, or hackathons) circulate on WhatsApp and Instagram as graphic posters with zero selectable text.
2. **Cross-Campus Confusion**: Students in Rabat constantly receive emails meant for Ben Guerir (or vice versa), leading to missed shuttles, ONCF train commute issues, or accidental cross-campus travel.
3. **Schedule Clashes**: Academic defense preps, mandatory lab sessions, and midterm schedules regularly clash with high-value club events without any automated warning.
4. **Trilingual Language Gap**: Students naturally search and inquire in **Moroccan Darija** (*"wach kayn chi hackathon f rabat had weekend?"*), **French**, or **English**.

---

## 💡 The Three Creative Twists

### 1. "Drop Anything" Multimodal Ingestion (Flyers + Emails + WhatsApp)
- Ingests image flyers (PNG, JPG), PDF announcements, and raw text/email pastes.
- Extracts visual layouts, dates, times, venues, target schools, registration links, and organizers into structured JSON event cards.

### 2. The "Rabat $\leftrightarrow$ Ben Guerir" Conflict & Commute Detector
A personal radar comparing every announcement against the student's profile (`config/student_profile.json`):
- 🟢 **Actionable for You:** Event is in your home campus and you are completely free.
- 🟡 **Cross-Campus Alert:** Event is hosted on the other campus (e.g. Ben Guerir) — alerts student to take the ONCF train (~2h30) or use a Teams/virtual link.
- 🔴 **Schedule Clash:** Automated detection of overlaps with mandatory lab sessions, midterms, or recurring lectures.

### 3. Trilingual "Campus Memory" Hybrid RAG (Darija + French + English)
- **Hybrid Search Engine**: Combines Dense Semantic Retrieval (`sentence-transformers/all-MiniLM-L6-v2`) and Lexical Search (`bm25s`) with Reciprocal Rank Fusion.
- **Trilingual Conversational Advisor**: Grounded question answering in Moroccan Darija (Arabizi & Arabic script), French, and English.
- **1-Click `.ics` Calendar Sync**: Instantly generate and download RFC 5545 iCalendar files for Google Calendar, Outlook, and Apple Calendar.

---

## 🏗️ Architecture

```
UniRadar/
├── LICENSE                     # Apache-2.0 License (Gate 03 Compliant)
├── README.md                   # Project documentation
├── requirements.txt            # Python dependencies (google-genai, sentence-transformers, bm25s, etc.)
├── .gitignore                  # Git hygiene (ignoring .venv, caches, credentials)
├── .env.example                # Template for GEMINI_API_KEY
├── config/
│   ├── campus_config.json      # UM6P Rabat & Ben Guerir campus map, venues & commute rules
│   └── student_profile.json    # Student schedule, home campus, and commitments
├── data/
│   ├── sample_announcements.json # 10 high-fidelity UM6P sample announcements (emails + flyers)
│   └── calendars/              # Generated .ics files for 1-click sync
├── src/
│   ├── models.py               # Shared Pydantic contracts (Announcement, ConflictBadge, StudentProfile)
│   ├── extractor.py            # Multimodal extraction interfaces and JSON loaders
│   ├── retriever.py            # Hybrid dense (MiniLM) + lexical (BM25s) search with local caching
│   ├── advisor.py              # Conflict & commute detector + Trilingual Darija/FR/EN RAG advisor
│   └── calendar_gen.py         # RFC 5545 iCalendar generator
├── scripts/
│   └── demo_backend.py         # Interactive terminal demo for judges and team
└── tests/
    └── test_backend.py         # Automated pytest test suite
```

---

## 👥 Team Workstreams & Git Collaboration Strategy

To guarantee **zero merge conflicts** during the hackathon:
| Workstream | Owner | Branch | Core Responsibilities |
|---|---|---|---|
| **Backend 2 (Active)** | RAG, Chatbot & Personalization | `feature/backend-rag-chatbot` | Hybrid retrieval (`retriever.py`), Conflict detector & Trilingual Q&A (`advisor.py`), Calendar generator (`calendar_gen.py`), Contracts (`models.py`) |
| **Backend 1** | Ingestion & Multimodal Extractor | `feature/backend-multimodal-extractor` | Flyer & Email extraction (`extractor.py`), OCR / Gemini multimodal parsing |
| **Frontend** | UI & User Experience | `feature/frontend-ui` | Streamlit app (`app.py`), drag-and-drop dropzone, radar badges feed, chat interface |

> All components strictly adhere to the contracts defined in [`src/models.py`](src/models.py).

---

## 🚀 Quick Start Guide

### 1. Environment Setup
```bash
# Clone the repository
git clone https://github.com/Gx-Nasr/hackthon-ai.git
cd hackthon-ai

# Checkout your feature branch
git checkout feature/backend-rag-chatbot

# Create and activate Python virtual environment
python3 -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### 2. Configure Environment (Optional for Live Gemini LLM)
```bash
cp .env.example .env
# Edit .env and paste your GEMINI_API_KEY
```
*(Note: UniRadar includes intelligent rule-based trilingual fallbacks that run offline if no API key is provided!)*

### 3. Run Automated Tests
```bash
python -m pytest tests/test_backend.py -v
```

### 4. Run Live Backend Demo
```bash
python scripts/demo_backend.py
```

---

## 📄 License
This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.
