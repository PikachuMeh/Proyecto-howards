# 🧙‍♂️ Hogwarts Sorting Hat ("Sombrero Seleccionador") — Christmas Party

Full-stack real-time web application for a Hogwarts-themed party with bilingual support (**English 🇬🇧 & German 🇩🇪**). Guests scan a QR code on their mobile phones, answer a questionnaire, and get sorted into Gryffindor, Ravenclaw, Hufflepuff, or Slytherin. Simultaneously, a public projector screen animates the sorting ceremony in real-time.

---

## ⚡ Quick Start (Single-Command Startup - NFR-10)

### 1. Prerequisites
- Python 3.10+ (Tested on Python 3.13)

### 2. Installation & Run
```bash
# Install dependencies
python -m pip install -r requirements.txt

# Start the application (initializes & seeds database automatically)
python run.py
```

### 3. Application Access Points
- 📱 **Mobile Guest Questionnaire:** [http://localhost:8000/](http://localhost:8000/)
- 📺 **Public Screen (Projector/TV):** [http://localhost:8000/screen](http://localhost:8000/screen)
- 🏰 **Admin Control Panel:** [http://localhost:8000/admin](http://localhost:8000/admin) *(Password: `alohomora`)*
- 📚 **Swagger API Documentation:** [http://localhost:8000/docs](http://localhost:8000/docs)

---

## 🌐 Bilingual Architecture (EN / DE)

The application provides end-to-end bilingual support across all layers:
1. **Database Schema:** Questions (`text_en`, `text_de`), Options (`text_en`, `text_de`), Houses (`name_en`, `name_de`, `motto_en`, `motto_de`), and Participant preference (`preferred_lang`).
2. **REST API:** Query parameter `?lang=en|de` dynamically provides localized payloads.
3. **Frontend:** Real-time language switch (English / Deutsch) persisted in `localStorage` across the mobile questionnaire, public projection screen, and admin control center.

---

## 🏗️ Architecture & Real-Time Communication

### Architecture Diagram
```
┌─────────────────────────────────┐
│       Mobile Guest Client       │ (Questionnaire, >=44px buttons, AA contrast)
│       (Plain HTML5/CSS3/JS)     │
└──────────────┬──────────────────┘
               │ HTTP POST/GET (Cookie / Header Token)
               ▼
┌─────────────────────────────────┐           ┌─────────────────────────────────┐
│     FastAPI Application Server  │◄─────────►│     SQLite Relational Database  │
│        (Python 3.13)            │  SQL/FKs  │  (8 Normalized Tables + Indexes)│
└──────────────┬──────────────────┘           └─────────────────────────────────┘
               │ SSE (Server-Sent Events)
               ▼
┌─────────────────────────────────┐
│      Public Projector Screen    │ (5m readability, Sequential Animation Queue)
│       (Plain HTML5/CSS3/JS)     │
└─────────────────────────────────┘
               ▲
               │ HTTP (Admin Auth Session)
┌──────────────┴──────────────────┐
│      Admin Control Panel        │ (Roster, Reassignment, Reset, CSV, QR)
│       (Plain HTML5/CSS3/JS)     │
└─────────────────────────────────┘
```

### Rationale for Real-Time Choice: Server-Sent Events (SSE)
Section 9.2 compares SSE, WebSockets, and Polling:
1. **Unidirectional Simplicity (Server $\to$ Public Screen):** The public screen only needs to receive assignment announcements from the backend; it never sends data back over the live stream.
2. **Native Reconnection & Resilience (FR-13):** The browser's native `EventSource` automatically handles reconnection and exponential backoff if WiFi drops.
3. **Efficiency over HTTP:** Unlike HTTP polling, SSE delivers new assignments in under **50ms** (far exceeding NFR-02's 2-second requirement) without redundant request-response overhead.
4. **Zero Heavy Dependencies:** Implemented via standard async streaming without needing external broker infrastructure (Redis/RabbitMQ).

---

## 📊 Relational Data Model (Normalized Schema)

The database enforces referential integrity (`PRAGMA foreign_keys = ON;`):

- `event` — Event records and state (`active`, `balancing_mode`).
- `house` — Houses metadata (`code`, `name_en`, `name_de`, `color_hex`, `motto_en`, `motto_de`, `crest_icon`).
- `question` — Thematic questions with `UNIQUE(event_id, position)`.
- `option` — 4 options per question with `UNIQUE(question_id, position)`.
- `option_score` — **Bridge table (N:M)** linking options to house point distributions (0 to 10 points per house).
- `participant` — Guest records identified by display name and unique UUID `session_token`.
- `answer` — Records chosen options with `UNIQUE(participant_id, question_id)` preventing duplicate answers.
- `assignment` — Final house assignment with `UNIQUE(participant_id)` guaranteeing nobody gets sorted twice.
- `administrator` — Administrator credentials (`id`, `username UNIQUE`, `password_hash`, `full_name`, `role`, `created_at`).

---

## 🎩 Assignment Algorithm & Deterministic Tie-Breaking (Section 8)

The sorting engine (`app/sorting.py`) is completely isolated and decoupled from database/HTTP layers (NFR-09):

1. **Base Calculation:** Sums points awarded to each house from `option_score` for all submitted answers.
2. **House Balancing Mode (FR-18):** When toggled on, if the difference between the most populated and least populated house exceeds the threshold (4 students), a calibrated penalty is applied to the saturated house.
3. **Deterministic Tie-Breaking Rules (FR-07):**
   - **Rule 1:** The house that scored points across the most distinct questions wins.
   - **Rule 2:** If still tied, the house with fewer participants currently assigned wins.
   - **Rule 3:** If still tied, a deterministic pseudo-random seed using the participant's integer ID selects the winner reproducibly.
4. **"Hesitant Hat" Mode (Section 15):** If the top two houses are within 2 points, the system flags the assignment as hesitant, triggering a dramatic suspense pause on the screen.

---

## 🧪 Automated Testing

Execute the complete unit and integration test suite:
```bash
python -m pytest -v
```

### Covered Test Scenarios:
- ✅ Clear winner assignment
- ✅ Two-way tie broken by Rule 1 (Distinct questions)
- ✅ Two-way tie broken by Rule 2 (Fewest house members)
- ✅ Two-way tie broken by Rule 3 (Deterministic participant ID seed)
- ✅ Four-way tie safety without throwing
- ✅ Missing answers raising controlled error
- ✅ House balancing penalty reallocation
- ✅ Hesitant Hat score margin detection
- ✅ Full guest registration $\to$ answer submission $\to$ sorting flow in English & German
- ✅ Double submission prevention (returns 409 Conflict)
- ✅ Incomplete questionnaire rejection (returns 422 Unprocessable Entity)
- ✅ Unauthorized request rejection (returns 401 Unauthorized)
- ✅ Admin authentication, manual reassignments, and event reset

---

## 🛡️ Privacy & Security (NFR-07, NFR-08)
- No personal identifiable information (emails, phone numbers, or persistent IPs) is stored. Only display names and UUID session tokens.
- All admin endpoints require authentication.
- Full event reset available to wipe testing and rehearsal data before the live party.
