# Product Specification — V2
## AI Personal Guidance Universe

**Version:** 2.0  
**Status:** Product definition complete  
**Primary experience:** Vedic astrology first, with Western astrology and a unified Compare mode  
**Product principle:** The system calculates. The AI interprets. The user decides.

---

## 1. Product Vision

AI Personal Guidance Universe is a personalized celestial exploration platform that helps users explore their birth chart through Vedic and Western astrology, understand how the two systems differ, explore current transits and life themes, and ask an AI guide questions about their chart.

The product is designed as a reflection and exploration tool. It must not present astrology as scientifically validated certainty or guarantee future outcomes.

The experience should feel like entering a living celestial observatory: accurate underneath, understandable in the middle, and immersive on the surface.

---

## 2. Product Goals

### Primary goals
1. Provide deterministic, reproducible Vedic and Western chart calculations.
2. Make complex astrology understandable to both beginners and experienced users.
3. Let users switch between Vedic, Western, and Compare experiences.
4. Explain not only what differs between systems, but why.
5. Provide contextual AI interpretation grounded in calculated astrology data.
6. Support birth-chart exploration, readings, current transits, and open-ended questions.
7. Give users control over stored birth data, memory, and deletion.
8. Deliver a polished, performant celestial interface with purposeful animation.

### Non-goals
- Proving astrology scientifically.
- Guaranteeing predictions.
- Allowing an LLM to calculate planetary positions.
- Replacing medical, legal, financial, or other qualified professional advice.
- Becoming a general-purpose chatbot.
- Mixing Vedic and Western rules into one calculation system.

---

## 3. Target Users

The product supports:
- Beginners who want simple explanations.
- Experienced astrology users who want technical details and configurable settings.

The UI should adapt depth without forcing users into separate products.

---

## 4. Product Philosophy

### Core rule

> **The calculation engine calculates.  
> The AI interprets.  
> The user decides.**

### Interpretation principles
- Calculated facts must be distinguishable from interpretation.
- Traditional astrology interpretation and AI-generated explanation must be clearly differentiated.
- The AI must communicate uncertainty where appropriate.
- Missing birth information must never be silently fabricated.
- The product should encourage reflection rather than deterministic decision-making.

---

## 5. Astrology Systems

The application contains three modes:

1. **Vedic**
2. **Western**
3. **Compare**

They share the user's birth information but maintain separate calculation and interpretation pipelines.

### Vedic / Jyotish
V1 includes:
- Sidereal zodiac.
- Lahiri/Chitrapaksha as the default ayanamsa.
- Navagraha.
- Rashi / D1 / Janma Kundali.
- Bhavas.
- Nakshatras at a basic informational level.
- Vimshottari Dasha timeline.
- Current Gochar/transits.
- Interactive planet exploration.

Advanced divisional charts and advanced Jyotish analysis are reserved for later versions.

### Western
V1 includes:
- Tropical zodiac.
- Sun, Moon, Ascendant.
- Planets.
- Houses.
- Major aspects.
- Current transits.
- Retrogrades.
- Planetary placements.
- Personality, life-area, relationship, and planet-relationship interpretation.

The Western planet architecture should support an extended planet set while keeping advanced bodies/features expandable.

House systems must be configurable for advanced users.

---

## 6. Compare Mode

Compare is not a simple side-by-side chart viewer.

It is a unified visualization that shows:
1. The relevant Vedic calculation.
2. The relevant Western calculation.
3. Why the calculations differ.
4. How those differences affect interpretation.
5. Practical interpretive differences without declaring a winner.

The system must never claim that Vedic or Western astrology is objectively "more accurate."

The Compare experience should make differences educational and interactive.

---

## 7. First-Time User Journey

1. Animated introduction.
2. Interactive demo celestial universe.
3. Birth-data experience.
4. Date, time, and location collection.
5. Timezone is auto-determined with manual correction.
6. User may explicitly choose unknown birth time.
7. Chart-generation sequence.
8. Celestial dashboard opens.
9. Optional AI introduction.

Birth-data entry should feel like part of the celestial experience rather than a generic form.

---

## 8. Birth Data

Required/available:
- Birth date.
- Birth time when known.
- Birth location.
- Automatically determined timezone.
- Manual timezone correction.

Unknown birth time mode is explicitly supported.

When birth time is unknown:
- Calculate only information that remains appropriate.
- Mark time-dependent calculations as uncertain/unavailable.
- Explain limitations to the user.
- Never invent a default time without clearly identifying it as an assumption.

---

## 9. Home / Dashboard

The home experience combines:

### Celestial Universe
A large interactive celestial environment containing the user's chart and contextual astronomical/astrological information.

### Personal dashboard
Useful information layered into the universe, such as:
- Birth-chart entry point.
- Current relevant transit.
- Today's insight.
- Dasha context.
- Suggested AI questions.
- Reading shortcuts.

Daily information remains secondary to the birth chart.

---

## 10. Navigation

Primary navigation:
- Home.
- Birth Chart.
- Journal.
- Profile.

Vedic, Western, and Compare are core experiences within the celestial system rather than cluttering global navigation.

---

## 11. Vedic Experience

The initial Vedic screen provides:
- Complete chart dashboard.
- Traditional Kundali/Rashi representation.
- Modern celestial visualization.
- Planet exploration.
- Basic Nakshatra information.
- Interactive Vimshottari Dasha timeline.
- Current transit context.
- AI entry points.

### Planet exploration
Users can:
- Select a planet.
- See its relevant calculated factors.
- Explore animated details.
- Ask contextual AI questions.

### Dasha
V1 supports an interactive timeline. Advanced Dasha analysis is deferred.

---

## 12. Western Experience

The Western experience includes:
- Birth-chart visualization.
- Planetary placements.
- Houses.
- Major aspects.
- Retrogrades.
- Transit timeline/context.
- Life-area interpretation.
- Relationship between planetary placements.

Aspect relationships should be represented through traditional aspect lines plus animated connections.

---

## 13. Readings

V1 reading categories:
- Birth chart.
- Career.
- Love.
- Relationships.
- Personal growth.
- Daily.
- Weekly.
- Monthly.

Readings should be organized through categories plus timeline-oriented experiences.

### Daily readings
Daily readings use current calculated planetary/transit data.

Users can:
- View a general daily reading.
- Select a topic.
- Ask follow-up questions.

The product should not generate readings from static templates alone when current transit data is relevant.

---

## 14. AI Guide

The AI Guide is a dedicated experience plus a contextual assistant available throughout the application.

It should feel like a calm celestial guide, not a cartoon character.

### Interaction
Users can:
- Ask open-ended questions.
- Use suggested questions.
- Ask about placements.
- Ask about planets.
- Ask about houses.
- Ask about transits.
- Ask about Dasha context.
- Ask for readings.
- Compare Vedic and Western interpretations.

### Contextual AI
Every major celestial object or exploration point can become an entry point into AI conversation.

Interaction model:

> **Explore → Discover → Ask → Understand**

---

## 15. AI Response Design

Responses may contain:
- Natural-language explanation.
- Astrology cards.
- Highlighted chart factors.
- Animated celestial highlights.
- Expandable technical details.
- Sources/knowledge basis.
- Traditional interpretation vs AI explanation labels.

The AI should adapt explanation depth.

Default:
- Simple explanation.

Expandable:
- Technical factors.
- Exact calculated data.
- Interpretation basis.
- Knowledge sources.

---

## 16. AI Architecture Behavior

The AI receives structured calculated data rather than raw birth data and being expected to calculate the chart itself.

Relevant inputs may include:
- Birth-chart facts.
- Current transit facts.
- Dasha facts.
- User-selected topic.
- Relevant knowledge-base material.
- User-approved memory/context.

The AI chooses or receives the relevant factors based on the question.

---

## 17. AI Orchestration

Conceptual pipeline:

```text
User
  ↓
AI Orchestrator
  ↓
Question Classification / Intent
  ↓
Astrology Tools
  ├── Vedic Calculation Service
  ├── Western Calculation Service
  ├── Transit Service
  └── Chart Data Service
  ↓
Structured Astrology Context
  ↓
Interpretation Agent
  ↓
Personalized Guidance
  ↓
Celestial UI
```

Vedic and Western interpretation remain separate internally and are unified only by Compare.

---

## 18. Knowledge / RAG

V1 uses RAG for curated astrology knowledge.

Knowledge base should cover:
- Vedic concepts.
- Western concepts.
- Traditional interpretation references.
- Technical calculation explanations.
- Educational definitions.

User chart data should come from structured application data, not vector search.

External web information is not automatically used for readings.

Current external information should be used only where appropriate, such as explicitly requested current information, while astronomical/transit data and curated astrology knowledge remain controlled sources.

---

## 19. AI Memory

Memory is persistent but user-controlled.

Potential memory:
- Astrology preferences.
- Frequently discussed topics.
- Important user-approved reflection/context.
- Explanation-depth preferences.

The system must not automatically assume that every conversation detail should become permanent memory.

Users must be able to manage and delete memory.

---

## 20. Pattern Detection

The AI may occasionally identify useful recurring themes, such as repeated career questions.

Pattern detection must:
- Avoid overwhelming users.
- Avoid claiming psychological certainty.
- Be transparent that it is based on conversation/context.
- Be user-controllable.

---

## 21. Safety / High-Stakes Guidance

The AI must not present astrology as a reliable basis for:
- Medical/health decisions.
- Legal decisions.
- Financial investments.
- Major life decisions requiring qualified advice.

For questions such as "Will I definitely get this job?", the AI should:
- Avoid certainty.
- Explain the relevant interpretive factors.
- Reframe toward reflection.
- Avoid promising outcomes.

For high-stakes questions, the product should encourage appropriate qualified professional advice where relevant.

---

## 22. Scientific / Interpretive Disclaimer

Onboarding must communicate that:
- Astrology is an interpretive/traditional framework.
- The product does not establish astrology as scientifically validated prediction.
- Readings are for reflection and exploration rather than certainty.

Contextual notices should appear when users ask high-stakes questions.

---

## 23. Transparency

Every AI interpretation should distinguish:
1. Calculated chart facts.
2. Traditional astrology interpretation.
3. AI-generated explanation.
4. User-specific contextual interpretation.

Technical details should be available through an expandable layer.

The system should be capable of exposing:

```text
Question
↓
Chart factors used
↓
Transit factors used
↓
Knowledge retrieved
↓
AI interpretation
```

---

## 24. Beginner / Expert Experience

The application supports:
- Beginner-friendly explanations by default.
- Expandable technical detail.
- A global user preference for explanation depth.
- User-controlled technical expansion at any point.

Technical details may include:
- Exact placements.
- Degrees.
- House system.
- Ayanamsa.
- Calculation configuration.
- Relevant aspects/factors.

---

## 25. Visual Direction

### Design concept
**Cosmic Observatory × Ancient + Modern**

The interface should combine:
- Celestial observatory aesthetics.
- Traditional astronomical/astrological geometry.
- Modern data visualization.
- Elegant typography.
- Depth and atmosphere.
- Minimal but immersive UI.

Vedic and Western experiences should have distinct visual personalities while clearly belonging to the same universe.

### Vedic visual personality
Potential language:
- Ancient astronomical instruments.
- Geometric/mandala-inspired structures.
- Traditional chart geometry.
- Deep celestial environment.

### Western visual personality
Potential language:
- Modern observatory.
- Constellation mapping.
- Geometric planetary relationships.
- Contemporary celestial visualization.

---

## 26. Animation System

Default animation:
- Subtle.
- Fast.
- Purposeful.
- Never blocking.

Major experiences can become immersive.

### Signature animations

#### Chart generation
The zodiac wheel draws itself and celestial elements populate it.

#### Vedic → Western
The entire celestial environment transforms rather than simply changing a tab.

#### AI processing
Multiple celestial bodies connect while the AI processes the request.

#### Compare
The celestial environment reorganizes into a unified comparison visualization.

Animations must never reduce performance or delay the user unnecessarily.

---

## 27. Performance Priority

Product priorities:

1. Astrology calculation accuracy.
2. Performance.
3. UI/UX.
4. AI interpretation quality.
5. Animation/visual experience.
6. Feature breadth.

Feature breadth must never compromise calculation reliability or core performance.

---

## 28. Account & Profile

The user can initially explore without requiring an account.

An account becomes useful when saving:
- Birth profile.
- Chart configuration.
- Reading history.
- AI memory.
- Journal data.
- Preferences.

There is one personal profile in V1.

Compatibility and multiple profiles are deferred.

---

## 29. Privacy & Data Control

User data controls are first-class product functionality.

Supported controls:
- Save/delete birth information.
- Manage saved calculation configuration.
- Manage AI memory.
- Delete stored data.
- One-click "Delete my data" flow.

Data storage should follow user settings and privacy requirements.

---

## 30. Journal

Journal is present in the navigation for V2 planning.

Its role is reflective rather than predictive.

Potential future AI functionality:
- Identify recurring themes in user-approved journal entries.
- Surface reflection patterns.
- Provide context to the Guidance Agent.

Advanced journal intelligence should not be allowed to expand beyond the defined V2 scope without a new product decision.

---

## 31. V1 / V2 Boundary

The initial build should prioritize the core experience.

### Included
- Vedic D1/Rashi.
- Western intermediate chart.
- Compare.
- Birth data.
- Unknown birth-time handling.
- Current relevant transits.
- Daily/weekly/monthly readings.
- Career/love/relationships/growth readings.
- AI Guide.
- Curated RAG.
- User-controlled memory.
- Basic Nakshatra.
- Vimshottari Dasha timeline.
- Interactive planet exploration.
- Beginner/technical explanation depth.
- Privacy/deletion controls.
- Celestial UI and signature animations.

### Deferred
- Advanced Vedic divisional charts.
- Advanced Nakshatra analysis.
- Advanced Dasha analysis.
- Advanced Western astrology.
- Compatibility.
- Advanced AI pattern detection.
- Advanced personalization.
- Multiple profiles.
- Community/social features.

The architecture should allow these later without requiring a complete rewrite.

---

## 32. Success Criteria

The V2 product succeeds when a user can:

1. Enter birth data naturally.
2. Understand what information is available and what is limited.
3. Generate a reproducible chart.
4. Explore Vedic astrology visually.
5. Explore Western astrology visually.
6. Understand why the systems differ.
7. See current relevant transit context.
8. Ask the AI meaningful chart questions.
9. See what factors informed the AI response.
10. Move between simple and technical explanations.
11. Receive reflective rather than deterministic guidance.
12. Control and delete their stored data.
13. Experience the product as fast and polished rather than animation-heavy for its own sake.

---

## 33. Product Guardrails

The implementation must not:
- Ask the LLM to calculate planetary positions.
- Mix sidereal and tropical calculations accidentally.
- Hide missing/uncertain birth-time limitations.
- Present AI interpretation as objective fact.
- Claim scientific validation.
- Guarantee future outcomes.
- Add major features outside the approved scope without an explicit product decision.
- Sacrifice calculation accuracy for visual effects.
