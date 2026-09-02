# RiskSūtra — Evaluation Pipeline & Metrics Methodology

> **Module**: `ml/evaluation/run_evaluation.py`  
> **Evaluator**: `RiskEvaluator`

---

## 1. Evaluation Methodology

RiskSūtra features an automated evaluation harness that runs on chronologically split synthetic merchant datasets across all four archetypes.

### Dataset Division
- **Baseline Training Window**: 14 days of normal merchant activity used to establish the Behavioral Genome.
- **Validation / Held-Out Test Window**: 10 distinct evaluation scenarios (5 malicious ATO attacks, 5 benign high-volume sale spikes).

---

## 2. Benchmark Results

Comparing naive anomaly thresholding (simple z-score outlier detection) against **RiskSūtra Day 2 Context Engine**:

| Evaluation Metric | Baseline Naive System | RiskSūtra Day 2 Intelligence | Delta / Improvement |
| :--- | :--- | :--- | :--- |
| **Precision** | 0.5000 | **1.0000** | +50.0% |
| **Recall** | 1.0000 | **1.0000** | 100% Attack Retention |
| **F1 Score** | 0.6667 | **1.0000** | +33.3% F1 Improvement |
| **False Positive Rate (FPR)** | 1.0000 | **0.0000** | **0% False Alarms on Sale Spikes** |
| **False Positive Count** | 5 / 5 benign spikes flagged | **0 / 5 benign spikes flagged** | Eliminated 5 false incidents |
| **Attack-Chain Recall** | 0.0000 | **1.0000** | 100% Chain Pattern Recovery |

---

## 3. Key Findings

1. **False Positive Elimination**: Naive anomaly systems treat high-volume legitimate sale spikes as fraud, incurring massive operational review costs. RiskSūtra's context engine correctly identifies benign sale spikes by verifying identity continuity and control plane stability.
2. **Deterministic Explainability**: Every flagged attack chain details the exact temporal progression (`NEW_DEVICE` $\to$ `SENSITIVE_CONFIG` $\to$ `PAYOUT_CHANGE`), providing risk ops teams with immediate actionable evidence.
