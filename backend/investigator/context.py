"""
RiskSūtra — Investigation Context Builder

Constructs a compact, strongly-typed, reproducible InvestigationContext for an incident.
This context encapsulates only verified evidence and deterministic baseline data,
ensuring the AI Investigator works exclusively with grounded factual inputs.
"""

import logging
from typing import Optional
from db import database as db
from models.schemas import Incident, InvestigationContext, Merchant
from risk.baseline_engine import build_merchant_profile
from risk.temporal_engine import get_ordered_event_sequence
from graph.abuse_sentinel import GraphService

logger = logging.getLogger("risksutra.investigator.context")
_graph_service = GraphService()


def build_investigation_context(incident_id: str) -> InvestigationContext:
    """
    Build a structured, deterministic InvestigationContext from an incident ID.
    """
    incident = db.get_incident(incident_id)
    if not incident:
        raise ValueError(f"Incident not found: {incident_id}")

    merchant = db.get_merchant(incident.merchant_id)
    merchant_name = merchant.merchant_name if merchant else "Unknown Merchant"
    merchant_type = merchant.merchant_type.value if merchant else "UNKNOWN"
    country = merchant.country if merchant else "IN"

    # Fetch signals for merchant — strictly scoped to incident.signal_ids if present
    if incident.signal_ids:
        merchant_signals = db.get_signals_by_ids(incident.signal_ids)
    else:
        merchant_signals = db.get_merchant_signals(incident.merchant_id, limit=50)

    top_signals = []
    for s in merchant_signals[:10]:
        top_signals.append({
            "signal_id": s.signal_id,
            "signal_type": s.signal_type,
            "value": s.value,
            "severity": s.severity.value,
            "source": s.source,
            "reason": s.reason or f"{s.signal_type} anomaly detected",
            "baseline_value": s.baseline_value,
            "observed_value": s.observed_value,
            "evidence_event_ids": s.evidence_event_ids,
        })

    # Fetch evidence events
    evidence_events = []
    if incident.evidence_event_ids:
        raw_events = db.get_events_by_ids(incident.evidence_event_ids)
        for e in raw_events:
            evidence_events.append({
                "event_id": e.event_id,
                "timestamp": e.timestamp.isoformat(),
                "event_type": e.event_type.value,
                "device_id": e.device_id,
                "session_id": e.session_id,
                "ip_address": e.ip_address,
                "country": e.country,
                "asn": e.asn,
                "transaction_id": e.transaction_id,
                "amount": e.amount,
                "endpoint": e.endpoint,
                "action": e.action,
            })
    else:
        # Fallback to recent events
        raw_events = db.get_recent_events(incident.merchant_id, limit=20)
        for e in raw_events:
            evidence_events.append({
                "event_id": e.event_id,
                "timestamp": e.timestamp.isoformat(),
                "event_type": e.event_type.value,
                "device_id": e.device_id,
                "ip_address": e.ip_address,
                "country": e.country,
                "amount": e.amount,
                "action": e.action,
            })

    # Fetch Behavioral Genome baseline summary
    all_events = db.get_merchant_events(incident.merchant_id)
    profile = build_merchant_profile(incident.merchant_id, all_events)
    genome_baseline = {
        "total_events_in_baseline": profile.total_events,
        "known_devices_count": len(profile.known_devices),
        "known_devices": profile.known_devices[:5],
        "known_countries": profile.known_countries,
        "known_asns": profile.known_asns,
        "typical_hours": list(profile.typical_hours.keys()),
        "api_rate_mean_per_hour": profile.api_rate_baseline.get("mean", 0.0),
        "transaction_rate_mean_per_hour": profile.transaction_rate_baseline.get("mean", 0.0),
        "amount_p95": profile.amount_statistics.get("p95", 0.0),
        "amount_max": profile.amount_statistics.get("max", 0.0),
        "sensitive_action_count": profile.sensitive_action_count,
    }

    # Abuse Graph cluster information
    cluster = _graph_service.get_merchant_cluster(incident.merchant_id)
    abuse_cluster_info = None
    if cluster:
        abuse_cluster_info = {
            "cluster_id": cluster.cluster_id,
            "shared_devices": cluster.shared_devices,
            "shared_ips": cluster.shared_ips,
            "merchants_involved": cluster.merchants_involved,
            "risk_score": cluster.risk_score,
        }

    # Related incidents count
    other_incidents = db.get_merchant_incidents(incident.merchant_id)
    related_incidents_count = len([i for i in other_incidents if i.incident_id != incident_id])

    effective_score = incident.risk_score
    effective_band = incident.risk_band

    fraud_spike_class = "BENIGN_SALE_SPIKE" if (incident.incident_type == "LEGITIMATE_SPIKE_EVAL" or "Legitimate" in incident.summary) else None

    return InvestigationContext(
        incident_id=incident.incident_id,
        merchant_id=incident.merchant_id,
        merchant_name=merchant_name,
        merchant_type=merchant_type,
        country=country,
        risk_score=effective_score,
        risk_band=effective_band,
        model_version=incident.model_version,
        evidence_version=getattr(incident, "evidence_version", 1),
        top_signals=top_signals,
        evidence_events=evidence_events,
        genome_baseline=genome_baseline,
        workflow_matches=incident.attack_chain,
        fraud_spike_classification=fraud_spike_class,
        abuse_cluster_info=abuse_cluster_info,
        related_incidents_count=related_incidents_count,
    )
