# 🌌 Celestara

### ✨ AI Personal Guidance Universe

A personalized celestial exploration platform for reading your birth chart through **both Vedic and Western astrology** — understanding not only how the two systems differ, but *why* — with an AI guide that interprets your chart rather than inventing it.

> 🔭 **The system calculates. The AI interprets. The user decides.**

The experience is designed to feel like entering a living celestial observatory: **accurate underneath, understandable in the middle, immersive on the surface.**

---

## 🚧 Project Status

**Specification phase.** This repository currently contains the product and engineering specifications only — no application code has been written yet.

| 📄 Document | What it covers |
|---|---|
| [Celestara-product-spec.md](Celestara-product-spec.md) | Vision, user journeys, features, visual direction, safety, V1/V2 scope |
| [Celestara-engineering-spec.md](Celestara-engineering-spec.md) | Architecture, calculation layer, AI orchestration, data model, testing, security |

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

### ⚙️ Planned Stack

| Layer | Technology |
|---|---|
| 🖥️ Frontend | Next.js + TypeScript |
| 🐍 Backend | FastAPI + Python + Pydantic |
| 🗄️ Database | PostgreSQL + pgvector |
| 🌟 Calculation | Established astronomical engine behind a service boundary |
| 🧩 AI | Multi-provider model abstraction |
| 📚 Knowledge | RAG over curated astrology material |

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
