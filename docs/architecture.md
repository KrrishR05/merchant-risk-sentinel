# RiskSūtra — Architecture

## System Overview

RiskSūtra is a merchant risk intelligence system that detects account takeover (ATO) by analyzing behavioral deviations and temporal event sequences per-merchant.

## Component Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    EVENT SOURCES                          │
│          (Synthetic Generator / Webhooks / API)           │
└─────────────────────────┬────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────┐
│                  EVENT INGESTION (FastAPI)                │
│  - Validates schema (Pydantic)                           │
│  - Deduplicates by event_id                              │
│  - Persists to SQLite                                    │
│  - Triggers risk evaluation pipeline                     │
└─────────────────────────┬────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────┐
│              FEATURE EXTRACTION ENGINE                    │
│  - Extracts behavioral features from events              │
│  - Computes per-merchant statistics                      │
│  - Identifies device/IP/country novelty                  │
│  - Computes rate/velocity metrics                        │
└─────────────────────────┬────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────┐
│           MERCHANT BEHAVIORAL GENOME                     │
│  - Per-merchant operational profile                      │
│  - Rolling statistical baselines                         │
│  - Known entities (devices, IPs, countries, ASNs)        │
│  - Activity time distributions                           │
│  - Transaction amount/frequency quantiles                │
└─────────────────────────┬────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────┐
│              DEVIATION CALCULATOR                         │
│  - Compares current behavior to baseline                 │
│  - Z-score based deviation                               │
│  - Entity novelty detection                              │
│  - Rate anomaly detection                                │
│  - Produces typed RiskSignal objects                      │
└─────────────────────────┬────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────┐
│                RISK FUSION ENGINE                         │
│  - Weighted signal combination                           │
│  - Category-based scoring                                │
│  - Risk band classification                              │
│  - Top signal extraction                                 │
│  - Returns: risk_score, risk_band, evidence              │
└─────────────────────────┬────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────┐
│              INCIDENT MANAGER                            │
│  - Creates incidents when risk_band >= HIGH              │
│  - Tracks incident lifecycle                             │
│  - Links signals and evidence events                     │
└─────────────────────────┬────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────┐
│                    API LAYER (FastAPI)                    │
│  GET /merchants, GET /merchants/{id}/risk                │
│  GET /incidents, POST /events, POST /scenarios/inject    │
└─────────────────────────┬────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────┐
│                FRONTEND (Next.js)                         │
│  - Dark fintech command center                           │
│  - Overview dashboard                                    │
│  - Merchant risk view                                    │
│  - Incident display                                      │
└──────────────────────────────────────────────────────────┘
```

## Data Flow

1. Events arrive via POST /events or synthetic injection
2. Events are validated, deduplicated, persisted
3. Behavioral profile is computed/updated from historical events
4. Current behavior is compared against the profile
5. Deviations become typed risk signals
6. Signals are fused into a composite risk score
7. Score exceeding threshold creates an incident
8. Frontend polls API to display current state

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js, TypeScript, Tailwind CSS |
| Backend | Python, FastAPI, Pydantic |
| Database | SQLite (Day 1), PostgreSQL (later) |
| ML | scikit-learn, pandas, numpy |
| Graph | NetworkX (Day 2+) |
| AI | LLM provider TBD (Day 3) |

## Module Boundaries

- `backend/models/` — Domain schemas only. No business logic.
- `backend/services/` — Business logic. Orchestrates repos + engines.
- `backend/risk/` — Scoring algorithms. Pure functions where possible.
- `backend/db/` — Database access. Repository pattern.
- `backend/api/` — HTTP layer only. Thin controllers.
