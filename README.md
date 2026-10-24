# UniRadar 📡 (The Campus Anti-Chaos Engine)

> **Built for Hacktoberfest Hack Day Rabat 2026**
> *College of Computing, Mohammed VI Polytechnic University (UM6P) — Organized by Forgebots, MLH, DEV & DigitalOcean.*

An open-source, edge-first multimodal engine that turns fragmented university announcements—graphic Instagram/WhatsApp flyers, dense French/English Outlook emails, and club notices—into an actionable, conflict-aware radar for students navigating multi-campus life across **Rabat** and **Ben Guerir**.

---

## 1. Problem Statement: The Physical Reality of Campus Chaos

At UM6P and universities across Morocco, critical student opportunities are scattered across disorganized channels:

* **Zero-Searchability Visuals:** Club workshops (Forgebots, robotics, sports) circulate exclusively on Instagram and WhatsApp as graphical posters with zero selectable text.
* **Bilingual & Multi-Campus Noise:** Official administration announcements arrive in dense French or English via Outlook, often targeting the wrong campus (e.g., an EMINES seminar in Ben Guerir that requires a 3.5-hour train ride vs. a College of Computing talk in Rabat).
* **Silent Schedule Clashes:** Students bookmark events only to realize at the last minute that an event clashes with an existing lab defense or lecture.

Existing tools fail because they are either basic "paste-text summarizers" or closed cloud SaaS products that expose student schedules. **UniRadar** fixes this through multimodal edge intelligence, trilingual memory retrieval (Darija + French + English), and automatic campus transit reasoning.

---

## 2. Architecture & The Three AI Jobs

UniRadar runs a verifiable, three-stage runtime pipeline where traditional rule-based code or regex would fail:

```
[ User Uploads: Poster Image / Raw Email / Auto-Gmail IMAP ]
                           │
                           ▼
 ┌─────────────────────────────────────────────────────────┐
 │ Stage 1: Multimodal Extraction (Gemma 4 via Gemini API) │
 │  - OCR & layout spatial reasoning on poster graphics    │
 │  - Resolves relative French/English timing markers      │
 │  - Emits strict schema JSON                             │
 └─────────────────────────┬───────────────────────────────┘
                           │
                           ▼
 ┌─────────────────────────────────────────────────────────┐
 │ Stage 2: Hybrid Open-Weight Indexing (Local CPU)        │
 │  - Dense Vector Embeddings: all-MiniLM-L6-v2 (.npy)     │
 │  - Sparse Lexical Scoring: BM25s token frequency        │
 │  - Reciprocal Rank Fusion (RRF) for zero-cloud lookup   │
 └─────────────────────────┬───────────────────────────────┘
                           │
                           ▼
 ┌─────────────────────────────────────────────────────────┐
 │ Stage 3: Context, Conflict & Darija Reasoning (Gemma 4) │
 │  - Cross-references student_profile.json                │
 │  - Identifies Rabat ↔ Ben Guerir ONCF transit needs     │
 │  - Generates 🟢 Actionable, 🟡 Commute, 🔴 Clash badges│
 │  - Fluent Darija/FR/EN response + 1-Click .ics export   │
 └─────────────────────────────────────────────────────────┘

```

| Pipeline Stage | Model / Library | What the AI Actually Does (The "AI Job") | Why Traditional Code / Regex Fails |
| --- | --- | --- | --- |
| **Stage 1: Multimodal Extraction** | `gemma-4-26b-a4b-it` (via Gemini API) | Analyzes unselectable graphic posters and raw French/English emails to extract event schemas (`title`, `campus`, `start_time`, `end_time`, `action_url`). | Regex cannot parse text rendered inside raster poster graphics or interpret relative French date phrases like *"ce mardi avant 17h"*. |
| **Stage 2: Hybrid Campus Indexing** | `all-MiniLM-L6-v2` + BM25s (Open-Weight, Local CPU) | Indexes parsed announcements using dense vector embeddings + sparse lexical matching, combined via Reciprocal Rank Fusion (RRF). | Pure vector search misses exact alphanumeric room codes (e.g., *Salle C-04*), while `Ctrl+F` fails when searching *"hackathon"* for an email saying *"journée de création"*. |
| **Stage 3: Context & Conflict Reasoning** | `gemma-4-26b-a4b-it` (via Gemini API) | Compares event times and locations against `student_profile.json` to assign status badges, calculate match scores, and answer queries in natural Moroccan Darija. | If/else trees cannot calculate interest semantic similarity or understand mixed Darija questions like *"wach kayn chi hackathon f rabat had weekend?"*. |

---

## 3. The Open-Source Loop (Read → Run → Change → Share)

UniRadar is designed to adhere to the core philosophy of open-source AI:

1. **100% Open-Weight Stack:**
* **Gemma 4** (`gemma-4-26b-a4b-it`) is Google's Apache-2.0 open-weight multimodal model. Using the Gemini API gives zero-latency prototyping for hack days, with the architectural guarantee that any university lab can self-host the identical weights locally on vLLM or Ollama.
* **Sentence-Transformers (`all-MiniLM-L6-v2`)** runs 100% locally on CPU without proprietary vector databases.


2. **Student Data Sovereignty:** Personal student timetables and internal course registrations never leave the student's machine—stored locally in `config/student_profile.json`.
3. **The `campus_config.json` Pattern (Change & Adapt):**
* All campus-specific metadata (campuses, transit rules, school divisions) is decoupled from logic.
* A student at **ENSIAS**, **INPT**, or **Al Akhawayn (AUI)** can fork this repository, update 10 lines in `config/campus_config.json`, and deploy an instance for their university in under 5 minutes.



---

## 4. Key Features

* **"Drop Anything" Ingestion:** Upload any JPEG/PNG poster, forward a WhatsApp message, or paste an Outlook email.
* **Automated Gmail Sync:** Direct IMAP filter using Gemma 4 to triage recent unread emails, discarding spam and ingesting verified hackathon/event notices.
* **Rabat $\leftrightarrow$ Ben Guerir Transit Awareness:**
* 🟢 **Actionable:** Matches home campus and interests with no calendar conflict.
* 🟡 **Cross-Campus Alert:** Flags events located on the other campus and warns students to schedule an ONCF train (~3.5 hours).
* 🔴 **Schedule Clash:** Detects overlaps with existing lab defenses or lectures.


* **Trilingual Campus Memory:** Ask in Moroccan Darija (Arabic or Latin script), French, or English to retrieve past announcements and download `.ics` calendar files.

---

## 5. Team & Division of Work

Built collaboratively during Hack Day Rabat 2026:

* **Dev 1 — Multimodal Ingestion & Ingestion Pipeline:**
* Implemented `src/extractor.py` and Gemma 4 vision prompt engineering.
* Built the automated inbox polling module (`src/gmail_sync.py`) with IMAP SSL integration and zero-shot event classification.


* **Dev 2 — Open-Weight Hybrid Search & Embeddings Engine:**
* Implemented `src/retriever.py` with `all-MiniLM-L6-v2` sentence embeddings.
* Designed the Reciprocal Rank Fusion (RRF) algorithm combining dense cosine similarity with sparse lexical matching; implemented local `.npy` vector caching.


* **Dev 3 (ivoryth / Ilyas Chtioui) — Context Reasoning, Commute Logic & Darija Advisor:**
* Architected and implemented the reasoning engine in `src/advisor.py` to evaluate event relevance, detect schedule clashes, and compute match scores.
* Engineered the inter-campus transit rules engine and modular configuration schema (`config/campus_config.json` and `config/student_profile.json`).
* Implemented the trilingual response synthesizer (Darija, French, English) and developed the `.ics` RFC 5545 calendar file generator (`src/calendar_gen.py`).


* **Dev 4 — UI/UX & Live Demo Orchestration:**
* Built the unified Streamlit interface (`app.py`), multi-tab workflows, and reactive status badges.
* Curated real-world test datasets (`data/sample_announcements.json` and sample UM6P poster flyers) for the live jury demonstration.



---

## 6. Quickstart Guide

### Prerequisites

* Python 3.10+ (tested on Linux / Arch Linux / macOS / Windows)
* A Gemini API Key (with Gemma 4 access)

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/your-team/UniRadar.git
cd UniRadar

# 2. Create and activate a virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Set your API Key
export GEMINI_API_KEY="your-gemini-api-key"

```

### Launch the Application

```bash
streamlit run app.py

```

Open your browser at `http://localhost:8501`.

---

## 7. Configuration for Other Universities

To adapt UniRadar to another university (e.g., ENSIAS, Rabat):

```json
{
  "institution": "ENSIAS",
  "campuses": {
    "Madinat Al Irfane": {
      "city": "Rabat",
      "schools": ["Génie Logiciel", "Sécurité IT", "Data Science"],
      "primary_transport": "Rabat Tramway L1"
    }
  },
  "commute_rules": {
    "intercampus_transit_hours": 0.5,
    "transit_mode": "Tramway",
    "alert_message": "Local campus event — walkable or 10 min via Tram L1."
  }
}

```

---

## 8. License & Challenge Eligibility

* **License:** Apache License 2.0
* **Best Open-Source AI Project:** Uses open-weight local embeddings (`all-MiniLM-L6-v2`), zero proprietary cloud vector databases, and modular open-source configuration.
* **Best Use of Gemma 4:** Powered by `gemma-4-26b-a4b-it` via the Gemini API across multimodal poster comprehension, inbox event classification, and trilingual student advisory.