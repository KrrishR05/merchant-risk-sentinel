"""
RiskSūtra — Workflow Integrity Engine

Evaluates temporal event sequences against merchant behavioral patterns to detect
compromised control plane attack chains (Account Takeover).

Differentiates malicious attack progressions (e.g. NEW_DEVICE → SENSITIVE_CONFIG → PAYOUT_CHANGE)
from contextual legitimate spikes (e.g. KNOWN_DEVICE → HIGH_TRANSACTION_VOLUME).
"""

from datetime import datetime, timedelta
from typing import Optional

from models.schemas import (
    Event, EventType, MerchantProfile, RiskSignal, WorkflowResult,
)


class WorkflowIntegrityEngine:
    """
    Evaluates workflow transition integrity over chronological event streams.
    """

    # Configurable attack chain transition rules
    ATTACK_PATTERNS = {
        "NEW_DEVICE_TO_SENSITIVE_ACTION": {
            "weight": 0.40,
            "description": "New device/location access followed by sensitive control plane modification within 15 mins",
        },
        "API_BURST_TO_PAYOUT_CHANGE": {
            "weight": 0.35,
            "description": "Rapid API reconnaissance burst leading to payout destination change",
        },
        "CONTROL_PLANE_TAKEOVER_CHAIN": {
            "weight": 0.50,
            "description": "Full ATO sequence: NEW_DEVICE → UNFAMILIAR_GEO → SENSITIVE_CONFIG → PAYOUT_UPDATE → TXN_SPIKE",
        },
        "UNUSUAL_HOUR_SENSITIVE_SURGE": {
            "weight": 0.25,
            "description": "Off-peak hour combined with sensitive administrative changes",
        },
    }

    def evaluate(
        self,
        profile: MerchantProfile,
        events: list[Event],
        signals: list[RiskSignal],
    ) -> WorkflowResult:
        """
        Evaluate temporal workflow integrity for an event sequence.
        """
        if not events:
            return WorkflowResult()

        # Sort chronologically
        sorted_events = sorted(events, key=lambda e: e.timestamp)
        signal_types = set(s.signal_type for s in signals)

        matched_patterns: set[str] = set()
        transition_anomalies: list[dict] = []
        chain_evidence_ids: set[str] = set()
        chain_events: list[dict] = []

        # Extract key milestones in the sequence
        has_new_device_signal = "NEW_DEVICE" in signal_types or "NEW_COUNTRY" in signal_types or "NEW_IP" in signal_types
        has_sensitive_signal = "SENSITIVE_ACTION_ANOMALY" in signal_types or "SENSITIVE_ACTION_SPIKE" in signal_types
        has_unusual_hour_signal = "UNUSUAL_HOUR" in signal_types or "HOUR_DEVIATION" in signal_types

        sensitive_events = [e for e in sorted_events if e.event_type in (EventType.CONFIG_CHANGE, EventType.PAYOUT_EVENT, EventType.ACCOUNT_ACTION)]
        new_identity_events = [
            e for e in sorted_events
            if (e.device_id and e.device_id not in profile.known_devices)
            or (e.country and e.country not in profile.known_countries)
            or (e.ip_address and profile.known_ips and e.ip_address not in profile.known_ips)
        ]
        api_events = [e for e in sorted_events if e.event_type == EventType.API_REQUEST]
        txn_events = [e for e in sorted_events if e.event_type in (EventType.TRANSACTION, EventType.TRANSACTION_RESULT)]

        # 1. Pattern: NEW_DEVICE_TO_SENSITIVE_ACTION
        if new_identity_events and sensitive_events:
            for id_evt in new_identity_events:
                for sens_evt in sensitive_events:
                    # Check if sensitive action occurred AFTER new device within 30 mins
                    time_diff = (sens_evt.timestamp - id_evt.timestamp).total_seconds()
                    if 0 <= time_diff <= 1800:
                        matched_patterns.add("NEW_DEVICE_TO_SENSITIVE_ACTION")
                        chain_evidence_ids.add(id_evt.event_id)
                        chain_evidence_ids.add(sens_evt.event_id)
                        transition_anomalies.append({
                            "pattern": "NEW_DEVICE_TO_SENSITIVE_ACTION",
                            "from_event_id": id_evt.event_id,
                            "from_type": id_evt.event_type.value,
                            "to_event_id": sens_evt.event_id,
                            "to_type": sens_evt.event_type.value,
                            "time_delta_seconds": round(time_diff, 1),
                        })

        # 2. Pattern: API_BURST_TO_PAYOUT_CHANGE
        payout_events = [e for e in sensitive_events if e.event_type == EventType.PAYOUT_EVENT or e.action == "update_payout_account"]
        if len(api_events) >= 5 and payout_events:
            first_api = api_events[0]
            for p_evt in payout_events:
                time_diff = (p_evt.timestamp - first_api.timestamp).total_seconds()
                if 0 <= time_diff <= 1800:
                    matched_patterns.add("API_BURST_TO_PAYOUT_CHANGE")
                    chain_evidence_ids.add(first_api.event_id)
                    chain_evidence_ids.add(p_evt.event_id)
                    transition_anomalies.append({
                        "pattern": "API_BURST_TO_PAYOUT_CHANGE",
                        "from_event_id": first_api.event_id,
                        "to_event_id": p_evt.event_id,
                        "time_delta_seconds": round(time_diff, 1),
                    })

        # 3. Pattern: CONTROL_PLANE_TAKEOVER_CHAIN (full 4+ step progression)
        if new_identity_events and sensitive_events and txn_events and len(matched_patterns) >= 1:
            matched_patterns.add("CONTROL_PLANE_TAKEOVER_CHAIN")

        # 4. Pattern: UNUSUAL_HOUR_SENSITIVE_SURGE
        if has_unusual_hour_signal and sensitive_events:
            matched_patterns.add("UNUSUAL_HOUR_SENSITIVE_SURGE")
            for s_evt in sensitive_events:
                chain_evidence_ids.add(s_evt.event_id)

        # Context Check for Legitimate Spikes:
        # If high transaction volume BUT NO new identity events and NO sensitive actions:
        is_legitimate_context = (
            len(new_identity_events) == 0
            and len(sensitive_events) == 0
            and not has_new_device_signal
            and not has_sensitive_signal
        )

        if is_legitimate_context:
            # Force score low even if volume is extremely high
            workflow_score = 0.05
            matched_patterns.clear()
            transition_anomalies.clear()
        else:
            # Score based on pattern weights and progression length
            raw_score = sum(self.ATTACK_PATTERNS[p]["weight"] for p in matched_patterns if p in self.ATTACK_PATTERNS)
            if has_new_device_signal and has_sensitive_signal:
                raw_score += 0.20
            workflow_score = round(min(1.0, raw_score), 4)

        # Build chain events summary
        for e in sorted_events:
            if e.event_id in chain_evidence_ids:
                chain_events.append({
                    "event_id": e.event_id,
                    "timestamp": e.timestamp.isoformat(),
                    "event_type": e.event_type.value,
                    "device_id": e.device_id,
                    "country": e.country,
                    "action": e.action,
                    "amount": e.amount,
                })

        return WorkflowResult(
            workflow_score=workflow_score,
            matched_patterns=sorted(list(matched_patterns)),
            transition_anomalies=transition_anomalies,
            chain_events=chain_events,
            evidence_event_ids=sorted(list(chain_evidence_ids)),
            is_suspicious_sequence=workflow_score >= 0.50,
        )
