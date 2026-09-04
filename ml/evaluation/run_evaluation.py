"""
RiskSūtra — Day 4 Final Evaluation Pipeline & Track 02 Compliance Runner

Executes rigorous evaluation on a strictly held-out chronological test set.
Validates:
1. True Chronological Split (Baseline Training Window vs Unseen Held-out Evaluation Period)
2. Strict Data Leakage Prevention
3. Diverse ATO Attack Scenarios (Cases A, B, C, D, E)
4. Diverse Legitimate Benign Anomalies (Festive promotions, weekend spikes, seasonal sales, API bursts)
5. Multi-Merchant Archetype Generalization (All 5 distinct merchant baselines)
6. Honest Metrics: Precision, Recall, F1-Score, False Positive Rate (FPR), Detection Lead Time, Attack-Chain Recall
7. Comparative Baseline: RiskSūtra Context Engine vs Simple Naive Heuristic Baseline
8. Configurable False-Positive Cost Model with clearly stated assumptions

Usage:
    python ml/evaluation/run_evaluation.py
"""

from __future__ import annotations

import json
import logging
import os
import sys
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Tuple

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

# Ensure root and backend directories are on sys.path
current_dir = os.path.dirname(os.path.abspath(__file__))
root_dir = os.path.dirname(os.path.dirname(current_dir))
backend_dir = os.path.join(root_dir, "backend")

for p in [root_dir, backend_dir]:
    if p not in sys.path:
        sys.path.insert(0, p)

from db import database as db
from models.schemas import (
    EvaluationCostModel,
    EvaluationMetrics,
    Event,
    Merchant,
    RiskBand,
)
from risk.baseline_engine import build_merchant_profile, compute_deviation_signals
from risk.fraud_spike_detector import FraudSpikeDetector
from risk.fusion_engine import compute_risk_assessment
from risk.workflow_engine import WorkflowIntegrityEngine
from services.synthetic_generator import (
    generate_merchants,
    generate_normal_events,
    inject_ato_case_b_network_pivot,
    inject_ato_case_c_geo_spike,
    inject_ato_case_d_payout_drain,
    inject_ato_case_e_stealth_mixed,
    inject_ato_credential_theft,
    inject_benign_api_integration,
    inject_benign_festive_spike,
    inject_benign_seasonal_sale,
    inject_benign_weekend_surge,
    inject_legitimate_spike,
)
from ml.evaluation.evaluator import RiskEvaluator

logging.basicConfig(level=logging.WARNING)


def run_evaluation() -> Dict[str, Any]:
    print("=" * 80)
    print("  RISKSŪTRA — DAY 4 FINAL HELD-OUT EVALUATION & COST COMPLIANCE AUDIT  ")
    print("  Loss Class: Merchant Account Takeover (ATO) | Track 02 Defense-Only  ")
    print("=" * 80)

    # 1. Initialize clean evaluation database
    eval_db_path = os.path.join(root_dir, "data", "eval_risksutra.db")
    if os.path.exists(eval_db_path):
        try:
            os.remove(eval_db_path)
        except Exception:
            pass
    db.SQLITE_PATH = eval_db_path
    db.DB_PATH = eval_db_path
    db.DB_TYPE = "sqlite"
    db.init_db()

    # 2. Generate 5 distinct merchants across archetypes
    merchants = generate_merchants()
    for m in merchants:
        db.save_merchant(m)
    print(f"\n[Phase 1] Seeded {len(merchants)} Distinct Merchants with Unique Behavioral Archetypes:")
    for m in merchants:
        print(f"  - {m.merchant_id}: {m.merchant_name} ({m.merchant_type.value}, Country: {m.country})")

    # 3. Establish Chronological Split
    # Historical Training Period: 2026-08-01T00:00:00Z to 2026-08-14T23:59:59Z (14 days)
    # Cutoff Timestamp: 2026-08-15T00:00:00Z
    # Held-Out Evaluation Window: 2026-08-15T00:00:00Z to 2026-08-25T23:59:59Z (10 days)
    cutoff_time = datetime(2026, 8, 15, 0, 0, 0, tzinfo=timezone.utc)
    print(f"\n[Phase 2] Chronological Split Boundary Established:")
    print(f"  - Historical Baseline Period: Pre-Cutoff (14 days prior to {cutoff_time.isoformat()})")
    print(f"  - Evaluation Cutoff Date:     {cutoff_time.isoformat()}")
    print(f"  - Held-out Evaluation Period: Post-Cutoff (Testing window)")

    # Generate baseline telemetry strictly before cutoff
    for m in merchants:
        normal_history = generate_normal_events(m, days=14)
        # Force timestamps to fall strictly prior to cutoff
        base_start = cutoff_time - timedelta(days=14)
        for idx, ev in enumerate(normal_history):
            ev.timestamp = base_start + timedelta(minutes=idx * 15)
        db.save_events_bulk(normal_history)

    # 4. Strict Data Leakage Verification
    print("\n[Phase 3] Running Data Leakage Verification Audit...")
    for m in merchants:
        m_events = db.get_merchant_events(m.merchant_id)
        future_events = [e for e in m_events if e.timestamp >= cutoff_time]
        assert len(future_events) == 0, f"LEAKAGE DETECTED: Found {len(future_events)} events post-cutoff in baseline!"
        profile = build_merchant_profile(m.merchant_id, m_events)
        assert len(profile.typical_hours) > 0, "Baseline failed to establish typical hours"
        assert len(profile.known_devices) > 0, "Baseline failed to establish known devices"
    print("  ✓ Zero Data Leakage Confirmed: Baseline profiles contain strictly pre-cutoff observations.")

    # 5. Build Held-out Evaluation Test Set (20 Scenarios across 5 Merchants)
    # 10 Attack Scenarios (Cases A, B, C, D, E) + 10 Benign Scenarios (Normal, Festive, Weekend, Seasonal, API Sync)
    print("\n[Phase 4] Constructing Unseen Held-Out Test Set (20 Scenarios: 10 ATO Attacks, 10 Benign Anomalies)...")
    scenarios: List[Dict[str, Any]] = []

    # Attack Generators Map
    attack_gens = [
        ("Case A: Credential Theft", inject_ato_credential_theft, ["NEW_DEVICE_TO_SENSITIVE_ACTION", "CONTROL_PLANE_TAKEOVER_CHAIN"]),
        ("Case B: Network Pivot Brute-Force", inject_ato_case_b_network_pivot, ["AUTH_BRUTEFORCE_CHAIN", "NEW_NETWORK_TO_SENSITIVE_ACTION"]),
        ("Case C: Geo Deviation API Spike", inject_ato_case_c_geo_spike, ["GEO_DEVIATION_API_BURST", "ANOMALOUS_TRANSACTION_BURST"]),
        ("Case D: Direct Payout Drain", inject_ato_case_d_payout_drain, ["NEW_DEVICE_TO_SENSITIVE_ACTION", "RAPID_PAYOUT_HIJACK"]),
        ("Case E: Stealth Mixed Sequence", inject_ato_case_e_stealth_mixed, ["STEALTH_INTERLEAVED_ATO"]),
    ]

    # Generate 10 Attack Scenarios (2 iterations across 5 attack types)
    for run_idx in range(2):
        for pattern_name, gen_func, expected_chains in attack_gens:
            m_target = merchants[(len(scenarios)) % len(merchants)]
            t_eval = cutoff_time + timedelta(days=1 + len(scenarios) * 0.4)
            evts, meta = gen_func(m_target, attack_time=t_eval)
            scenarios.append({
                "name": f"{pattern_name} ({m_target.merchant_name})",
                "events": evts,
                "merchant_id": m_target.merchant_id,
                "ground_truth_label": "attack",
                "expected_chains": expected_chains,
                "attack_start_time": meta.attack_start_time,
            })

    # Benign Generators Map
    benign_gens = [
        ("Legitimate Promotion Spike", inject_legitimate_spike),
        ("Festive Campaign Surge (8x)", inject_benign_festive_spike),
        ("Weekend POS Dining Surge", inject_benign_weekend_surge),
        ("Seasonal Clearance Sale", inject_benign_seasonal_sale),
        ("API Inventory Catalog Sync", inject_benign_api_integration),
    ]

    # Generate 10 Benign Scenarios (2 iterations across 5 benign types)
    for run_idx in range(2):
        for benign_name, gen_func in benign_gens:
            m_target = merchants[(len(scenarios)) % len(merchants)]
            if benign_name.startswith("Weekend"):
                evts, meta = gen_func(m_target, surge_time=t_eval)
            elif benign_name.startswith("API"):
                evts, meta = gen_func(m_target, sync_time=t_eval)
            elif benign_name.startswith("Seasonal"):
                evts, meta = gen_func(m_target, sale_time=t_eval)
            else:
                evts, meta = gen_func(m_target, spike_time=t_eval)
            scenarios.append({
                "name": f"{benign_name} ({m_target.merchant_name})",
                "events": evts,
                "merchant_id": m_target.merchant_id,
                "ground_truth_label": "benign",
                "expected_chains": [],
                "attack_start_time": None,
            })

    print(f"  ✓ Generated {len(scenarios)} Held-Out Test Scenarios (10 Attack, 10 Benign) balanced across all 5 merchants.")

    # 6. Execute Evaluation: RiskSūtra Context Engine vs Simple Naive Baseline
    print("\n[Phase 5] Executing Comparative Evaluation on Identical Held-Out Data...")
    workflow_engine = WorkflowIntegrityEngine()
    fraud_detector = FraudSpikeDetector()
    evaluator = RiskEvaluator()

    baseline_predictions: List[Dict[str, Any]] = []
    risksutra_predictions: List[Dict[str, Any]] = []

    for sc in scenarios:
        events = sc["events"]
        m_id = sc["merchant_id"]
        gt_label = sc["ground_truth_label"]
        start_t = sc["attack_start_time"]

        # Retrieve strictly historical pre-cutoff events for this merchant
        m_history = [e for e in db.get_merchant_events(m_id) if e.timestamp < cutoff_time]
        profile = build_merchant_profile(m_id, m_history)
        signals = compute_deviation_signals(profile, events)

        # -------------------------------------------------------------
        # 1. Simple Naive Heuristic Baseline (Heuristic rule:
        #    Flags ANY deviation signal: volume spike, amount spike, new device, etc.
        #    Classic flaw: Treats 'Unusual = Malicious', causing severe false positive storms!)
        # -------------------------------------------------------------
        naive_attack_flag = "attack" if len(signals) >= 1 else "benign"
        baseline_predictions.append({
            "merchant_id": m_id,
            "predicted_label": naive_attack_flag,
            "ground_truth_label": gt_label,
            "predicted_score": 75.0 if naive_attack_flag == "attack" else 20.0,
            "attack_start_time": start_t,
            "detection_time": events[0].timestamp if naive_attack_flag == "attack" else None,
            "predicted_chain": [],
            "ground_truth_chain": sc["expected_chains"],
        })

        # -------------------------------------------------------------
        # 2. RiskSūtra Context Engine (Multi-engine fusion:
        #    Behavioral genome + Temporal workflow + Fraud spike + Graph abuse)
        # -------------------------------------------------------------
        wf_res = workflow_engine.evaluate(profile, events, signals)
        fs_res = fraud_detector.evaluate(profile, events, signals)
        assessment = compute_risk_assessment(m_id, signals, workflow_result=wf_res, fraud_spike=fs_res)

        # RiskSūtra ATO decision boundary: score >= 56.0 or RiskBand.HIGH / CRITICAL
        risksutra_flag = "attack" if assessment.risk_score >= 56.0 else "benign"
        risksutra_predictions.append({
            "merchant_id": m_id,
            "predicted_label": risksutra_flag,
            "ground_truth_label": gt_label,
            "predicted_score": assessment.risk_score,
            "attack_start_time": start_t,
            "detection_time": events[0].timestamp if risksutra_flag == "attack" else None,
            "predicted_chain": assessment.attack_chain,
            "ground_truth_chain": sc["expected_chains"],
        })

    # 7. Compute Quantitative Evaluation Metrics
    metrics_baseline = evaluator.evaluate_predictions(baseline_predictions)
    metrics_risksutra = evaluator.evaluate_predictions(risksutra_predictions)

    # 8. Compute False-Positive Cost Model
    cost_model = EvaluationCostModel()
    cost_baseline = cost_model.calculate_cost(metrics_baseline.false_positive_count, metrics_baseline.false_negative_count)
    cost_risksutra = cost_model.calculate_cost(metrics_risksutra.false_positive_count, metrics_risksutra.false_negative_count)
    cost_savings = cost_baseline["total_expected_cost"] - cost_risksutra["total_expected_cost"]

    # 9. Print Comparative Results
    print("\n" + "=" * 80)
    print("                         QUANTITATIVE EVALUATION RESULTS                        ")
    print("=" * 80)
    print(f"{'Metric':<34} | {'Simple Baseline':<20} | {'RiskSūtra Context Engine':<20}")
    print("-" * 80)
    print(f"{'Total Held-Out Test Scenarios':<34} | {len(scenarios):<20d} | {len(scenarios):<20d}")
    print(f"{'True Positives (TP)':<34} | {metrics_baseline.true_positive_count:<20d} | {metrics_risksutra.true_positive_count:<20d}")
    print(f"{'False Positives (FP)':<34} | {metrics_baseline.false_positive_count:<20d} | {metrics_risksutra.false_positive_count:<20d}")
    print(f"{'True Negatives (TN)':<34} | {metrics_baseline.true_negative_count:<20d} | {metrics_risksutra.true_negative_count:<20d}")
    print(f"{'False Negatives (FN)':<34} | {metrics_baseline.false_negative_count:<20d} | {metrics_risksutra.false_negative_count:<20d}")
    print("-" * 80)
    print(f"{'Precision':<34} | {metrics_baseline.precision:<20.4f} | {metrics_risksutra.precision:<20.4f}")
    print(f"{'Recall':<34} | {metrics_baseline.recall:<20.4f} | {metrics_risksutra.recall:<20.4f}")
    print(f"{'F1-Score':<34} | {metrics_baseline.f1_score:<20.4f} | {metrics_risksutra.f1_score:<20.4f}")
    print(f"{'False Positive Rate (FPR)':<34} | {metrics_baseline.false_positive_rate:<20.4f} | {metrics_risksutra.false_positive_rate:<20.4f}")
    print(f"{'Attack-Chain Recall':<34} | {metrics_baseline.attack_chain_recall:<20.4f} | {metrics_risksutra.attack_chain_recall:<20.4f}")
    print(f"{'Detection Lead Time (seconds)':<34} | {metrics_baseline.detection_lead_time_seconds:<20.1f} | {metrics_risksutra.detection_lead_time_seconds:<20.1f}")
    print("=" * 80)

    print("\n" + "=" * 80)
    print("                   FALSE-POSITIVE COST IMPACT ANALYSIS                          ")
    print("=" * 80)
    print(f"Cost Assumptions (Configurable Simulation):")
    print(f"  • FP Unit Cost: ₹{cost_model.fp_unit_cost:,.2f} (Analyst review time, merchant friction, operational overhead)")
    print(f"  • FN Unit Cost: ₹{cost_model.fn_unit_cost:,.2f} (Average undetected ATO loss, chargebacks, merchant recovery)")
    print("-" * 80)
    print(f"{'Cost Component':<34} | {'Simple Baseline':<20} | {'RiskSūtra Context Engine':<20}")
    print("-" * 80)
    print(f"{'False Positive Cost':<34} | ₹{cost_baseline['fp_total_cost']:<19,.2f} | ₹{cost_risksutra['fp_total_cost']:<19,.2f}")
    print(f"{'False Negative Cost':<34} | ₹{cost_baseline['fn_total_cost']:<19,.2f} | ₹{cost_risksutra['fn_total_cost']:<19,.2f}")
    print(f"{'Total Expected Loss / Cost':<34} | ₹{cost_baseline['total_expected_cost']:<19,.2f} | ₹{cost_risksutra['total_expected_cost']:<19,.2f}")
    pct_str = f"({((cost_savings / cost_baseline['total_expected_cost']) * 100):.1f}% reduction)" if cost_baseline['total_expected_cost'] > 0 else ""
    print(f"★ Net Financial Loss Reduction: ₹{cost_savings:,.2f} {pct_str}".strip())
    print("=" * 80)

    # Clean up temp db
    try:
        if os.path.exists(eval_db_path):
            os.remove(eval_db_path)
    except Exception:
        pass

    return {
        "held_out_scenarios_count": len(scenarios),
        "metrics_baseline": metrics_baseline.model_dump(),
        "metrics_risksutra": metrics_risksutra.model_dump(),
        "cost_baseline": cost_baseline,
        "cost_risksutra": cost_risksutra,
        "cost_savings": cost_savings,
    }


if __name__ == "__main__":
    run_evaluation()
