"""
RiskSūtra — Evaluation Pipeline Runner

Generates chronologically split synthetic evaluation datasets across merchant archetypes.
Executes baseline naive thresholding vs RiskSūtra Day 2 Context Engine.
Measures Precision, Recall, F1, FPR, Lead Time, and Attack-Chain Recall.

Usage:
    python ml/evaluation/run_evaluation.py
"""

import sys
import os
from datetime import datetime, timedelta

# Ensure root & backend are at head of sys.path
root_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
backend_dir = os.path.join(root_dir, "backend")
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from backend.db import database as db
from backend.models.schemas import Event, Merchant
from backend.services.synthetic_generator import (
    generate_merchants,
    generate_normal_events,
    inject_ato_credential_theft,
    inject_legitimate_spike,
)
from backend.risk.baseline_engine import build_merchant_profile, compute_deviation_signals
from backend.risk.workflow_engine import WorkflowIntegrityEngine
from backend.risk.fraud_spike_detector import FraudSpikeDetector
from backend.risk.fusion_engine import compute_risk_assessment
from backend.graph.abuse_sentinel import GraphService
from ml.evaluation.evaluator import RiskEvaluator


def run_evaluation():
    print("=" * 75)
    print("RiskSutra -- Day 2 Evaluation Pipeline")
    print("=" * 75)

    # 1. Initialize temporary test database
    db.init_db()

    merchants = generate_merchants()
    for m in merchants:
        db.save_merchant(m)

    print(f"\n[1/4] Generated {len(merchants)} merchants across archetypes.")

    # Generate historical training & validation background events (14 days)
    print("[2/4] Generating chronological baseline history (14 days)...")
    for m in merchants:
        normal_events = generate_normal_events(m, days=14)
        db.save_events_bulk(normal_events)

    # 2. Generate Evaluation Test Scenarios (10 test scenarios: 5 attacks, 5 benign sales spikes)
    print("[3/4] Generating held-out test scenarios (5 ATO attacks, 5 Legitimate Spikes)...")
    scenarios = []

    # Attack scenarios (ATO)
    for i in range(5):
        target = merchants[i % len(merchants)]
        t = datetime(2026, 8, 20, 2, 0, 0) + timedelta(hours=i * 6)
        ato_events, scenario_meta = inject_ato_credential_theft(target, attack_time=t)
        scenarios.append({
            "meta": scenario_meta,
            "events": ato_events,
            "label": "attack",
            "gt_chain": ["NEW_DEVICE_TO_SENSITIVE_ACTION", "CONTROL_PLANE_TAKEOVER_CHAIN"],
        })

    # Benign sale spike scenarios
    for i in range(5):
        target = merchants[i % len(merchants)]
        t = datetime(2026, 8, 21, 14, 0, 0) + timedelta(hours=i * 4)
        spike_events, scenario_meta = inject_legitimate_spike(target, spike_time=t)
        scenarios.append({
            "meta": scenario_meta,
            "events": spike_events,
            "label": "benign",
            "gt_chain": [],
        })

    # 3. Evaluate Baseline System (Naive volume/amount anomaly thresholding without context)
    print("\n[4/4] Running comparative evaluations...")

    evaluator = RiskEvaluator()

    baseline_preds = []
    risksutra_preds = []

    workflow_engine = WorkflowIntegrityEngine()
    fraud_detector = FraudSpikeDetector()

    for sc in scenarios:
        events = sc["events"]
        merchant_id = sc["meta"].merchant_id
        gt_label = sc["label"]

        # Save test events to DB for evaluation
        db.save_events_bulk(events)
        all_m_events = db.get_merchant_events(merchant_id)

        # Pre-attack baseline events
        batch_start = min(e.timestamp for e in events)
        baseline_evts = [e for e in all_m_events if e.timestamp < batch_start]
        if not baseline_evts:
            baseline_evts = all_m_events[:50]

        profile = build_merchant_profile(merchant_id, baseline_evts)
        signals = compute_deviation_signals(profile, events)

        # Baseline System Prediction (naive: if ANY anomaly signal exists, flag as attack)
        naive_flag = "attack" if len(signals) >= 2 else "benign"
        baseline_preds.append({
            "merchant_id": merchant_id,
            "predicted_label": naive_flag,
            "ground_truth_label": gt_label,
            "predicted_score": 70.0 if naive_flag == "attack" else 20.0,
            "attack_start_time": sc["meta"].attack_start_time,
            "detection_time": events[0].timestamp if naive_flag == "attack" else None,
            "predicted_chain": [],
            "ground_truth_chain": sc["gt_chain"],
        })

        # RiskSūtra Day 2 Context Engine Prediction
        wf_res = workflow_engine.evaluate(profile, events, signals)
        fs_res = fraud_detector.evaluate(profile, events, signals)
        assessment = compute_risk_assessment(merchant_id, signals, workflow_result=wf_res, fraud_spike=fs_res)

        risksutra_flag = "attack" if assessment.risk_score >= 56.0 else "benign"
        risksutra_preds.append({
            "merchant_id": merchant_id,
            "predicted_label": risksutra_flag,
            "ground_truth_label": gt_label,
            "predicted_score": assessment.risk_score,
            "attack_start_time": sc["meta"].attack_start_time,
            "detection_time": events[0].timestamp if risksutra_flag == "attack" else None,
            "predicted_chain": assessment.attack_chain,
            "ground_truth_chain": sc["gt_chain"],
        })

    # Compute metrics
    m_baseline = evaluator.evaluate_predictions(baseline_preds)
    m_risksutra = evaluator.evaluate_predictions(risksutra_preds)

    print("\n" + "=" * 75)
    print("EVALUATION RESULTS COMPARISON")
    print("=" * 75)
    print(f"{'Metric':<30} | {'Baseline System':<18} | {'RiskSutra Day 2':<18}")
    print("-" * 75)
    print(f"{'Precision':<30} | {m_baseline.precision:<18.4f} | {m_risksutra.precision:<18.4f}")
    print(f"{'Recall':<30} | {m_baseline.recall:<18.4f} | {m_risksutra.recall:<18.4f}")
    print(f"{'F1 Score':<30} | {m_baseline.f1_score:<18.4f} | {m_risksutra.f1_score:<18.4f}")
    print(f"{'False Positive Rate (FPR)':<30} | {m_baseline.false_positive_rate:<18.4f} | {m_risksutra.false_positive_rate:<18.4f}")
    print(f"{'False Positives (FP Count)':<30} | {m_baseline.false_positive_count:<18d} | {m_risksutra.false_positive_count:<18d}")
    print(f"{'Attack-Chain Recall':<30} | {m_baseline.attack_chain_recall:<18.4f} | {m_risksutra.attack_chain_recall:<18.4f}")
    print("=" * 75)

    print("\n[OK] Evaluation complete!")
    return m_risksutra



if __name__ == "__main__":
    run_evaluation()
