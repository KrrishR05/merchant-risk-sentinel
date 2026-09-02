"""
RiskSūtra — Risk Fusion Engine

Combines typed risk signals into a composite ATO risk score.

Methodology:
1. Signals are grouped by category
2. Max signal per category (not average) to prevent dilution
3. Weighted category fusion
4. Risk band classification
5. Incident creation on HIGH+ threshold

See docs/risk-scoring.md for full methodology.
"""

import uuid
from datetime import datetime

from models.schemas import (
    Incident, IncidentStatus, RiskAssessment, RiskBand, RiskSignal,
)


# Category weights — documented in docs/risk-scoring.md
CATEGORY_WEIGHTS = {
    "identity_novelty": 0.25,
    "behavioral_deviation": 0.25,
    "operational_anomaly": 0.20,
    "sensitive_actions": 0.20,
    "velocity": 0.10,
}

# Map signal types to categories
SIGNAL_CATEGORY_MAP = {
    "NEW_DEVICE": "identity_novelty",
    "NEW_COUNTRY": "identity_novelty",
    "NEW_ASN": "identity_novelty",
    "HOUR_DEVIATION": "behavioral_deviation",
    "AMOUNT_ANOMALY": "behavioral_deviation",
    "API_RATE_SPIKE": "operational_anomaly",
    "TXN_RATE_SPIKE": "velocity",
    "SENSITIVE_ACTION_SPIKE": "sensitive_actions",
}

MODEL_VERSION = "v0.1.0-statistical"


def compute_risk_assessment(
    merchant_id: str,
    signals: list[RiskSignal],
) -> RiskAssessment:
    """
    Fuse risk signals into a composite risk assessment.

    Strategy:
    - Group signals by category
    - Take max value per category
    - Weighted sum across categories
    - Scale to 0-100
    """
    if not signals:
        return RiskAssessment(
            merchant_id=merchant_id,
            risk_score=0.0,
            risk_band=RiskBand.LOW,
            top_signals=[],
            evidence_event_ids=[],
            model_version=MODEL_VERSION,
        )

    # Group by category, take max per category
    category_scores: dict[str, float] = {}
    for signal in signals:
        category = SIGNAL_CATEGORY_MAP.get(signal.signal_type, "behavioral_deviation")
        current_max = category_scores.get(category, 0.0)
        category_scores[category] = max(current_max, signal.value)

    # Weighted fusion
    raw_score = 0.0
    for category, weight in CATEGORY_WEIGHTS.items():
        cat_score = category_scores.get(category, 0.0)
        raw_score += weight * cat_score

    # Scale to 0-100
    risk_score = round(min(100.0, raw_score * 100), 2)

    # Classify risk band
    risk_band = _classify_risk_band(risk_score)

    # Top signals (sorted by value descending)
    top_signals = sorted(signals, key=lambda s: s.value, reverse=True)[:5]

    # Collect all evidence event IDs
    all_evidence = []
    for s in signals:
        all_evidence.extend(s.evidence_event_ids)
    evidence_ids = list(set(all_evidence))

    return RiskAssessment(
        merchant_id=merchant_id,
        risk_score=risk_score,
        risk_band=risk_band,
        top_signals=top_signals,
        evidence_event_ids=evidence_ids,
        model_version=MODEL_VERSION,
    )


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
    """Incidents are created when risk is HIGH or CRITICAL."""
    return assessment.risk_band in (RiskBand.HIGH, RiskBand.CRITICAL)


def create_incident_from_assessment(assessment: RiskAssessment) -> Incident:
    """Create an incident object from a risk assessment."""
    return Incident(
        incident_id=f"INC_{uuid.uuid4().hex[:12]}",
        merchant_id=assessment.merchant_id,
        created_at=datetime.utcnow(),
        status=IncidentStatus.OPEN,
        incident_type="ATO",
        risk_score=assessment.risk_score,
        risk_band=assessment.risk_band,
        signal_ids=[s.signal_id for s in assessment.top_signals],
        evidence_event_ids=assessment.evidence_event_ids,
        summary=_generate_deterministic_summary(assessment),
    )


def _generate_deterministic_summary(assessment: RiskAssessment) -> str:
    """Generate a structured summary without LLM — pure deterministic."""
    signal_descriptions = []
    for s in sorted(assessment.top_signals, key=lambda x: x.value, reverse=True):
        signal_descriptions.append(f"- {s.signal_type}: severity={s.severity.value}, score={s.value:.2f}")

    signals_text = "\n".join(signal_descriptions) if signal_descriptions else "- No signals"

    return (
        f"ATO Risk Assessment — {assessment.risk_band.value}\n"
        f"Risk Score: {assessment.risk_score}\n"
        f"Model: {assessment.model_version}\n"
        f"Top Signals:\n{signals_text}\n"
        f"Evidence Events: {len(assessment.evidence_event_ids)}"
    )
