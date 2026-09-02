# RiskSūtra — Risk Engine & Fusion Methodology

> **Model Version**: `ato-v0.2-day2`  
> **Classification**: Multi-Signal Category Risk Fusion with Temporal Workflow Context

---

## 1. Overview & Principles

RiskSūtra avoids black-box opaque scoring models. All merchant risk assessments are **100% deterministic, explainable, and grounded in concrete evidence event logs**.

The engine combines four distinct detection layers:
1. **Behavioral Genome Engine**: Computes merchant statistical baselines and identifies single-dimension anomalies.
2. **Temporal Workflow Integrity Engine**: Tracks state transitions across event streams to identify multi-step Account Takeover (ATO) progressions.
3. **Sliding-Window Fraud-Spike Detector**: Evaluates volume, amount, and decline rate surges to separate legitimate promotional sales from fraud.
4. **Abuse-Ring Graph Sentinel**: Constructs multi-entity relationship graphs to identify syndicate device/IP reuse across merchants.

---

## 2. Category Weights & Scoring Strategy

Risk signals are categorized into 5 primary risk dimensions:

| Risk Category | Weight | Signals Mapped | Description |
| :--- | :--- | :--- | :--- |
| **Identity & Novelty** | 0.25 | `NEW_DEVICE`, `NEW_COUNTRY`, `NEW_IP`, `NEW_ASN` | Unfamiliar device fingerprints, geographic shifts, or proxy networks. |
| **Behavioral Deviation** | 0.20 | `UNUSUAL_HOUR`, `TRANSACTION_AMOUNT_ANOMALY` | Off-peak operation hours or high-value outlier transactions. |
| **Sensitive Actions** | 0.20 | `SENSITIVE_ACTION_ANOMALY`, `AUTH_FAILURE_ANOMALY` | Control plane modifications (payout account, webhook, credentials). |
| **Operational Anomaly** | 0.15 | `API_RATE_ANOMALY` | Rapid API call spikes indicating automated account scanning or key abuse. |
| **Velocity** | 0.10 | `TRANSACTION_RATE_ANOMALY` | Transaction request frequency surges. |

### Category-Max Aggregation
To prevent score dilution when multiple weak events occur, RiskSūtra applies a **Category-Max** strategy:
$$\text{CategoryScore}(c) = \max_{s \in \text{Signals}(c)} \text{Value}(s)$$

$$\text{BaseRiskScore} = \sum_{c} \text{Weight}(c) \times \text{CategoryScore}(c)$$

---

## 3. Workflow & Graph Context Integration

The base risk score is combined with temporal workflow and syndicate graph features:

$$\text{CombinedScore} = 0.80 \times \text{BaseRiskScore} + 0.20 \times \text{WorkflowScore}$$

### Multiplier Rules
- **Attack Chain Booster**: If a `CONTROL_PLANE_TAKEOVER_CHAIN` pattern is detected (`NEW_DEVICE` $\to$ `SENSITIVE_CONFIG` $\to$ `PAYOUT_CHANGE`), the score is floored at **0.75** (HIGH/CRITICAL).
- **Legitimate Sale Damping**: If the Fraud-Spike Detector classifies a surge as `BENIGN_SALE_SPIKE` with known devices and zero control plane changes, the composite score is capped at **0.25** (LOW).

---

## 4. Risk Bands & Incident Creation

| Composite Risk Score | Risk Band | Action / Incident Trigger |
| :--- | :--- | :--- |
| **0.0 — 30.99** | `LOW` | Normal operation. Log signals. |
| **31.00 — 55.99** | `MEDIUM` | Elevated monitoring. Request 2FA step-up. |
| **56.00 — 80.99** | `HIGH` | **Incident Auto-Created**. Freeze payouts. |
| **81.00 — 100.0** | `CRITICAL` | **Incident Auto-Created**. Suspend control plane & freeze account. |
