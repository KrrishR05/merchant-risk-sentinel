"""
RiskSūtra — Risk Fusion Engine (Day 2 Intelligence)

Combines Behavioral Signals, Temporal Workflow Integrity, Fraud-Spike Metrics, and Graph Abuse Clusters
into a unified composite ATO risk assessment.

Methodology:
1. Max signal value per category to prevent dilution
2. Category-weighted sum
3. Workflow & Graph cluster bonus integration
4. Contextual damping for verified benign sale spikes
5. Risk band classification & deterministic incident creation

Model Version: ato-v0.2-day2
"""

import uuid
from datetime import datetime, timezone
from typing import Optional

from models.schemas import (
    AbuseCluster, FraudSpikeAssessment, Incident, IncidentStatus,
    RiskAssessment, RiskBand, RiskSignal, WorkflowResult,
)

MODEL_VERSION = "ato-v0.2-day2"

CATEGORY_WEIGHTS = {
    "identity_novelty": 0.25,
    "behavioral_deviation": 0.20,
    "operational_anomaly": 0.15,
    "sensitive_actions": 0.20,
    "velocity": 0.10,
}

SIGNAL_CATEGORY_MAP = {
    "NEW_DEVICE": "identity_novelty",
    "NEW_COUNTRY": "identity_novelty",
    "NEW_IP": "identity_novelty",
    "NEW_ASN": "identity_novelty",
    "UNUSUAL_HOUR": "behavioral_deviation",
    "HOUR_DEVIATION": "behavioral_deviation",
    "TRANSACTION_AMOUNT_ANOMALY": "behavioral_deviation",
    "AMOUNT_ANOMALY": "behavioral_deviation",
    "API_RATE_ANOMALY": "operational_anomaly",
    "API_RATE_SPIKE": "operational_anomaly",
    "TRANSACTION_RATE_ANOMALY": "velocity",
    "TXN_RATE_SPIKE": "velocity",
    "SENSITIVE_ACTION_ANOMALY": "sensitive_actions",
    "SENSITIVE_ACTION_SPIKE": "sensitive_actions",
    "AUTH_FAILURE_ANOMALY": "sensitive_actions",
}


def compute_risk_assessment(
    merchant_id: str,
    signals: list[RiskSignal],
    workflow_result: Optional[WorkflowResult] = None,
    fraud_spike: Optional[FraudSpikeAssessment] = None,
    abuse_cluster: Optional[AbuseCluster] = None,
) -> RiskAssessment:
    """
    Fuse multi-engine signals into a composite RiskAssessment.
    """
    # 1. Group signals by category & take category max
    category_scores: dict[str, float] = {}
    for sig in signals:
        cat = SIGNAL_CATEGORY_MAP.get(sig.signal_type, "behavioral_deviation")
        category_scores[cat] = max(category_scores.get(cat, 0.0), sig.value)

    # 2. Weighted sum
    base_score = 0.0
    for cat, weight in CATEGORY_WEIGHTS.items():
        base_score += weight * category_scores.get(cat, 0.0)

    # 3. Incorporate Workflow Integrity
    workflow_score = workflow_result.workflow_score if workflow_result else 0.0
    combined_raw = (base_score * 0.80) + (workflow_score * 0.20)

    # 4. Apply Attack-Chain Multiplier if critical sequence matched
    attack_chain = []
    if workflow_result and workflow_result.matched_patterns:
        attack_chain = workflow_result.matched_patterns
        critical_patterns = {
            "CONTROL_PLANE_TAKEOVER_CHAIN",
            "NEW_DEVICE_TO_SENSITIVE_ACTION",
            "SUSPICIOUS_GEO_VELOCITY_SEQUENCE",
            "AUTH_BRUTEFORCE_CHAIN",
            "STEALTH_INTERLEAVED_ATO",
            "GEO_DEVIATION_API_BURST",
            "API_BURST_TO_PAYOUT_CHANGE",
        }
        if matched_patterns_set(workflow_result) & critical_patterns:
            combined_raw = max(combined_raw, 0.75)

    # 5. Apply Graph Abuse Cluster risk
    if abuse_cluster and abuse_cluster.risk_score >= 0.60:
        combined_raw = max(combined_raw, abuse_cluster.risk_score * 0.85)

    # 6. Legitimate Spike Damping (Contextual awareness)
    if fraud_spike and fraud_spike.classification == "BENIGN_SALE_SPIKE":
        if workflow_score < 0.25 and "SENSITIVE_ACTION_ANOMALY" not in [s.signal_type for s in signals]:
            combined_raw = min(combined_raw, 0.25)

    # Scale to 0-100
    risk_score = round(min(100.0, combined_raw * 100), 2)
    risk_band = _classify_risk_band(risk_score)

    # Top signals sorted by value descending
    top_signals = sorted(signals, key=lambda s: s.value, reverse=True)[:5]

    # Consolidate evidence event IDs
    all_evidence = []
    for s in signals:
        all_evidence.extend(s.evidence_event_ids)
    if workflow_result:
        all_evidence.extend(workflow_result.evidence_event_ids)
    if fraud_spike:
        all_evidence.extend(fraud_spike.evidence_event_ids)
    if abuse_cluster:
        all_evidence.extend(abuse_cluster.evidence_event_ids)

    evidence_ids = sorted(list(set(all_evidence)))

    return RiskAssessment(
        merchant_id=merchant_id,
        risk_score=risk_score,
        risk_band=risk_band,
        top_signals=top_signals,
        workflow_result=workflow_result,
        fraud_spike=fraud_spike,
        abuse_cluster=abuse_cluster,
        attack_chain=attack_chain,
        evidence_event_ids=evidence_ids,
        model_version=MODEL_VERSION,
        assessed_at=datetime.now(timezone.utc),
    )


def matched_patterns_set(wf: WorkflowResult) -> set[str]:
    return set(wf.matched_patterns) if wf else set()


def _classify_risk_band(score: float) -> RiskBand:
    if score >= 81:
        return RiskBand.CRITICAL
    elif score >= 56:
        return RiskBand.HIGH
    elif score >= 31:
        return RiskBand.MEDIUM
    else:
        return RiskBand.LOW


def should_create_incident(assessment: RiskAssessment) -> bool:
    """Incident creation threshold: Risk score >= 56 (HIGH or CRITICAL)."""
    return assessment.risk_band in (RiskBand.HIGH, RiskBand.CRITICAL)


def create_incident_from_assessment(assessment: RiskAssessment) -> Incident:
    """Construct Incident entity from fused risk assessment."""
    now = datetime.now(timezone.utc)
    incident_type = "ATO"
    if assessment.fraud_spike and assessment.fraud_spike.classification == "SUSPICIOUS_SPIKE":
        incident_type = "FRAUD_SPIKE"
    elif assessment.abuse_cluster and assessment.abuse_cluster.risk_score >= 0.70:
        incident_type = "ABUSE_CLUSTER"

    related_entities = {}
    if assessment.abuse_cluster:
        related_entities = {
            "cluster_id": assessment.abuse_cluster.cluster_id,
            "merchants_involved": assessment.abuse_cluster.merchants_involved,
            "shared_devices": assessment.abuse_cluster.shared_devices,
            "shared_ips": assessment.abuse_cluster.shared_ips,
        }

    return Incident(
        incident_id=f"INC_{uuid.uuid4().hex[:12]}",
        merchant_id=assessment.merchant_id,
        created_at=now,
        updated_at=now,
        status=IncidentStatus.OPEN,
        incident_type=incident_type,
        risk_score=assessment.risk_score,
        risk_band=assessment.risk_band,
        signal_ids=[s.signal_id for s in assessment.top_signals],
        signals=assessment.top_signals,
        attack_chain=assessment.attack_chain,
        related_entities=related_entities,
        evidence_event_ids=assessment.evidence_event_ids,
        model_version=assessment.model_version,
        summary=_generate_deterministic_summary(assessment),
    )


def _generate_deterministic_summary(assessment: RiskAssessment) -> str:
    """Generate structured, deterministic evidence summary."""
    lines = [
        f"RiskSūtra Intelligence Assessment — Band: {assessment.risk_band.value} (Score: {assessment.risk_score})",
        f"Model Version: {assessment.model_version}",
        "",
    ]

    if assessment.attack_chain:
        lines.append("Detected Attack Chain Patterns:")
        for pattern in assessment.attack_chain:
            lines.append(f"  • {pattern}")
        lines.append("")

    if assessment.top_signals:
        lines.append("Top Deviation Signals:")
        for s in assessment.top_signals:
            reason_str = f" — {s.reason}" if s.reason else ""
            lines.append(f"  • {s.signal_type} ({s.severity.value}, score={s.value:.2f}){reason_str}")
        lines.append("")

    if assessment.workflow_result and assessment.workflow_result.transition_anomalies:
        lines.append("Temporal Transition Anomalies:")
        for t in assessment.workflow_result.transition_anomalies[:3]:
            lines.append(f"  • {t.get('pattern')}: {t.get('from_type')} → {t.get('to_type')} ({t.get('time_delta_seconds')}s delta)")
        lines.append("")

    if assessment.abuse_cluster:
        lines.append("Abuse Cluster Context:")
        lines.append(f"  • Shared Devices: {assessment.abuse_cluster.shared_devices}, Shared IPs: {assessment.abuse_cluster.shared_ips}")
        lines.append(f"  • Merchants Involved: {', '.join(assessment.abuse_cluster.merchants_involved)}")
        lines.append("")

    lines.append(f"Total Correlated Evidence Events: {len(assessment.evidence_event_ids)}")
    return "\n".join(lines)
