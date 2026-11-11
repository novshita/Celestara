# 🌌 Celestara

### ✨ AI Personal Guidance Universe

A personalized celestial exploration platform for reading your birth chart through **both Vedic and Western astrology** — understanding not only how the two systems differ, but *why* — with an AI guide that interprets your chart rather than inventing it.

> 🔭 **The system calculates. The AI interprets. The user decides.**

The experience is designed to feel like entering a living celestial observatory: **accurate underneath, understandable in the middle, immersive on the surface.**

---

## 🚧 Project Status

**Backend calculation and AI layers both underway.** The deterministic astrology engine came first, in line with the priority order below — calculation accuracy before everything else. The AI Guide answers grounded in the calculated chart, curated knowledge and - for logged-in users - their saved conversations and chosen memories.

| Area | Status |
|---|---|
| 🕉️ Vedic D1 / Rashi chart | ✅ Implemented |
| 🔮 Western natal chart + aspects | ✅ Implemented |
| ⚖️ Compare (Vedic ↔ Western) | ✅ Implemented |
| ⏳ Vimshottari Dasha timeline | ✅ Implemented |
| 🌍 Transit / Gochar engine | ✅ Implemented |
| 🌐 FastAPI endpoints | ✅ Implemented |
| 🔐 Accounts, birth profile, journal | ✅ Implemented |
| 🤖 AI Guide (Claude) | ✅ Implemented - curated knowledge (keyword retrieval), saved conversations, user-controlled memory, explanation depth, and the factors behind every answer |
| 🪐 Planet exploration | ✅ Implemented - one call per planet: placement, current transit or aspects, and its description |
| 🔒 Privacy controls | ✅ Implemented - delete memory, conversations, or everything in one call |
| 📖 Daily/weekly/monthly readings + birth chart, career, love, relationships, growth | ✅ Implemented - weekly/monthly look ahead for real changes; follow-ups go through saved conversations |
| 🖥️ Next.js frontend | ✅ Implemented - calculation views and drawings, Celestial Universe home page, auth, profile, journal, memory and conversation management, delete-my-data, AI Guide (with safety notices), readings, recurring themes; visual redesign pending |
| 🚀 Deployment | ✅ Docker (SQLite or PostgreSQL), CI, security scanning, backups - see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) |

| 📄 Document | What it covers |
|---|---|
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Running on PostgreSQL, pre-launch checklist, backups and restore, updates |
| [Celestara-product-spec.md](Celestara-product-spec.md) | Vision, user journeys, features, visual direction, safety, V1/V2 scope |
| [Celestara-engineering-spec.md](Celestara-engineering-spec.md) | Architecture, calculation layer, AI orchestration, data model, testing, security |

---

## 🛠️ Running the Backend

Requires **Python 3.12+**.

```bash
cd backend
python -m venv ../.venv && source ../.venv/bin/activate
pip install -e ".[dev]"

uvicorn app.main:app --reload     # http://127.0.0.1:8000
pytest                            # run the test suite
```

Interactive API docs are served at `/docs` once the server is running.

Data is stored in a local SQLite file (`celestara.db`) by default - nothing
to install. Set `DATABASE_URL` to point at Postgres instead
(`postgresql+psycopg://user:password@host:5432/celestara`; the driver is
installed with the backend and the tables are created on start). The backend's
tests run against both: `pytest` uses in-memory SQLite, and
`TEST_DATABASE_URL=postgresql+psycopg://... pytest` runs the same suite on an
empty, disposable Postgres database, as CI does. See `backend/.env.example` for
every environment variable the app reads.

### 🧪 Frontend tests

```bash
cd frontend
npm test                          # unit and component tests (Vitest), seconds
npm run build && npm run test:e2e # browser journeys (Playwright), about a minute
```

The unit tests cover the chart geometry, the Dasha timeline maths, the form
helpers and the chart components, using real backend responses saved in
`frontend/tests/fixtures`. The browser tests drive the production build in
Chrome against the real backend on a throwaway database and a fake Anthropic
API, so they need no key and cost nothing. They cover the nine journeys from
engineering spec §31 (new user to chart, Vedic and Western exploration,
Compare, transit reading, an AI question and its failure modes, unknown birth
time, memory management, deleting all data) plus accessibility (axe, at desktop
and phone width), reduced motion and no sideways scrolling on small screens.
They use ports 3200, 8200 and 8201, so a running dev server is left alone; set
`E2E_PYTHON` if `python3` is not the interpreter with the backend installed.
CI runs both.

### 🔑 Authentication

Endpoints under `/profile`, `/journal` and `/account` require a bearer
token:

```bash
curl -X POST localhost:8000/api/v1/auth/register \
  -d '{"email": "you@example.com", "password": "at least 8 characters"}'

TOKEN=$(curl -X POST localhost:8000/api/v1/auth/login \
  -d '{"email": "you@example.com", "password": "at least 8 characters"}' \
  | jq -r .access_token)

curl localhost:8000/api/v1/profile -H "Authorization: Bearer $TOKEN"
```

### 🤖 AI Guide

`/api/v1/ai/chat` and `/api/v1/readings/{daily,weekly,monthly}` all
require `ANTHROPIC_API_KEY` to be set (see `backend/.env.example`) -
without it they return `503 AI_UNAVAILABLE` rather than crashing. No
account needed for any of them:

```bash
curl -X POST localhost:8000/api/v1/ai/chat \
  -d '{
    "birth": {"birth_date": "1990-08-15", "birth_time": "14:30:00", "time_confidence": "EXACT", "latitude": 18.9756, "longitude": 72.8258, "timezone_name": "Asia/Kolkata"},
    "system": "vedic",
    "question": "What does my Moon'"'"'s nakshatra suggest about my temperament?"
  }'

curl -X POST localhost:8000/api/v1/readings/weekly \
  -d '{"birth": {"birth_date": "1990-08-15", "birth_time": "14:30:00", "time_confidence": "EXACT", "latitude": 18.9756, "longitude": 72.8258, "timezone_name": "Asia/Kolkata"}}'
```

Readings can also be focused on a life area. Pass `"topic": "career"`
(or `love`, `relationships`, `growth`) to the daily, weekly or monthly
endpoints, or use the category readings from product spec §13:

```bash
curl -X POST localhost:8000/api/v1/readings/topic/career \
  -d '{"birth": {"birth_date": "1990-08-15", "birth_time": "14:30:00", "time_confidence": "EXACT", "latitude": 18.9756, "longitude": 72.8258, "timezone_name": "Asia/Kolkata"}}'
```

`/readings/topic/{birth_chart,career,love,relationships,growth}`: the four
life areas read the natal chart together with today's transits, pointed at
the bhavas and grahas traditionally tied to that area (for example the 10th
bhava for career, the 5th and 7th for love). `birth_chart` reads the natal
chart alone and returns `generated_for: null`, since no transits are used.
The focus only tells the model where to look in facts it already has; it
adds no calculation.

The daily reading is grounded in today's transits (recalculated on every
call, never cached or templated) against the natal chart - the same
transit calculation `/transits/vedic` uses. Weekly and monthly readings
also look ahead 7 and 30 days: the sky is sampled daily and each rashi
change or retrograde/direct turn is located to the minute by bisection
(`backend/app/services/astrology/transit/period.py`), then given to the
model with its natal bhava. The model is told to build the reading around
those changes and to mention none that are not listed. The Moon is left
out of the events - it changes rashi every couple of days and would bury
the slower, more meaningful ones. A quiet period is reported as quiet.

These endpoints are open to unauthenticated callers and every call costs
money, so they are rate limited: 10 requests per minute per client, shared
across all of them, answered with `429 RATE_LIMITED` and a `Retry-After`
header (`AI_RATE_LIMIT_PER_MINUTE`, `0` to disable). The limit is
in-memory - per process, reset on restart - which is enough for one
instance; several workers would need a shared store. Because the frontend
calls the API from its own server, all end users currently share one
client address and therefore one allowance. Behind exactly one trusted
proxy, set `FORWARD_CLIENT_IP=true` on the frontend and
`RATE_LIMIT_TRUST_FORWARDED_FOR=true` on the backend to count each person
separately (see both `.env.example` files). A crisis message to `/ai/chat` is
exempt from the limit.

**Safety.** Every chat question is assessed before any model call, and
every answer and reading is checked after it (`backend/app/services/ai/`):

- *Crisis* (self-harm, suicide): answered with fixed supportive text and no
  model call - and no chart calculation, so it works even when the AI
  provider is down. Reported as `intent: high_stakes`, `model: null`,
  `safety_flags: ["crisis"]`.
- *Medical, legal, financial, major life decisions, certainty-seeking*:
  the model gets a SAFETY CONTEXT telling it to reflect rather than
  predict and to point to a professional, and the response carries a
  `notice` to show the user.
- *Off-topic* requests (code, recipes, arithmetic...): declined with fixed
  text and no model call, `intent: unsupported`.
- *Output backstop*: model text that asserts certainty ("you will
  definitely...") or directs a risky action ("you should stop taking your
  medication") is replaced with a fixed fallback and flagged in
  `safety_flags`. Negation is understood within a clause, so "I can't
  guarantee..." passes.

`intent` (the §14 classes) is returned on every chat response. Only
`high_stakes` and `unsupported` change behaviour today; the rest are
informational. All of this is deterministic keyword matching: free,
testable and reproducible, but English-only and evadable by rephrasing -
a backstop, not a guarantee.

**What an answer is grounded in.** Beyond the natal chart, a chat answer is
given what its question calls for: the current transits for a transit
question, the Vimshottari Dasha for a Dasha question (a Western-only answer
is never given Vedic transits or Dasha, and says they are not available).
Curated knowledge is retrieved for the question from a versioned set of
short entries in `backend/app/services/knowledge/corpus` - plain files, so
every change is a reviewed diff - using BM25 keyword ranking behind an
interface that vector search can replace later. The model is told that
knowledge, memory and conversation text are reference material, never
instructions, and anything from outside the application is flattened to a
single line so it cannot fake a section heading.

**What every response reports.** `factors` lists the calculated facts used
(by kind: natal chart, transits, period changes, Dasha, and anything
unavailable), the knowledge entries retrieved (id, title and version), and how
much memory and earlier conversation was supplied - the chain from
question to chart facts to knowledge to answer (product spec §23).

**Explanation depth.** `depth` is `beginner` (default) or `technical`, set per
request or saved as a preference (`PUT /api/v1/preferences`, which also
saves a calculation configuration). A request wins over the saved value.

**With an account** (send the bearer token; everything still works without
one, statelessly):

- Answered questions are saved as conversations a follow-up can continue
  (`conversation_id`); `GET/DELETE /api/v1/conversations` lists, reads and
  deletes them. A crisis message and a declined off-topic request are never
  saved.
- Memory is only what you explicitly ask the guide to keep
  (`/api/v1/memory`, 50 at most); nothing in a conversation becomes memory
  by itself, and you can forget one or all.
- An invalid or expired token is a `401`, not a quiet downgrade to anonymous,
  so nobody believes a conversation is being saved when it is not.
- Each answer leaves an audit record (engineering spec §22) holding the
  intent, model, safety flags, timing and which *kinds* of fact and which
  knowledge entries were used - never the question, the answer or a chart
  value. Crisis messages are not recorded at all. Everything tied to an
  account goes when the account is deleted.

**Planet exploration.** `POST /api/v1/explore/planet` returns, for one planet
in one chart: its placement, its current transit (Vedic) or the aspects it
makes (Western), and its curated description. No model is involved, so it
needs no account and is not rate limited.

### 🌐 API Endpoints

All calculation endpoints are namespaced under `/api/v1`.

| Method | Path | Returns |
|---|---|---|
| `GET` | `/health` | Liveness check |
| `POST` | `/api/v1/charts/vedic` | Vedic D1 (Rashi) chart |
| `POST` | `/api/v1/charts/western` | Western natal chart |
| `POST` | `/api/v1/charts/compare` | Both charts plus how they differ |
| `POST` | `/api/v1/dashas/vimshottari` | Vimshottari Dasha timeline |
| `GET` | `/api/v1/transits` | Graha positions at a moment |
| `POST` | `/api/v1/transits/vedic` | Transits relative to a natal chart |
| `POST` | `/api/v1/auth/register` | Create an account |
| `POST` | `/api/v1/auth/login` | Exchange credentials for a bearer token |
| `POST` | `/api/v1/auth/logout` | Revoke the current session |
| `GET`/`PUT` | `/api/v1/profile` | The one saved birth profile |
| `GET`/`POST` | `/api/v1/journal` | List / create journal entries |
| `GET`/`PUT`/`DELETE` | `/api/v1/journal/{id}` | Read, edit, or remove an entry |
| `DELETE` | `/api/v1/account/data` | Permanently delete the account and all its data |
| `POST` | `/api/v1/ai/chat` | Ask the AI Guide a question grounded in one calculated chart |
| `POST` | `/api/v1/explore/planet` | One planet in one chart: placement, transit or aspects, description |
| `GET`/`PUT` | `/api/v1/preferences` | Explanation depth and saved calculation configuration |
| `GET`/`POST`/`DELETE` | `/api/v1/memory`, `/api/v1/memory/{id}` | The memories you asked the guide to keep |
| `GET`/`DELETE` | `/api/v1/conversations`, `/api/v1/conversations/{id}` | Saved AI Guide conversations |
| `POST` | `/api/v1/readings/daily` | Generate a daily reading grounded in today's transits |
| `POST` | `/api/v1/readings/weekly` | Generate a weekly reading grounded in the coming week's transits |
| `POST` | `/api/v1/readings/monthly` | Generate a monthly reading grounded in the coming month's transits |
| `POST` | `/api/v1/readings/topic/{topic}` | Birth chart, career, love, relationships or growth reading |

---

### 🗄️ Database migrations

The schema is managed with Alembic (`backend/app/db/migrations`). The API
applies any pending migration when it starts, so a fresh clone still just
runs. A database created before migrations existed is recognised and kept
as it is, not rebuilt. To change the schema: edit `app/db/models.py`, then
from `backend/` run:

```bash
alembic revision --autogenerate -m "describe the change"
alembic upgrade head
```

Read the generated file before committing it. A test fails if the models and
the migrations disagree, so a model change without a migration cannot reach
`main`. With several workers, set `AUTO_MIGRATE=false` and run
`alembic upgrade head` once before starting them.

### 📈 Metrics and security scanning

**Metrics.** Set `METRICS_ENABLED=true` and the backend serves Prometheus
metrics at `/metrics` (add `METRICS_TOKEN` to require a bearer token): request
counts and latency by route, AI provider calls, failures and latency, safety
actions (crisis, off-topic, replaced output), knowledge retrieval latency and
rate-limited requests. Only
counts and timings are recorded - routes appear as templates such as
`/api/v1/journal/{entry_id}`, never with real ids, and no question, birth
record or other request content ever reaches a metric. Every request is also
logged with a request id.

**Scanning.** `.github/workflows/security.yml` audits the Python and
production npm dependencies and scans both Docker images for fixable
critical/high vulnerabilities, on every pull request and weekly (a clean
dependency can have an advisory published later). Dependabot opens update
pull requests for pip, npm, Docker and GitHub Actions.

### 🐳 Docker

The whole app runs with one command:

```bash
docker compose up --build   # then open http://localhost:3000
```

Put `ANTHROPIC_API_KEY` in a `.env` file next to `docker-compose.yml` (or
export it) to enable the AI endpoints; without it they answer `503` and
everything else works. The backend's SQLite database lives on the
`celestara-data` volume, so it survives `docker compose down` (use `down -v`
to wipe it). Each image also builds on its own: `docker build backend` and
`docker build frontend`. For PostgreSQL, security checks before launch and
backup/restore, see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

Notes: `pyswisseph` has no prebuilt wheel for every platform (Linux on ARM,
for one), so the backend image compiles it in a build stage and ships
without the compiler. The containers run as non-root, and the backend image
has a health check on `/health`. Continuous integration
(`.github/workflows/ci.yml`) runs the backend tests on Python 3.12, the
frontend lint and build, and builds both images on every pull request.

## 🖥️ Running the Frontend

Requires **Node.js 20+**. Start the backend first (above) - the frontend
calls it directly.

```bash
cd frontend
npm install
npm run dev     # http://localhost:3000
```

The site has the four primary pages from product spec §10:

- **Home** (`/`): readings (today, this week, this month or your birth chart,
  optionally focused on career, love, relationships or growth) and the AI
  Guide. Both have an Explanation choice (beginner or technical, or your saved
  default) and a collapsed "How this was built" panel showing the calculated
  facts, the traditional knowledge drawn on, and how much of your own context
  was used. When you are logged in the AI Guide continues a saved
  conversation, so a follow-up question sees what you asked before; you can
  start a new one at any point. Neither needs an account, but both need the backend to have
  `ANTHROPIC_API_KEY` set, or they show the backend's "AI guide isn't
  answering right now" message.
- **Birth Chart** (`/chart`): a birth-data form that calculates a Vedic,
  Western, Compare, Vimshottari Dasha or current-transits view against the
  running backend - every calculation endpoint it exposes.
  Below it, **Explore a planet** shows one planet in one chart: where it sits,
  what it is doing now (Vedic) or its aspects (Western), and its curated
  traditional description, with a link to ask the guide how it reads for you.
  Nothing there uses AI or needs an account.
- **Celestial Universe** (product spec §9, §26): the home page opens on the
  sky as it is now - the nine grahas on a wheel of signs - and, with a saved
  profile, your own birth chart and ascendant inside it. Pick a planet to see
  its sign in both zodiacs, or ask the Guide about it. Switching between Vedic
  and Western does not swap a picture: the planets stay where they are and the
  ring of signs turns around them by the ayanamsa (about 24 degrees), because
  that is all the difference between the two zodiacs is. Compare shows both
  rings at once, the Vedic one tucked inside the Western one. Every position is
  also given as a table, and with reduced motion the changes are instant.
- **Recurring themes** (product spec §20): if one topic (career, love,
  relationships, personal growth) comes up in at least three of a signed-in
  user's saved questions within 30 days, the home page says so, in plain
  counts, noting it describes the questions and not the person. At most one
  theme, computed on demand and never stored or given to the model, switchable
  per user in Preferences and per deployment with
  `FEATURE_PATTERN_DETECTION`. Only this basic form exists; advanced detection
  is deferred in the spec.
- **Calculation cache** (engineering spec §28): natal charts, Dasha timelines
  and comparisons are cached in memory for 15 minutes, keyed by birth data
  and the full calculation configuration including its version. Transits and
  readings (which depend on the clock) are not cached. Tune with
  `CALCULATION_CACHE_SIZE` / `CALCULATION_CACHE_TTL_SECONDS`.
- **Chart drawings** (product spec §6, §11-12, §26): the Western chart is a
  zodiac wheel (signs, houses, planets, and aspect lines coloured by kind, with
  the ascendant at the left); the Vedic chart is a Kundali in either the North
  or South Indian layout. Compare shows both and slides between "Together",
  "Vedic" and "Western". The lines draw themselves in and the planets appear
  after. Without a birth time there is no ascendant or houses, so the wheel
  omits them and only the South Indian layout is offered, and it says so.
  Labels are plain letters, not astrological glyphs, which render differently
  on every device. Each drawing has a text summary for screen readers and the
  full tables remain beneath it.
- **Look and motion** (product spec §25-26): a deep-indigo "cosmic observatory"
  theme with gold accents and a CSS-only starfield (no scripts, images or web
  fonts, so it costs nothing to load). Results fade in quickly; while the AI
  is working, a small constellation animates. All motion switches off for
  anyone whose system asks for reduced motion. The Dasha view is a to-scale
  bar of Mahadashas with a "now" marker; choosing one lists its Antardashas.
- **Journal** (`/journal`) and **Profile** (`/profile`): need an account.
  Logged out they show the log-in / create-account form. Logged in, you can
  save your one birth profile (product spec §28) and keep journal entries
  (product spec §16: reflective, not predictive) with full create/edit/delete.
  The Profile page also holds your default explanation depth, what the guide
  remembers (add or forget anything; nothing is remembered on its own), your
  saved AI Guide conversations (read or delete), and "Delete my data", which
  asks you to type `DELETE` before erasing the account and everything in it.

With a saved profile, Home also shows a small dashboard under the birth-chart
link (product spec §9): your current Dasha and Antardasha, where the Moon,
Jupiter and Saturn are now, and a few suggested questions built from those
calculated facts. Clicking a question only fills the Guide's box; nothing is
sent until you press Ask.

Once you have saved a birth profile, the birth forms on Home and Birth Chart
fill themselves in from it (you can still change them for a one-off). If you
are logged out, your session has expired or the backend can't be reached, the
forms are simply empty - pre-filling never gets in the way.

The session is a bearer token from the backend held in an httpOnly cookie,
set and read entirely server-side (Next.js Server Actions and Server
Components - the token is never exposed to client JavaScript). See `frontend/.env.example` for the
settings this app reads (`BACKEND_URL`, only needed if the backend isn't on
its default port, and `FORWARD_CLIENT_IP`).

## 🪐 What It Does

### ☀️ Three Modes, One Universe

Vedic, Western, and Compare share your birth information but maintain **completely separate calculation and interpretation pipelines**.

#### 🕉️ Vedic / Jyotish
- Sidereal zodiac with Lahiri/Chitrapaksha ayanamsa
- Navagraha, Rashi (D1 / Janma Kundali), Bhavas
- Nakshatras and an interactive Vimshottari Dasha timeline
- Current Gochar / transits
- Interactive planet exploration

#### 🔮 Western
- Tropical zodiac with configurable house systems
- Sun, Moon, Ascendant, planets, houses
- Major aspects, retrogrades, current transits
- Personality, life-area, and relationship interpretation

#### ⚖️ Compare
Not a side-by-side chart viewer — a **unified visualization** that shows the relevant Vedic calculation, the relevant Western calculation, why they differ, and how those differences shape interpretation.

🚫 The system never claims either tradition is objectively "more accurate."

---

## 🌠 Core Features

- 🌙 **Birth-data experience** — date, time, and location collection that feels like part of the celestial journey rather than a generic form, with automatic timezone detection and manual correction
- ⏳ **Unknown birth time, handled honestly** — time-dependent calculations are marked uncertain or unavailable, never silently fabricated
- 🧭 **Celestial dashboard** — your chart inside an interactive celestial environment, with today's transit, insight, and Dasha context layered in
- 📖 **Readings** — birth chart, career, love, relationships, personal growth, plus daily / weekly / monthly, all grounded in live calculated transit data
- 🤖 **AI Guide** — a calm celestial guide, not a cartoon character; every celestial object becomes an entry point into conversation
- 🔍 **Transparency layer** — every interpretation distinguishes calculated facts, traditional interpretation, AI explanation, and personal context
- 🎚️ **Beginner → expert depth** — simple explanations by default, exact degrees, ayanamsa, and house-system detail one tap away
- 📓 **Journal** — reflective rather than predictive
- 🔐 **Privacy as a feature** — manage your birth data and AI memory, with a one-click "delete my data" flow

### 🧠 The Interaction Model

> **Explore → Discover → Ask → Understand**

---

## 🏛️ Architecture

```text
                         ┌──────────────────────┐
                         │       Next.js        │
                         │ Celestial Experience │
                         └──────────┬───────────┘
                                    │
                              HTTP / API
                                    │
                         ┌──────────▼───────────┐
                         │       FastAPI        │
                         │ Application Backend  │
                         └──────────┬───────────┘
                                    │
              ┌─────────────────────┼─────────────────────┐
              ▼                     ▼                     ▼
      Vedic Calculation      Western Calculation     Transit Engine
           Service                 Service
              │                     │                     │
              └─────────────────────┼─────────────────────┘
                                    ▼
                         Structured Astrology Data
                                    │
              ┌─────────────────────┼─────────────────────┐
              ▼                     ▼                     ▼
        AI Orchestrator        Knowledge/RAG        User Memory
              │                     │                     │
              └─────────────────────┼─────────────────────┘
                                    ▼
                         Interpretation Pipeline
                                    ▼
                              Next.js UI
```

### ⚙️ Stack

| Layer | Technology | Status |
|---|---|---|
| 🖥️ Frontend | Next.js + TypeScript | 🚧 Started |
| 🐍 Backend | FastAPI + Python + Pydantic | ✅ In place |
| 🗄️ Database | SQLite (dev) → PostgreSQL + pgvector (planned for prod) | ✅ In place |
| 🌟 Calculation | Swiss Ephemeris behind a service boundary | ✅ In place |
| 🧩 AI | Claude (`anthropic` SDK), one provider so far | ✅ Single-turn Q&A in place |
| 📚 Knowledge | RAG over curated astrology material | ⬜ Planned |

---

## 🛡️ Non-Negotiables

These guardrails come directly from the specs and hold for every contribution:

- 🚫 **The LLM never calculates astrology** — no planetary positions, houses, aspects, Nakshatras, Dashas, or transits
- 🧬 **Sidereal and tropical never mix** by accident
- 📐 **Calculation accuracy is priority #1**, performance #2 — feature breadth never outranks either
- 🎭 **Animation is never the source of truth** for astrology data
- ❓ **Uncertainty is shown, not hidden**
- 🩺 **No medical, legal, or financial authority** — high-stakes questions get reframed toward reflection and qualified advice
- 🔬 **No claims of scientific validation**, and no guaranteed outcomes
- 🔑 **Provider secrets stay server-side**, always

---

## 📊 Priority Order

1. 🎯 Astrology calculation accuracy
2. ⚡ Performance
3. 🎨 UI / UX
4. 💬 AI interpretation quality
5. 🌀 Animation and visual experience
6. 📦 Feature breadth

---

## 🔎 Open items

Things the code cannot settle, so they are listed rather than hidden:

- **Astrology review.** The 47 knowledge entries and 19 planet descriptions
  were written to be conservative, but a Jyotish practitioner should read them,
  and a few charts should be compared against a second ephemeris (for example
  Jagannatha Hora). Positions match the saved reference fixtures; they have not
  been checked against an independent program.
- **Live model.** Every test of the AI path used a fake Claude. Run the AI Guide
  and Dasha explanations once against a real `ANTHROPIC_API_KEY` before launch.
- **Browsers.** The browser tests run in Chrome. The Celestial Universe turns
  rings with CSS transforms on SVG, which Safari has handled inconsistently, so
  look at it there.
- **Embeddings (pgvector).** Retrieval is keyword-based, which suits 47 entries.
  Revisit when the corpus is in the hundreds.
- **Privacy policy and terms**, and a strict Content-Security-Policy.

## 🗺️ Roadmap

<details>
<summary>✅ <strong>In scope for the initial build</strong></summary>

Vedic D1/Rashi · Western intermediate chart · Compare · birth data and unknown-birth-time handling · current transits · daily/weekly/monthly readings · career/love/relationships/growth readings · AI Guide · curated RAG · user-controlled memory · basic Nakshatra · Vimshottari Dasha timeline · interactive planet exploration · beginner/technical depth · privacy and deletion controls · celestial UI and signature animations

</details>

<details>
<summary>🔭 <strong>Architected for later, deliberately deferred</strong></summary>

Advanced Vedic divisional charts · advanced Nakshatra analysis · advanced Dasha analysis · advanced Western astrology · compatibility · advanced AI pattern detection · advanced personalization · multiple profiles · community and social features

</details>

The architecture must accommodate these later **without requiring a rewrite**.

---

## ⚠️ Disclaimer

Celestara treats astrology as an **interpretive and traditional framework**, not scientifically validated prediction. Readings are offered for reflection and exploration rather than certainty, and the product is not a substitute for qualified medical, legal, financial, or professional advice.
