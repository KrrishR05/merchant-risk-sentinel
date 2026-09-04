"""
RiskSūtra — Risk Orchestrator Service (Day 2 Pipeline)

Orchestrates the full multi-engine merchant risk detection pipeline:
1. Event Ingestion & Deduplication
2. Merchant Behavioral Genome Profiling
3. Interpretable Signal Deviation Calculation
4. Temporal Workflow Integrity Evaluation
5. Sliding Window Fraud-Spike Assessment
6. Graph Abuse-Ring Clustering
7. Composite Risk Fusion & Incident Dispatching
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from db import database as db
from graph.abuse_sentinel import GraphService
from models.schemas import Event, Incident, MerchantProfile, RiskAssessment
from risk.baseline_engine import build_merchant_profile, compute_deviation_signals
from risk.temporal_engine import get_ordered_event_sequence
from risk.fraud_spike_detector import FraudSpikeDetector

from risk.fusion_engine import (
    compute_risk_assessment,
    create_incident_from_assessment,
    should_create_incident,
)
from risk.workflow_engine import WorkflowIntegrityEngine

logger = logging.getLogger("risksutra.orchestrator")

_workflow_engine = WorkflowIntegrityEngine()
_fraud_spike_detector = FraudSpikeDetector()
_graph_service = GraphService()


def _to_utc(dt: datetime) -> datetime:
    if dt is None:
        return datetime.now(timezone.utc)
    return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt


def ingest_event(event: Event) -> dict:
    """
    Process a single event through the complete Day 2 risk pipeline.
    """
    merchant = db.get_merchant(event.merchant_id)
    if not merchant:
        raise ValueError(f"Unknown merchant: {event.merchant_id}")

    # 1. Persist event
    is_new = db.save_event(event)
    if not is_new:
        logger.info(f"Duplicate event {event.event_id} — skipped")
        return {"ingested": False, "duplicate": True, "risk_assessment": None, "incident_created": None}

    # 2. Add to Graph Service
    _graph_service.add_event(event)

    # 3. Retrieve historical events for merchant
    historical_events = db.get_merchant_events(event.merchant_id)
    profile = build_merchant_profile(event.merchant_id, historical_events)

    # 4. Compute deviation signals for current event window
    ev_ts = _to_utc(event.timestamp)
    recent_events = [e for e in historical_events if (ev_ts - _to_utc(e.timestamp)).total_seconds() <= 3600]
    if not recent_events:
        recent_events = [event]

    signals = compute_deviation_signals(profile, recent_events)
    if signals:
        db.save_signals_bulk(signals)

    # 5. Temporal Workflow Integrity
    workflow_result = _workflow_engine.evaluate(profile, recent_events, signals)

    # 6. Fraud Spike Detection
    fraud_spike = _fraud_spike_detector.evaluate(profile, recent_events, signals)

    # 7. Graph Abuse Cluster
    abuse_cluster = _graph_service.get_merchant_cluster(event.merchant_id)

    # 8. Composite Risk Fusion
    assessment = compute_risk_assessment(
        merchant_id=event.merchant_id,
        signals=signals,
        workflow_result=workflow_result,
        fraud_spike=fraud_spike,
        abuse_cluster=abuse_cluster,
    )

    # 9. Incident creation if warranted
    incident = None
    if should_create_incident(assessment):
        incident = create_incident_from_assessment(assessment)
        db.save_incident(incident)
        logger.warning(
            f"INCIDENT CREATED: {incident.incident_id} for merchant {event.merchant_id} "
            f"— score={assessment.risk_score}, band={assessment.risk_band.value}"
        )

    return {
        "ingested": True,
        "duplicate": False,
        "risk_assessment": assessment,
        "incident_created": incident,
    }


def ingest_events_batch(events: list[Event]) -> dict:
    """
    Ingest a batch of events and evaluate risk across the batch.
    """
    if not events:
        return {"ingested": 0, "risk_assessment": None, "incident_created": None}

    merchant_id = events[0].merchant_id
    merchant = db.get_merchant(merchant_id)
    if not merchant:
        raise ValueError(f"Unknown merchant: {merchant_id}")

    inserted = db.save_events_bulk(events)
    _graph_service.build_graph_from_events(events)

    all_events = db.get_merchant_events(merchant_id)
    batch_start = min(_to_utc(e.timestamp) for e in events)
    baseline_events = [e for e in all_events if _to_utc(e.timestamp) < batch_start]

    if not baseline_events:
        mid = len(all_events) // 2
        baseline_events = all_events[:mid] if mid > 0 else all_events

    profile = build_merchant_profile(merchant_id, baseline_events)
    signals = compute_deviation_signals(profile, events)

    if signals:
        db.save_signals_bulk(signals)

    workflow_result = _workflow_engine.evaluate(profile, events, signals)
    fraud_spike = _fraud_spike_detector.evaluate(profile, events, signals)
    abuse_cluster = _graph_service.get_merchant_cluster(merchant_id)

    assessment = compute_risk_assessment(
        merchant_id=merchant_id,
        signals=signals,
        workflow_result=workflow_result,
        fraud_spike=fraud_spike,
        abuse_cluster=abuse_cluster,
    )

    incident = None
    if should_create_incident(assessment):
        incident = create_incident_from_assessment(assessment)
        db.save_incident(incident)
        logger.warning(
            f"INCIDENT CREATED: {incident.incident_id} for merchant {merchant_id} "
            f"— score={assessment.risk_score}, band={assessment.risk_band.value}"
        )

    return {
        "ingested": inserted,
        "risk_assessment": assessment,
        "incident_created": incident,
    }


def get_merchant_risk(merchant_id: str) -> RiskAssessment:
    """Get current composite risk assessment for a merchant."""
    events = db.get_merchant_events(merchant_id, limit=200)
    profile = build_merchant_profile(merchant_id, events)
    signals = db.get_merchant_signals(merchant_id, limit=50)

    recent_events = events[-50:] if events else []
    workflow_result = _workflow_engine.evaluate(profile, recent_events, signals)
    fraud_spike = _fraud_spike_detector.evaluate(profile, recent_events, signals)
    abuse_cluster = _graph_service.get_merchant_cluster(merchant_id)

    return compute_risk_assessment(
        merchant_id=merchant_id,
        signals=signals,
        workflow_result=workflow_result,
        fraud_spike=fraud_spike,
        abuse_cluster=abuse_cluster,
    )


def get_merchant_profile(merchant_id: str) -> MerchantProfile:
    """Build and return current Merchant Behavioral Genome."""
    events = db.get_merchant_events(merchant_id)
    return build_merchant_profile(merchant_id, events)


def get_graph_clusters() -> list:
    """Retrieve all detected syndicate abuse clusters."""
    return _graph_service.detect_abuse_clusters()
