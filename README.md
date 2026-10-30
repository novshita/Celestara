# 🌌 Celestara

### ✨ AI Personal Guidance Universe

A personalized celestial exploration platform for reading your birth chart through **both Vedic and Western astrology** — understanding not only how the two systems differ, but *why* — with an AI guide that interprets your chart rather than inventing it.

> 🔭 **The system calculates. The AI interprets. The user decides.**

The experience is designed to feel like entering a living celestial observatory: **accurate underneath, understandable in the middle, immersive on the surface.**

---

## 🚧 Project Status

**Backend calculation and AI layers both underway.** The deterministic astrology engine came first, in line with the priority order below — calculation accuracy before everything else. The AI Guide is now a single grounded Q&A turn (no RAG, no saved conversation history yet - both are separate, later features).

| Area | Status |
|---|---|
| 🕉️ Vedic D1 / Rashi chart | ✅ Implemented |
| 🔮 Western natal chart + aspects | ✅ Implemented |
| ⚖️ Compare (Vedic ↔ Western) | ✅ Implemented |
| ⏳ Vimshottari Dasha timeline | ✅ Implemented |
| 🌍 Transit / Gochar engine | ✅ Implemented |
| 🌐 FastAPI endpoints | ✅ Implemented |
| 🔐 Accounts, birth profile, journal | ✅ Implemented |
| 🤖 AI Guide (single-turn Q&A, Claude) | ✅ Implemented - no RAG or saved history yet |
| 📖 Daily/weekly/monthly readings + birth chart, career, love, relationships, growth | ✅ Implemented - weekly/monthly look ahead for real changes; no follow-up questions yet |
| 🖥️ Next.js frontend | 🚧 Started - calculation views, auth, profile, journal, AI Guide, readings |

| 📄 Document | What it covers |
|---|---|
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
to install. Set `DATABASE_URL` to point at Postgres instead; see
`backend/.env.example` for every environment variable the app reads.

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
client address and therefore one allowance; see
`RATE_LIMIT_TRUST_FORWARDED_FOR` in `backend/.env.example` for how to
separate them behind a trusted proxy. A crisis message to `/ai/chat` is
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
| `POST` | `/api/v1/readings/daily` | Generate a daily reading grounded in today's transits |
| `POST` | `/api/v1/readings/weekly` | Generate a weekly reading grounded in today's transits |
| `POST` | `/api/v1/readings/monthly` | Generate a monthly reading grounded in today's transits |

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
`docker build frontend`.

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

A birth-data form calculates a Vedic, Western, Compare, Vimshottari Dasha,
or current-transits view against the running backend - every calculation
endpoint the backend exposes. You can also register and log in; the
session is a bearer token from the backend held in an httpOnly cookie, set
and read entirely server-side (Next.js Server Actions and Server
Components - the token is never exposed to client JavaScript). Logged in,
you can save your one birth profile (product spec §28) so you don't have
to retype it every time, and keep journal entries (product spec §16:
reflective, not predictive) with full create/edit/delete. You can also ask
the AI Guide a question grounded in a calculated chart, or get a daily
reading grounded in today's transits - neither needs an account, same as
the chart form - but both require the backend to have `ANTHROPIC_API_KEY`
set, or the forms will show the backend's "AI guide isn't answering right
now" message. The celestial visualization layer is still to come; see
`frontend/.env.example` for the one setting this app reads (`BACKEND_URL`,
only needed if the backend isn't on its default
port).

The API call happens in a [Server Function](https://nextjs.org/docs/app/getting-started/mutating-data)
(`frontend/src/app/actions.ts`), not in the browser - the backend never
needs CORS configuration because it only ever talks to the Next.js server,
not directly to a user's browser.

---

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
