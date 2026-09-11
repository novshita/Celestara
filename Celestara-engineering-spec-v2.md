# Engineering Specification — V2
## AI Personal Guidance Universe

**Version:** 2.0  
**Status:** Architecture definition  
**Frontend:** Next.js  
**Backend:** FastAPI  
**Database:** PostgreSQL + pgvector  
**AI strategy:** Multi-provider model abstraction  
**Core engineering principle:** Deterministic calculation first; AI interpretation second.

---

## 1. Engineering Goals

The system must be:
- Deterministic for astrology calculations.
- Reproducible.
- Modular.
- Testable.
- Performant.
- Secure.
- Transparent about AI inputs.
- Extensible for future astrology features.
- Provider-independent at the AI layer.

---

## 2. High-Level Architecture

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
                         │ Application Backend   │
                         └──────────┬───────────┘
                                    │
              ┌─────────────────────┼─────────────────────┐
              │                     │                     │
              ▼                     ▼                     ▼
      Vedic Calculation      Western Calculation     Transit Engine
           Service                 Service
              │                     │                     │
              └─────────────────────┼─────────────────────┘
                                    ▼
                         Structured Astrology Data
                                    │
              ┌─────────────────────┼─────────────────────┐
              │                     │                     │
              ▼                     ▼                     ▼
        AI Orchestrator        Knowledge/RAG        User Memory
              │                     │                     │
              └─────────────────────┼─────────────────────┘
                                    ▼
                         Interpretation Pipeline
                                    │
                                    ▼
                              Next.js UI
```

---

## 3. Frontend

### Stack
- Next.js.
- TypeScript.
- Component-driven architecture.
- Responsive web experience with desktop-first optimization.
- Animation layer suitable for high-performance celestial visualization.

### Frontend responsibilities
- Navigation.
- Birth-data wizard.
- Celestial visualization.
- Chart visualization.
- Vedic/Western/Compare transitions.
- Reading interfaces.
- AI Guide UI.
- Technical detail expansion.
- Profile/privacy controls.
- Journal interface.
- Loading and calculation states.

The frontend must not own authoritative astrology calculations.

---

## 4. Backend

### Stack
- FastAPI.
- Python.
- Pydantic models.
- Service-oriented internal modules.

Suggested structure:

```text
backend/
├── app/
│   ├── api/
│   │   ├── routes/
│   │   └── dependencies/
│   ├── core/
│   ├── models/
│   ├── schemas/
│   ├── services/
│   │   ├── astrology/
│   │   │   ├── vedic/
│   │   │   ├── western/
│   │   │   ├── transit/
│   │   │   └── common/
│   │   ├── ai/
│   │   │   ├── orchestrator/
│   │   │   ├── providers/
│   │   │   ├── prompts/
│   │   │   ├── rag/
│   │   │   └── memory/
│   │   └── readings/
│   ├── repositories/
│   └── main.py
└── tests/
```

Exact package names may change during implementation, but responsibilities must remain separated.

---

## 5. Astrology Calculation Layer

### Critical rule

The LLM must never be the source of truth for planetary positions, houses, aspects, Nakshatras, Dashas, or transit calculations.

Use an established astronomical/astrological calculation engine behind a backend service boundary.

The implementation must validate the selected engine/library before locking its API because calculation accuracy is the #1 product priority.

### Required characteristics
- Deterministic.
- Reproducible.
- High-precision astronomical data where supported.
- Explicit configuration.
- Versioned calculation behavior.
- Unit tests against known reference charts.

---

## 6. Vedic Calculation Service

Responsibilities:
- Sidereal zodiac.
- Lahiri/Chitrapaksha default.
- Rashi/D1.
- Navagraha.
- Bhavas.
- Nakshatra.
- Vimshottari Dasha.
- Gochar/transit data.
- Relevant degrees/positions.

The service must return structured data rather than prose.

Example conceptual result:

```json
{
  "system": "vedic",
  "zodiac": "sidereal",
  "ayanamsa": "lahiri",
  "chart_type": "D1",
  "placements": [],
  "houses": [],
  "nakshatras": [],
  "dasha": {},
  "metadata": {}
}
```

Do not hard-code this exact schema until the selected calculation engine is validated.

---

## 7. Western Calculation Service

Responsibilities:
- Tropical zodiac.
- Sun/Moon/Ascendant.
- Supported planets.
- Houses.
- Major aspects.
- Retrogrades.
- Current transits.

House system must be configurable.

Default house-system choice must be an explicit configuration rather than buried in business logic.

Example conceptual result:

```json
{
  "system": "western",
  "zodiac": "tropical",
  "house_system": "configured",
  "placements": [],
  "houses": [],
  "aspects": [],
  "retrogrades": [],
  "metadata": {}
}
```

---

## 8. Calculation Configuration

Calculation configuration must be explicit and persisted where required.

Potential settings:
- Astrology system.
- Zodiac.
- Ayanamsa.
- House system.
- Supported celestial bodies.
- Birth-time confidence.
- Calculation engine/version.

Advanced users may modify supported configuration options.

Beginner users should receive sensible defaults.

---

## 9. Unknown Birth Time

The calculation pipeline must carry birth-time confidence.

Example conceptual states:

```text
EXACT
ESTIMATED
UNKNOWN
```

For UNKNOWN:
- Do not fabricate an exact Ascendant.
- Do not silently invent house positions.
- Mark time-dependent calculations unavailable or uncertain.
- Return explanatory metadata to the frontend and AI.

The AI must receive these limitations in structured context.

---

## 10. Reproducibility

A chart must be reproducible using:
- Original birth data, subject to privacy settings.
- Calculation configuration.
- Calculation engine/version.
- Relevant astronomical data/version where applicable.

The system should preserve enough metadata to explain why a result was generated.

---

## 11. Transit Engine

The transit engine provides current astronomical/astrological positions when required.

Use cases:
- Daily readings.
- Weekly readings.
- Monthly readings.
- User questions where current transits are relevant.
- Transit timelines.
- Retrograde visualization.

The system should calculate only when necessary and cache safely where possible.

Current transit data must never be invented by the LLM.

---

## 12. AI Orchestrator

The orchestrator is responsible for:
1. Receiving the user request.
2. Classifying intent.
3. Determining relevant astrology system(s).
4. Determining whether current transit data is required.
5. Calling calculation services/tools.
6. Retrieving relevant knowledge.
7. Retrieving approved memory/context.
8. Constructing structured AI context.
9. Calling the selected model.
10. Validating the output.
11. Returning a structured response to the UI.

---

## 13. AI Provider Abstraction

The application must not be tightly coupled to one LLM provider.

Conceptually:

```text
AIProvider
├── ProviderA
├── ProviderB
└── ProviderC
```

The application selects the model internally based on task requirements.

Users do not choose models in V2.

Provider credentials must remain server-side and must never be exposed to the frontend.

---

## 14. AI Intent Classification

At minimum, distinguish:
- Birth-chart explanation.
- Vedic question.
- Western question.
- Compare question.
- Planet exploration.
- Transit question.
- Dasha question.
- Reading request.
- General astrology education.
- High-stakes question.
- Unsupported/general non-astrology request.

The classifier may be implemented using deterministic rules, an LLM classifier, or a hybrid approach depending on performance and reliability testing.

---

## 15. AI Context Construction

Do not send unnecessary raw application data to the model.

Build a structured context object containing only relevant information.

Possible sections:

```text
USER QUESTION
ASTROLOGY SYSTEM
CALCULATED FACTORS
CURRENT TRANSITS
DASHA CONTEXT
USER TOPIC
APPROVED MEMORY
RETRIEVED KNOWLEDGE
BIRTH-TIME CONFIDENCE
CALCULATION CONFIGURATION
SAFETY FLAGS
```

---

## 16. Interpretation Separation

Internal interpretation modules must remain separated:

```text
Vedic Interpretation
Western Interpretation
        │
        ▼
Compare Interpretation
```

Compare may consume both outputs/data structures, but Vedic and Western calculation rules must not be merged.

---

## 17. RAG Architecture

Use RAG for curated astrology knowledge.

Pipeline:

```text
Question
 ↓
Knowledge Retrieval
 ↓
Relevant curated documents
 ↓
Context builder
 ↓
AI interpretation
```

### Knowledge categories
- Vedic definitions.
- Western definitions.
- Traditional interpretive references.
- Technical calculation explanations.
- Educational material.

Use metadata filters such as:
- system = vedic/western/common
- topic
- technical_level
- source_type

---

## 18. PostgreSQL + pgvector

PostgreSQL is the primary application database.

Use pgvector for curated knowledge embeddings where semantic retrieval is appropriate.

Do not use vectors as the primary storage mechanism for:
- Birth charts.
- Planetary positions.
- Houses.
- Dashas.
- Transits.
- User configuration.

Those belong in structured relational tables.

---

## 19. Conceptual Data Model

Core entities:

```text
User
Profile
BirthData
CalculationConfiguration
Chart
ChartPlacement
House
Aspect
Nakshatra
DashaPeriod
TransitSnapshot
Reading
Conversation
ConversationMessage
Memory
JournalEntry
KnowledgeDocument
KnowledgeChunk
AITrace
```

Relationships must be designed so chart calculations can be versioned/recreated.

---

## 20. Privacy Model

Birth data and personal reflection data are sensitive application data.

Requirements:
- Encrypt data in transit.
- Encrypt sensitive data at rest where appropriate.
- Apply least-privilege access.
- Never expose private birth data to client logs.
- Never put AI provider secrets in frontend code.
- Avoid logging full user conversations by default.
- Separate operational logs from user content.

---

## 21. User-Controlled Memory

Memory operations:

```text
Create memory
Review memory
Update memory
Delete memory
Disable memory
Delete all memory
```

Memory must have clear ownership and authorization checks.

The AI should only receive memory that is allowed by the user's settings.

---

## 22. AI Audit Trail

Maintain an internal trace for important AI responses.

Conceptual trace:

```text
request_id
user_question
intent
astrology_system
calculation_reference
chart_factors_used
transit_factors_used
knowledge_chunks_used
memory_used
model_provider
model_identifier
response
safety_flags
timestamp
```

User-facing technical details can expose an appropriate subset.

Do not expose secrets, internal system prompts, or private infrastructure metadata.

---

## 23. API Design

Conceptual endpoint groups:

```text
POST   /api/v1/profile
GET    /api/v1/profile

POST   /api/v1/birth-data
PUT    /api/v1/birth-data

POST   /api/v1/charts/vedic
POST   /api/v1/charts/western
POST   /api/v1/charts/compare

GET    /api/v1/transits
GET    /api/v1/dashas

GET    /api/v1/readings/daily
GET    /api/v1/readings/weekly
GET    /api/v1/readings/monthly

POST   /api/v1/ai/chat
GET    /api/v1/ai/conversations

GET    /api/v1/memory
DELETE /api/v1/memory/{id}

GET    /api/v1/journal
POST   /api/v1/journal
PUT    /api/v1/journal/{id}
DELETE /api/v1/journal/{id}

DELETE /api/v1/account/data
```

These are architectural examples, not immutable contracts. Final contracts must be derived from actual domain schemas.

---

## 24. Frontend State

Separate:
- UI state.
- User/profile state.
- Chart state.
- Calculation configuration.
- AI conversation state.
- Animation state.

Do not allow animation state to become the source of truth for astrology data.

---

## 25. Celestial Visualization Architecture

The visualization layer should consume structured chart/transit data.

It should support:
- Zodiac wheel.
- Planet objects.
- Houses.
- Aspect connections.
- Nakshatra indicators where applicable.
- Dasha timeline.
- Transit timeline.
- Compare overlays.
- Interactive selection.
- AI-driven highlighting.

The visualization must remain decoupled from calculation services.

---

## 26. Animation Requirements

Animations should be event-driven.

Examples:

```text
CHART_GENERATION_STARTED
CHART_CALCULATED
CHART_READY

SYSTEM_SWITCH_STARTED
SYSTEM_SWITCH_COMPLETED

AI_REQUEST_STARTED
AI_FACTORS_READY
AI_RESPONSE_READY
```

This allows visual effects to respond to actual application events rather than arbitrary timers.

Animations must:
- Be interruptible.
- Support reduced-motion preferences.
- Avoid blocking API operations.
- Degrade gracefully on lower-powered devices.

---

## 27. Performance

Performance is priority #2 after calculation accuracy.

Requirements:
- Lazy-load heavy visualization modules.
- Cache reusable chart calculations safely.
- Avoid recalculating unchanged birth charts.
- Stream AI responses where appropriate.
- Keep animation work off the critical data path.
- Minimize unnecessary network calls.
- Paginate or virtualize long conversation/journal content.

Measure:
- initial load.
- time to interactive.
- chart-generation latency.
- API latency.
- AI first-token latency.
- visualization frame performance.

Actual numeric budgets should be established after prototype profiling rather than guessed.

---

## 28. Caching

Potential cache candidates:
- Reproducible birth-chart calculations.
- Transit snapshots.
- Knowledge retrieval results where safe.
- Non-personalized metadata.

Never cache private user data across users.

Cache keys must include relevant calculation configuration/version.

---

## 29. Error Handling

Errors must distinguish:

```text
INVALID_BIRTH_DATA
UNKNOWN_BIRTH_TIME
CALCULATION_ERROR
UNSUPPORTED_CONFIGURATION
TRANSIT_DATA_UNAVAILABLE
AI_PROVIDER_ERROR
KNOWLEDGE_RETRIEVAL_ERROR
AUTHORIZATION_ERROR
DATA_DELETION_ERROR
```

The frontend should show human-readable explanations.

The AI must not fill gaps by inventing missing calculation results.

---

## 30. Safety Pipeline

Before AI generation:
- Detect high-stakes intent.
- Add safety context.
- Limit deterministic/predictive framing.

After generation:
- Validate that the response does not claim certainty.
- Check for prohibited/high-risk decision framing.
- Ensure disclaimers are present when required.

A safety failure should trigger a safe fallback response.

---

## 31. Testing Strategy

### Calculation tests
Highest priority.

Test:
- Known birth charts.
- Timezone handling.
- DST/timezone edge cases.
- Sidereal calculations.
- Lahiri ayanamsa.
- Tropical calculations.
- House systems.
- Aspects.
- Nakshatra.
- Vimshottari Dasha.
- Transit calculations.
- Unknown birth-time behavior.

### API tests
- Request validation.
- Authorization.
- Error handling.
- Data deletion.
- Configuration changes.

### AI tests
- Correct structured context.
- No invented chart facts.
- Vedic/Western separation.
- Compare explanations.
- High-stakes handling.
- Missing-data handling.
- Memory permission behavior.
- Citation/knowledge grounding.

### Frontend tests
- Birth wizard.
- Chart rendering.
- System switching.
- Compare.
- AI chat.
- Responsive behavior.
- Reduced motion.
- Accessibility.

### End-to-end tests
Representative journeys:
1. New user → chart.
2. Vedic exploration.
3. Western exploration.
4. Compare.
5. Transit reading.
6. AI question.
7. Unknown birth time.
8. Memory management.
9. Delete all data.

---

## 32. Observability

Track system health without unnecessarily storing personal content.

Metrics:
- calculation latency.
- calculation failures.
- transit failures.
- AI latency.
- AI provider failures.
- retrieval latency.
- API errors.
- frontend performance.
- animation performance where measurable.

Use request IDs for tracing.

---

## 33. Security

Requirements:
- Server-side secrets only.
- Authentication and authorization for saved data.
- Input validation through Pydantic/backend schemas.
- Rate limiting on AI endpoints.
- Protection against prompt injection through retrieved content.
- Sanitize user-provided journal/content where rendered.
- Prevent cross-user data access.
- Secure deletion workflows.
- Dependency and container vulnerability scanning.

---

## 34. Prompt Injection / RAG Security

Retrieved documents must be treated as untrusted content.

The model must not interpret knowledge-base instructions as system instructions.

Knowledge documents should be curated and versioned.

User-provided journal/conversation content must never override application safety or calculation rules.

---

## 35. Deployment

Target deployment should support:
- Next.js frontend.
- FastAPI backend.
- PostgreSQL.
- pgvector.
- Calculation engine dependencies.
- Background jobs where needed.

Containerization is recommended for reproducible environments.

Production deployment should separate:
- frontend.
- API.
- database.
- worker/background processing where required.

---

## 36. Background Jobs

Potential asynchronous jobs:
- Daily reading preparation where explicitly enabled.
- Transit snapshot generation.
- Knowledge ingestion/embedding.
- Cleanup/deletion jobs.
- Analytics/operational processing that does not require synchronous responses.

Do not introduce background infrastructure until a concrete requirement exists.

---

## 37. Configuration Management

Application configuration should be environment-driven.

Examples:
- Database URL.
- AI provider credentials.
- Default astrology configuration.
- Knowledge-base configuration.
- Feature flags.
- Logging level.
- Cache configuration.

Secrets must never be committed to source control.

---

## 38. Feature Flags

Use feature flags for:
- Advanced astrology settings.
- Experimental visualization.
- Advanced AI pattern detection.
- Future compatibility.
- New calculation engines/providers.

This allows controlled rollout without changing core architecture.

---

## 39. V1/V2 Engineering Boundary

### Build now
- Core Vedic D1.
- Western intermediate system.
- Compare engine.
- Transit engine.
- Basic Nakshatra.
- Vimshottari timeline.
- AI orchestration.
- Curated RAG.
- User-controlled memory.
- Core journal.
- Celestial visualization.
- Signature animations.
- Privacy/deletion.
- Calculation configuration foundation.

### Architect for later, but do not fully implement
- Divisional charts.
- Advanced Nakshatra.
- Advanced Dasha.
- Advanced Western features.
- Compatibility.
- Advanced pattern detection.
- Advanced personalization.
- Multiple profiles.
- Community/social features.

---

## 40. Engineering Guardrails

The implementation must not:
1. Ask an LLM to calculate astrology.
2. Mix sidereal and tropical data accidentally.
3. Hide calculation uncertainty.
4. Hard-code calculation assumptions inside UI components.
5. Make animation the source of truth.
6. Couple the domain model to one LLM provider.
7. Store chart facts only as embeddings.
8. Expose API/provider secrets to the browser.
9. Allow user memory to override safety rules.
10. Add out-of-scope features merely because they are technically easy.

---

## 41. Definition of Done

The core V2 implementation is considered technically ready when:

- Known reference charts reproduce expected calculations.
- Calculation configuration is explicit and testable.
- Unknown birth time is handled correctly.
- Vedic and Western pipelines remain separate.
- Compare explains differences without declaring a winner.
- AI responses are grounded in structured calculation data.
- RAG retrieval is limited to curated knowledge.
- Memory is user-controlled.
- High-stakes requests are safely handled.
- AI traces can explain relevant factors.
- Core UI interactions work without unnecessary loading.
- Major animations are performant and interruptible.
- Users can delete their stored data.
- Automated tests cover critical calculation and safety paths.
