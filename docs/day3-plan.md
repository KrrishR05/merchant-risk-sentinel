# RiskSūtra Day 3 Implementation Plan — AI Investigator

## Overview
Day 3 introduces the **RiskSūtra AI Investigator**, a deterministic-grounded LLM agent system operating on top of the Day 1 + Day 2 foundation.

## Core Architecture

```
Existing Detection Layer (Behavioral Genome, Temporal Engine, Fraud Spike, Abuse Graph)
        │
        ▼
Structured Evidence & InvestigationContext
        │
        ▼
AI Investigator Agent Framework
 ├── Evidence Retrieval Tools
 ├── AI Provider Abstraction (Gemini + Mock)
 ├── Strict Prompt Guardrails (Prompt Injection Prevention)
 └── Structured Output Schema Validation
        │
        ▼
Structured AI Investigation Result & Audit Trail
        │
        ▼
Frontend Investigator Workspace (Dark Security Interface)
```

## Step-by-Step Implementation Strategy

### Phase 1: Models & Context (`backend/models/schemas.py`, `backend/investigator/context.py`)
- Define schemas for `InvestigationContext`, `AIInvestigationResult`, `AttackStage`, `KeyEvidenceItem`, `LegitimateExplanation`, `InvestigationAuditRecord`.
- Build context extraction service that constructs compact, reproducible contexts from incidents, merchant profiles, signals, and evidence events.

### Phase 2: Evidence Retrieval Tool Layer (`backend/investigator/tools.py`)
- Implement 10 bounded, schema-validated tools:
  1. `get_incident_context`
  2. `get_merchant_behavior`
  3. `get_recent_events`
  4. `get_event_details`
  5. `get_risk_signals`
  6. `get_temporal_workflow`
  7. `get_entity_relationships`
  8. `get_related_incidents`
  9. `get_transaction_context`
  10. `compare_with_merchant_baseline`

### Phase 3: AI Provider Layer (`backend/investigator/providers.py`)
- Implement `AIProvider` base class interface.
- Implement `MockProvider`: Evidence-grounded deterministic rules synthesis provider for automated testing and API key absence.
- Implement `GeminiProvider`: Real Gemini API integration via environment variable (`GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_TIMEOUT`, `GEMINI_MAX_TOKENS`).

### Phase 4: Agent Loop & Fail-safe Orchestration (`backend/investigator/agent.py`)
- Implement bounded investigation loop with execution timeouts, max step counts, prompt injection wrapping (`<untrusted_event_data>`), and schema validation.
- Implement fail-safe fallback when AI provider is unavailable or fails.

### Phase 5: Audit Trail & Database Persistence (`backend/db/database.py`, `backend/investigator/audit.py`)
- Add `ai_investigations` and `ai_investigation_audits` tables to SQLite/PostgreSQL schemas.
- Implement persistence methods for saving and fetching investigations and audit records.

### Phase 6: API Integration (`backend/api/main.py`)
- Implement API endpoints:
  - `POST /incidents/{incident_id}/investigate`
  - `GET /incidents/{incident_id}/investigation`
  - `GET /incidents/{incident_id}/investigation/audit`
  - `GET /incidents/{incident_id}/evidence`

### Phase 7: Frontend Investigator Workspace (`frontend/src/`)
- Update `lib/api.ts` with API functions and types.
- Add AI Investigator panel to `frontend/src/app/page.tsx` with:
  - Assessment verdict & confidence badge
  - Attack progression visual timeline
  - Key evidence breakdown
  - Legitimate explanations considered
  - Defensive action recommendations
  - Audit trail trace drawer
  - Interactive "Run AI Investigation" with progress indicator

### Phase 8: Testing & Scenario Validation (`backend/tests/test_investigator.py`)
- Implement test suite for:
  - Normal merchant activity
  - Isolated transaction spike (must not flag as ATO)
  - Classic ATO sequence
  - Missing evidence / uncertainty
  - Contradictory evidence
  - Provider failure & fallback
  - Schema validation / malformed output
  - Prompt injection protection
  - Tool failure resiliency
  - No API key execution (Mock provider)

### Phase 9: Demo Verification
- Test Scenario 1: Account Takeover.
- Test Scenario 2: Legitimate Campaign Spike.
- Verify full test suite (`python -m pytest`).
