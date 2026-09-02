# RiskSūtra — Day 2 Implementation Plan

> **Role**: Lead ML/Risk Engineering Developer  
> **Objective**: Upgrade Day 1 foundation into a measurable, interpretable, context-aware merchant risk detection system featuring Behavioral Genome Analysis, Temporal Workflow Integrity, Fraud-Spike Detection, Graph Abuse-Ring Analysis, and an Evaluation Pipeline.

---

## 1. Discovered Day 1 Architecture & Functionality

### Core Architecture
- **Backend**: FastAPI (`backend/api/main.py`) running on Python 3.14 / Pydantic v2.
- **Database Layer**: Dual-mode persistence in `backend/db/database.py` supporting SQLite (development default `data/risksutra.db`) and PostgreSQL (`DB_TYPE=postgresql`).
- **Domain Schemas**: `Merchant`, `Event`, `RiskSignal`, `RiskAssessment`, `Incident`, `MerchantProfile`, `ScenarioMetadata` (`backend/models/schemas.py`).
- **Engine Infrastructure**:
  - `backend/risk/baseline_engine.py`: Computes statistical merchant profiles and 8 basic deviation signals (`NEW_DEVICE`, `NEW_COUNTRY`, `NEW_ASN`, `HOUR_DEVIATION`, `API_RATE_SPIKE`, `TXN_RATE_SPIKE`, `AMOUNT_ANOMALY`, `SENSITIVE_ACTION_SPIKE`).
  - `backend/risk/fusion_engine.py`: Category-max weighted score aggregation producing composite risk scores (0-100) and automatic incident generation at score >= 56.
  - `backend/services/risk_orchestrator.py`: Pipeline coordinator for event ingestion, profile building, deviation signal calculation, risk fusion, and incident dispatching.
  - `backend/services/synthetic_generator.py`: Generates 4 merchant archetypes (`RESTAURANT`, `SAAS`, `FASHION`, `DIGITAL_SERVICES`), 14 days of baseline traffic, ATO credential theft scenarios, and legitimate sale spikes.
- **Automated Tests**: 27 unit/integration tests in `backend/tests/test_core.py` (100% passing).
- **Frontend**: Next.js 16 command center dashboard rendering risk overview, merchant profiles, top signals, and scenario injection controls.

---

## 2. Files to Modify

1. `backend/models/schemas.py`: Add schemas for `BehavioralGenome`, `WorkflowResult`, `FraudSpikeAssessment`, `AbuseCluster`, `EvaluationMetrics`, updated `RiskSignal`, `RiskAssessment`, `Incident`.
2. `backend/risk/baseline_engine.py`: Upgrade into full **Merchant Behavioral Genome Engine** (adding day-of-week, hourly distribution, endpoint/quantile/sensitive historical statistics) and enhanced interpretable deviation signal generator with reason strings and evidence IDs.
3. `backend/risk/fusion_engine.py`: Update composite risk score calculation to combine Behavioral Deviation, Workflow Integrity, Fraud-Spike Context, and Abuse-Ring Signals with version `ato-v0.2-day2`.
4. `backend/services/risk_orchestrator.py`: Wire up new engines (Temporal Workflow, Fraud Spike, Graph Sentinel) into single ingestion/assessment pipeline.
5. `backend/services/synthetic_generator.py`: Add abuse-ring synthetic scenarios, seasonal/weekend sale spikes, and multi-merchant customer/device entity sharing.
6. `backend/api/main.py`: Add new Day 2 REST endpoints (`/behavior`, `/signals`, `/workflow`, `/fraud-spike`, `/graph/clusters`, `/risk/analytics`, `/incidents/{id}/evidence`).
7. `backend/db/database.py`: Add helper methods for workflow sequences, entity graph queries, and analytics aggregations.
8. `backend/tests/test_core.py`: Add comprehensive unit/integration test cases covering all Day 2 modules.
9. `frontend/src/lib/api.ts` & `frontend/src/app/page.tsx`: Minimal functional updates to display attack chains, workflow integrity, fraud spikes, and graph abuse clusters.

---

## 3. New Components to Add

1. `backend/risk/temporal_engine.py`: Temporal event sequence ordering and transition rarity calculator.
2. `backend/risk/workflow_engine.py`: `WorkflowIntegrityEngine` evaluating attack chain patterns (e.g. `NEW_DEVICE` → `NEW_LOCATION` → `SENSITIVE_CONFIG` → `PAYOUT_CHANGE` → `TRANSACTION_SPIKE`) vs benign high-volume campaigns.
3. `backend/risk/fraud_spike_detector.py`: Sliding window (5m, 15m, 1h) volume, amount, decline rate, and velocity spike detector.
4. `graph/abuse_sentinel.py`: Lightweight NetworkX graph engine (`GraphService`) representing `MERCHANT`, `CUSTOMER`, `DEVICE`, `IP`, `PAYMENT_IDENTIFIER`, and detecting shared-device/IP clusters.
5. `ml/evaluation/evaluator.py` & `ml/evaluation/run_evaluation.py`: Held-out dataset split, precision/recall/F1/FPR metrics calculator, detection lead-time evaluator, and baseline comparison runner.
6. `docs/`:
   - `docs/day2-plan.md` (this file)
   - `docs/risk-engine.md`
   - `docs/behavioral-genome.md`
   - `docs/workflow-integrity.md`
   - `docs/evaluation.md`
   - `docs/evaluation-cost-model.md`
   - `docs/day2-validation.md`

---

## 4. Interfaces Remaining Unchanged

- All existing FastAPI endpoints (`/health`, `/overview`, `/merchants`, `/events`, `/incidents`, `/scenarios/inject`) maintain full backward compatibility.
- DB schema table structures remain compatible (extended cleanly).
- Frontend core component structure is preserved.

---

## 5. Risks & Assumptions

- **Synthetic Data**: All evaluation metrics are derived from reproducible synthetic datasets (seed-fixed). Production claims will be explicitly disclaimed.
- **Explainability**: No black-box ML or LLM scoring in Day 2. Detection is 100% deterministic, statistical, rule-grounded, and testable.
