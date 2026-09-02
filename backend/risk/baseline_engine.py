"""
RiskSūtra — Behavioral Baseline Engine

Builds per-merchant behavioral profiles from historical events.
Computes deviation signals when new events arrive.

Methods: rolling statistics, z-scores, frequency analysis.
No ML models. No LLM. Fully deterministic.
"""

from collections import Counter, defaultdict
from datetime import datetime
from typing import Optional
import statistics
import uuid

from models.schemas import (
    Event, EventType, MerchantProfile, RiskSignal, Severity,
)


# ──────────────────────────────────────────────
# Profile Builder
# ──────────────────────────────────────────────

def build_merchant_profile(merchant_id: str, events: list[Event]) -> MerchantProfile:
    """
    Build a behavioral profile from historical events.
    This is the Merchant Behavioral Genome — the statistical identity of a merchant.
    """
    if not events:
        return MerchantProfile(merchant_id=merchant_id)

    # Hour distribution
    hour_counts: dict[int, int] = Counter()
    for e in events:
        hour_counts[e.timestamp.hour] += 1

    # Known entities
    known_devices: set[str] = set()
    known_countries: set[str] = set()
    known_asns: set[str] = set()
    for e in events:
        if e.device_id:
            known_devices.add(e.device_id)
        if e.country:
            known_countries.add(e.country)
        if e.asn:
            known_asns.add(e.asn)

    # API rate: requests per hour
    api_events = [e for e in events if e.event_type == EventType.API_REQUEST]
    api_rate = _compute_hourly_rate_stats(api_events)

    # Transaction rate and amounts
    txn_events = [e for e in events if e.event_type in (EventType.TRANSACTION, EventType.TRANSACTION_RESULT)]
    txn_rate = _compute_hourly_rate_stats(txn_events)

    amounts = [e.amount for e in txn_events if e.amount is not None]
    amount_stats = _compute_amount_stats(amounts)

    # Event frequency per type
    type_counts: dict[str, int] = Counter()
    for e in events:
        type_counts[e.event_type.value] += 1

    # Sensitive actions count
    sensitive_types = {EventType.CONFIG_CHANGE, EventType.PAYOUT_EVENT, EventType.ACCOUNT_ACTION}
    sensitive_count = sum(1 for e in events if e.event_type in sensitive_types)

    timestamps = [e.timestamp for e in events]

    return MerchantProfile(
        merchant_id=merchant_id,
        typical_hours=dict(hour_counts),
        known_devices=sorted(known_devices),
        known_countries=sorted(known_countries),
        known_asns=sorted(known_asns),
        api_rate_baseline=api_rate,
        transaction_rate_baseline=txn_rate,
        amount_statistics=amount_stats,
        event_frequency=dict(type_counts),
        sensitive_action_count=sensitive_count,
        total_events=len(events),
        baseline_window_start=min(timestamps),
        baseline_window_end=max(timestamps),
    )


def _compute_hourly_rate_stats(events: list[Event]) -> dict:
    """Compute mean and std of events per hour."""
    if not events:
        return {"mean": 0.0, "std": 0.0, "total": 0}

    hour_counts: dict[str, int] = defaultdict(int)
    for e in events:
        # Group by date-hour key
        key = e.timestamp.strftime("%Y-%m-%d-%H")
        hour_counts[key] += 1

    counts = list(hour_counts.values())
    mean = statistics.mean(counts) if counts else 0.0
    std = statistics.stdev(counts) if len(counts) > 1 else 0.0

    return {"mean": round(mean, 3), "std": round(std, 3), "total": len(events)}


def _compute_amount_stats(amounts: list[float]) -> dict:
    """Compute amount distribution statistics."""
    if not amounts:
        return {"p25": 0, "p50": 0, "p75": 0, "p95": 0, "max": 0, "mean": 0, "std": 0}

    sorted_amounts = sorted(amounts)
    n = len(sorted_amounts)

    def percentile(p: float) -> float:
        idx = int(p / 100 * (n - 1))
        return sorted_amounts[min(idx, n - 1)]

    return {
        "p25": round(percentile(25), 2),
        "p50": round(percentile(50), 2),
        "p75": round(percentile(75), 2),
        "p95": round(percentile(95), 2),
        "max": round(max(amounts), 2),
        "mean": round(statistics.mean(amounts), 2),
        "std": round(statistics.stdev(amounts) if len(amounts) > 1 else 0, 2),
    }


# ──────────────────────────────────────────────
# Deviation Calculator
# ──────────────────────────────────────────────

def compute_deviation_signals(
    profile: MerchantProfile,
    new_events: list[Event],
) -> list[RiskSignal]:
    """
    Compare new events against merchant profile.
    Returns a list of typed risk signals with normalized severity.
    """
    if not new_events or profile.total_events == 0:
        return []

    signals: list[RiskSignal] = []
    evidence_ids = [e.event_id for e in new_events]

    # 1. Device novelty
    device_signal = _check_device_novelty(profile, new_events, evidence_ids)
    if device_signal:
        signals.append(device_signal)

    # 2. Country novelty
    country_signal = _check_country_novelty(profile, new_events, evidence_ids)
    if country_signal:
        signals.append(country_signal)

    # 3. ASN novelty
    asn_signal = _check_asn_novelty(profile, new_events, evidence_ids)
    if asn_signal:
        signals.append(asn_signal)

    # 4. Hour deviation
    hour_signal = _check_hour_deviation(profile, new_events, evidence_ids)
    if hour_signal:
        signals.append(hour_signal)

    # 5. API rate deviation
    api_signal = _check_api_rate_deviation(profile, new_events, evidence_ids)
    if api_signal:
        signals.append(api_signal)

    # 6. Transaction rate deviation
    txn_rate_signal = _check_txn_rate_deviation(profile, new_events, evidence_ids)
    if txn_rate_signal:
        signals.append(txn_rate_signal)

    # 7. Transaction amount deviation
    amount_signal = _check_amount_deviation(profile, new_events, evidence_ids)
    if amount_signal:
        signals.append(amount_signal)

    # 8. Sensitive action presence
    sensitive_signal = _check_sensitive_actions(profile, new_events, evidence_ids)
    if sensitive_signal:
        signals.append(sensitive_signal)

    return signals


def _make_signal(
    merchant_id: str,
    signal_type: str,
    value: float,
    evidence_ids: list[str],
    timestamp: Optional[datetime] = None,
) -> RiskSignal:
    """Create a RiskSignal with appropriate severity band."""
    value = max(0.0, min(1.0, value))

    if value >= 0.8:
        severity = Severity.CRITICAL
    elif value >= 0.6:
        severity = Severity.HIGH
    elif value >= 0.3:
        severity = Severity.MEDIUM
    else:
        severity = Severity.LOW

    return RiskSignal(
        signal_id=f"SIG_{uuid.uuid4().hex[:12]}",
        merchant_id=merchant_id,
        timestamp=timestamp or datetime.utcnow(),
        signal_type=signal_type,
        value=round(value, 4),
        severity=severity,
        source="baseline_engine",
        evidence_event_ids=evidence_ids,
    )


def _check_device_novelty(
    profile: MerchantProfile, events: list[Event], evidence_ids: list[str]
) -> Optional[RiskSignal]:
    new_devices = set()
    for e in events:
        if e.device_id and e.device_id not in profile.known_devices:
            new_devices.add(e.device_id)

    if not new_devices:
        return None

    # Severity based on ratio of new devices to known
    known_count = max(len(profile.known_devices), 1)
    novelty_ratio = len(new_devices) / known_count
    value = min(1.0, novelty_ratio * 0.7 + 0.3)  # Base 0.3 for any new device

    return _make_signal(
        profile.merchant_id, "NEW_DEVICE", value,
        [e.event_id for e in events if e.device_id in new_devices],
    )


def _check_country_novelty(
    profile: MerchantProfile, events: list[Event], evidence_ids: list[str]
) -> Optional[RiskSignal]:
    new_countries = set()
    for e in events:
        if e.country and e.country not in profile.known_countries:
            new_countries.add(e.country)

    if not new_countries:
        return None

    value = min(1.0, 0.5 + len(new_countries) * 0.2)
    return _make_signal(
        profile.merchant_id, "NEW_COUNTRY", value,
        [e.event_id for e in events if e.country in new_countries],
    )


def _check_asn_novelty(
    profile: MerchantProfile, events: list[Event], evidence_ids: list[str]
) -> Optional[RiskSignal]:
    new_asns = set()
    for e in events:
        if e.asn and e.asn not in profile.known_asns:
            new_asns.add(e.asn)

    if not new_asns:
        return None

    value = min(1.0, 0.3 + len(new_asns) * 0.2)
    return _make_signal(
        profile.merchant_id, "NEW_ASN", value,
        [e.event_id for e in events if e.asn in new_asns],
    )


def _check_hour_deviation(
    profile: MerchantProfile, events: list[Event], evidence_ids: list[str]
) -> Optional[RiskSignal]:
    if not profile.typical_hours:
        return None

    total_baseline = sum(profile.typical_hours.values())
    if total_baseline == 0:
        return None

    unusual_events = []
    for e in events:
        hour_str = str(e.timestamp.hour)
        hour_count = profile.typical_hours.get(hour_str, 0)
        # If this hour has < 2% of total baseline activity, it's unusual
        if hour_count / total_baseline < 0.02:
            unusual_events.append(e)

    if not unusual_events:
        return None

    ratio = len(unusual_events) / len(events)
    value = min(1.0, ratio * 0.8)

    return _make_signal(
        profile.merchant_id, "HOUR_DEVIATION", value,
        [e.event_id for e in unusual_events],
    )


def _check_api_rate_deviation(
    profile: MerchantProfile, events: list[Event], evidence_ids: list[str]
) -> Optional[RiskSignal]:
    api_events = [e for e in events if e.event_type == EventType.API_REQUEST]
    if not api_events:
        return None

    baseline_mean = profile.api_rate_baseline.get("mean", 0)
    baseline_std = profile.api_rate_baseline.get("std", 1)

    if baseline_mean == 0:
        if len(api_events) > 3:
            return _make_signal(profile.merchant_id, "API_RATE_SPIKE", 0.5, evidence_ids)
        return None

    # Z-score of current rate
    current_rate = len(api_events)
    z_score = (current_rate - baseline_mean) / max(baseline_std, 0.1)

    if z_score <= 2.0:
        return None

    value = min(1.0, (z_score - 2.0) / 6.0 + 0.3)
    return _make_signal(profile.merchant_id, "API_RATE_SPIKE", value, evidence_ids)


def _check_txn_rate_deviation(
    profile: MerchantProfile, events: list[Event], evidence_ids: list[str]
) -> Optional[RiskSignal]:
    txn_events = [e for e in events if e.event_type in (EventType.TRANSACTION, EventType.TRANSACTION_RESULT)]
    if not txn_events:
        return None

    baseline_mean = profile.transaction_rate_baseline.get("mean", 0)
    baseline_std = profile.transaction_rate_baseline.get("std", 1)

    if baseline_mean == 0:
        if len(txn_events) > 3:
            return _make_signal(profile.merchant_id, "TXN_RATE_SPIKE", 0.4, evidence_ids)
        return None

    current_rate = len(txn_events)
    z_score = (current_rate - baseline_mean) / max(baseline_std, 0.1)

    if z_score <= 2.0:
        return None

    value = min(1.0, (z_score - 2.0) / 6.0 + 0.3)
    return _make_signal(
        profile.merchant_id, "TXN_RATE_SPIKE", value,
        [e.event_id for e in txn_events],
    )


def _check_amount_deviation(
    profile: MerchantProfile, events: list[Event], evidence_ids: list[str]
) -> Optional[RiskSignal]:
    txn_events = [e for e in events if e.amount is not None]
    if not txn_events:
        return None

    baseline_p95 = profile.amount_statistics.get("p95", 0)
    baseline_mean = profile.amount_statistics.get("mean", 0)
    baseline_std = profile.amount_statistics.get("std", 1)

    if baseline_mean == 0:
        return None

    outliers = []
    for e in txn_events:
        if e.amount and e.amount > baseline_p95 * 1.5:
            outliers.append(e)

    if not outliers:
        return None

    # Average z-score of outlier amounts
    z_scores = [(e.amount - baseline_mean) / max(baseline_std, 1) for e in outliers if e.amount]
    avg_z = statistics.mean(z_scores) if z_scores else 0

    value = min(1.0, (avg_z - 2.0) / 5.0 + 0.3) if avg_z > 2 else 0.2
    return _make_signal(
        profile.merchant_id, "AMOUNT_ANOMALY", value,
        [e.event_id for e in outliers],
    )


def _check_sensitive_actions(
    profile: MerchantProfile, events: list[Event], evidence_ids: list[str]
) -> Optional[RiskSignal]:
    sensitive_types = {EventType.CONFIG_CHANGE, EventType.PAYOUT_EVENT, EventType.ACCOUNT_ACTION}
    sensitive_events = [e for e in events if e.event_type in sensitive_types]

    if not sensitive_events:
        return None

    # Compare frequency to baseline
    baseline_sensitive = profile.sensitive_action_count
    baseline_total = max(profile.total_events, 1)
    baseline_ratio = baseline_sensitive / baseline_total

    current_ratio = len(sensitive_events) / max(len(events), 1)

    if baseline_ratio == 0 and len(sensitive_events) > 0:
        value = 0.6  # First sensitive actions ever
    elif current_ratio > baseline_ratio * 3:
        value = min(1.0, 0.5 + (current_ratio / max(baseline_ratio, 0.001)) * 0.05)
    else:
        return None

    return _make_signal(
        profile.merchant_id, "SENSITIVE_ACTION_SPIKE", value,
        [e.event_id for e in sensitive_events],
    )
