# RiskSūtra — Risk Scoring Methodology

## Overview

The risk scoring engine combines multiple behavioral deviation signals into a composite ATO risk score. The approach is deterministic, reproducible, and explainable.

## Signal Categories

| Category | Weight | Signals |
|----------|--------|---------|
| **Identity Novelty** | 0.25 | New device, new IP, new country, new ASN |
| **Behavioral Deviation** | 0.25 | Hour deviation, transaction rate, amount deviation |
| **Operational Anomaly** | 0.20 | API rate spike, endpoint anomaly |
| **Sensitive Actions** | 0.20 | Config changes, payout changes, account actions |
| **Velocity** | 0.10 | Transaction velocity spike, API burst |

## Scoring Method

### Step 1: Signal Generation
Each event or time window generates typed `RiskSignal` objects with:
- signal_type (enum)
- value (0.0–1.0 normalized severity)
- severity (LOW / MEDIUM / HIGH / CRITICAL)
- source (which engine produced it)
- evidence_event_ids

### Step 2: Category Aggregation
Signals are grouped by category. Within each category, the maximum signal value is taken (not average) to prevent dilution by low signals.

### Step 3: Weighted Fusion
```
risk_score = Σ (category_weight × category_max_signal)
```

Normalized to 0–100.

### Step 4: Risk Band Classification
| Band | Score Range |
|------|-------------|
| LOW | 0–30 |
| MEDIUM | 31–55 |
| HIGH | 56–80 |
| CRITICAL | 81–100 |

### Step 5: Incident Creation
Incidents are created when risk_band ≥ HIGH.

## Why Not Simple Averaging?

Averaging dilutes high-severity signals. If a merchant has 5 normal signals and 1 critical signal, an average suggests moderate risk. Max-per-category ensures that a single critical signal in any category correctly elevates the overall score.

## Day 1 Calibration

Day 1 weights are heuristic. Day 2 will introduce:
- Held-out evaluation with precision/recall/F1
- Threshold optimization
- Potential ML-based fusion (if justified by evaluation)

## Reproducibility

Given the same events and the same model_version, the same risk_score must always result. No randomness in scoring.

## Model Versioning

Every risk response includes `model_version` to track scoring changes over time.

Current: `v0.1.0-statistical`
