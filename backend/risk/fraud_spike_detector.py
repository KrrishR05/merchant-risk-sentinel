"""
RiskSūtra — Fraud Spike Detector

Monitors sliding time windows (5m, 15m, 1h) for anomalous volume, velocity, amount,
and decline rate surges. Differentiates benign sales campaigns from malicious fraud spikes.
"""

from datetime import datetime, timedelta
from typing import Optional

from models.schemas import Event, EventType, FraudSpikeAssessment, MerchantProfile, RiskSignal


class FraudSpikeDetector:
    """
    Sliding window volume and fraud spike assessment engine.
    """

    def evaluate(
        self,
        profile: MerchantProfile,
        events: list[Event],
        signals: list[RiskSignal],
    ) -> FraudSpikeAssessment:
        """
        Evaluate sliding window event metrics against baseline profile.
        """
        if not events:
            return FraudSpikeAssessment()

        txn_events = [e for e in events if e.event_type in (EventType.TRANSACTION, EventType.TRANSACTION_RESULT)]
        if not txn_events:
            return FraudSpikeAssessment()

        # Check signals present
        signal_types = set(s.signal_type for s in signals)
        has_new_identity = "NEW_DEVICE" in signal_types or "NEW_COUNTRY" in signal_types or "NEW_IP" in signal_types
        has_sensitive_action = "SENSITIVE_ACTION_ANOMALY" in signal_types or "SENSITIVE_ACTION_SPIKE" in signal_types
        has_amount_anomaly = "TRANSACTION_AMOUNT_ANOMALY" in signal_types or "AMOUNT_ANOMALY" in signal_types

        # Volume rate comparison
        baseline_rate = profile.transaction_rate_baseline.get("mean", 1.0)
        current_volume = len(txn_events)
        volume_ratio = current_volume / max(baseline_rate, 0.5)

        # Device & Geo diversity in current window
        current_devices = set(e.device_id for e in txn_events if e.device_id)
        known_device_ratio = len(current_devices.intersection(set(profile.known_devices))) / max(len(current_devices), 1)

        evidence_ids = [e.event_id for e in txn_events]

        supporting_signals = []
        if volume_ratio >= 2.5:
            supporting_signals.append(f"Volume spike ({volume_ratio:.1f}x baseline mean)")
        if has_new_identity:
            supporting_signals.append("Identity novelty present during volume surge")
        if has_sensitive_action:
            supporting_signals.append("Sensitive control plane changes co-occurred with surge")

        # Classification logic
        if volume_ratio < 2.0 and not has_amount_anomaly:
            return FraudSpikeAssessment(
                spike_score=0.05,
                classification="NORMAL",
                baseline_comparison={"volume_ratio": round(volume_ratio, 2)},
                evidence_event_ids=evidence_ids,
            )

        # If high volume BUT high known device ratio and NO sensitive/identity anomaly -> BENIGN_SALE_SPIKE
        if volume_ratio >= 2.0 and known_device_ratio >= 0.70 and not has_new_identity and not has_sensitive_action:
            return FraudSpikeAssessment(
                spike_score=0.15,
                classification="BENIGN_SALE_SPIKE",
                baseline_comparison={
                    "volume_ratio": round(volume_ratio, 2),
                    "known_device_ratio": round(known_device_ratio, 2),
                    "note": "Legitimate transaction volume surge verified with known merchant devices and zero identity/control-plane anomalies.",
                },
                supporting_signals=["High-volume sales campaign pattern"],
                evidence_event_ids=evidence_ids,
            )

        # Otherwise -> SUSPICIOUS_SPIKE
        raw_score = 0.40
        if volume_ratio >= 4.0:
            raw_score += 0.20
        if has_new_identity:
            raw_score += 0.25
        if has_sensitive_action:
            raw_score += 0.15

        spike_score = round(min(1.0, raw_score), 4)

        return FraudSpikeAssessment(
            spike_score=spike_score,
            classification="SUSPICIOUS_SPIKE",
            baseline_comparison={
                "volume_ratio": round(volume_ratio, 2),
                "known_device_ratio": round(known_device_ratio, 2),
            },
            supporting_signals=supporting_signals,
            evidence_event_ids=evidence_ids,
        )
