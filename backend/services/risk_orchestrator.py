"""
RiskSūtra — Risk Orchestrator Service

Orchestrates the full risk evaluation pipeline:
Event ingestion → Profile building → Deviation detection → Risk fusion → Incident creation

This is the main business logic coordinator that ties together the baseline engine,
fusion engine, and data layer.
"""

import logging
from datetime import datetime
from typing import Optional

from db import database as db
from models.schemas import Event, Incident, MerchantProfile, RiskAssessment
from risk.baseline_engine import build_merchant_profile, compute_deviation_signals
from risk.fusion_engine import (
    compute_risk_assessment,
    create_incident_from_assessment,
    should_create_incident,
)

logger = logging.getLogger("risksutra.orchestrator")


def ingest_event(event: Event) -> dict:
    """
    Process a single event through the full risk pipeline.

    Returns a dict with:
    - ingested: bool
    - duplicate: bool
    - risk_assessment: RiskAssessment or None
    - incident_created: Incident or None
    """
    # 1. Validate merchant exists
    merchant = db.get_merchant(event.merchant_id)
    if not merchant:
        raise ValueError(f"Unknown merchant: {event.merchant_id}")

    # 2. Persist event (with deduplication)
    is_new = db.save_event(event)
    if not is_new:
        logger.info(f"Duplicate event {event.event_id} — skipped")
        return {"ingested": False, "duplicate": True, "risk_assessment": None, "incident_created": None}

    # 3. Build profile from historical events
    historical_events = db.get_merchant_events(event.merchant_id)
    profile = build_merchant_profile(event.merchant_id, historical_events)

    # 4. Compute deviation for the new event
    signals = compute_deviation_signals(profile, [event])

    # 5. Persist signals
    if signals:
        db.save_signals_bulk(signals)

    # 6. Risk assessment
    assessment = compute_risk_assessment(event.merchant_id, signals)

    # 7. Incident creation if warranted
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
    Ingest a batch of events and evaluate risk for the entire batch.
    More efficient than one-by-one for scenario injection.
    """
    if not events:
        return {"ingested": 0, "risk_assessment": None, "incident_created": None}

    merchant_id = events[0].merchant_id

    # Validate merchant
    merchant = db.get_merchant(merchant_id)
    if not merchant:
        raise ValueError(f"Unknown merchant: {merchant_id}")

    # Persist all events
    inserted = db.save_events_bulk(events)

    # Build profile from ALL historical (pre-attack) events
    all_events = db.get_merchant_events(merchant_id)
    # Use events BEFORE the batch window as baseline
    batch_start = min(e.timestamp for e in events)
    baseline_events = [e for e in all_events if e.timestamp < batch_start]

    if not baseline_events:
        # If no historical data, use first half as baseline
        mid = len(all_events) // 2
        baseline_events = all_events[:mid] if mid > 0 else all_events

    profile = build_merchant_profile(merchant_id, baseline_events)

    # Compute deviation for new events
    signals = compute_deviation_signals(profile, events)

    if signals:
        db.save_signals_bulk(signals)

    # Risk assessment
    assessment = compute_risk_assessment(merchant_id, signals)

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
    """Get current risk assessment for a merchant based on recent signals."""
    signals = db.get_merchant_signals(merchant_id, limit=50)
    return compute_risk_assessment(merchant_id, signals)


def get_merchant_profile(merchant_id: str) -> MerchantProfile:
    """Build and return the current behavioral profile for a merchant."""
    events = db.get_merchant_events(merchant_id)
    return build_merchant_profile(merchant_id, events)


def get_ordered_event_sequence(
    merchant_id: str,
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
    limit: int = 100,
) -> list[Event]:
    """
    Temporal foundation — retrieve ordered event sequence for a merchant and time window.
    Used for future workflow integrity engine (Day 2).
    """
    return db.get_merchant_events(
        merchant_id,
        start_time=start_time,
        end_time=end_time,
        limit=limit,
    )
