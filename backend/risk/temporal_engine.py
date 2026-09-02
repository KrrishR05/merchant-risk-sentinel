"""
RiskSūtra — Temporal Event Engine

Provides ordered, signal-annotated event sequences over custom time windows.
Acts as the temporal representation layer for the Workflow Integrity Engine.
"""

from datetime import datetime
from typing import Optional

from db import database as db
from models.schemas import Event, RiskSignal


def get_ordered_event_sequence(
    merchant_id: str,
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
    limit: int = 200,
) -> list[Event]:
    """
    Retrieve chronological event sequence for a merchant and window.
    Guarantees strict timestamp-ascending order.
    """
    events = db.get_merchant_events(
        merchant_id=merchant_id,
        start_time=start_time,
        end_time=end_time,
        limit=limit,
    )
    # Ensure strictly sorted by timestamp
    events.sort(key=lambda e: e.timestamp)
    return events


def annotate_events_with_signals(
    events: list[Event],
    signals: list[RiskSignal],
) -> list[dict]:
    """
    Map risk signals back to their corresponding evidence events.
    Returns a list of event dictionaries augmented with attached signals.
    """
    # Map event_id -> list of attached signal_types/values
    event_signals: dict[str, list[dict]] = {}
    for sig in signals:
        for ev_id in sig.evidence_event_ids:
            if ev_id not in event_signals:
                event_signals[ev_id] = []
            event_signals[ev_id].append({
                "signal_id": sig.signal_id,
                "signal_type": sig.signal_type,
                "severity": sig.severity.value,
                "value": sig.value,
                "reason": sig.reason,
            })

    annotated = []
    for e in events:
        d = e.model_dump()
        d["attached_signals"] = event_signals.get(e.event_id, [])
        annotated.append(d)

    return annotated
