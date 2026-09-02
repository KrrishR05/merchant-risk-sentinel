"""
RiskSūtra — Behavioral Baseline Engine (Merchant Behavioral Genome)

Builds per-merchant statistical identities (Merchant Behavioral Genome) from historical event logs.
Computes interpretable, evidence-grounded deviation signals when new events arrive.

Methods: rolling statistics, robust z-scores, median/quantiles, frequency analysis.
No ML models. No black-box LLMs. Fully deterministic and testable.
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
# Genome / Profile Builder
# ──────────────────────────────────────────────

def build_merchant_profile(merchant_id: str, events: list[Event]) -> MerchantProfile:
    """
    Build a comprehensive Merchant Behavioral Genome from historical events.
    This is the statistical identity of a specific merchant.
    """
    if not events:
        return MerchantProfile(merchant_id=merchant_id)

    # Hour distribution (0-23)
    hour_counts: dict[int, int] = Counter()
    day_counts: dict[int, int] = Counter()
    for e in events:
        hour_counts[e.timestamp.hour] += 1
        day_counts[e.timestamp.weekday()] += 1

    # Known entity sets
    known_devices: set[str] = set()
    known_countries: set[str] = set()
    known_asns: set[str] = set()
    known_ips: set[set[str]] = set()  # set of strings
    known_ips_set: set[str] = set()

    for e in events:
        if e.device_id:
            known_devices.add(e.device_id)
        if e.country:
            known_countries.add(e.country)
        if e.asn:
            known_asns.add(e.asn)
        if e.ip_address:
            known_ips_set.add(e.ip_address)

    # Endpoint distribution
    endpoint_counts: dict[str, int] = Counter()
    for e in events:
        if e.endpoint:
            endpoint_counts[e.endpoint] += 1

    # API rate stats
    api_events = [e for e in events if e.event_type == EventType.API_REQUEST]
    api_rate = _compute_hourly_rate_stats(api_events)

    # Transaction rate stats and amount quantiles
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
        day_of_week_distribution=dict(day_counts),
        known_devices=sorted(known_devices),
        known_countries=sorted(known_countries),
        known_asns=sorted(known_asns),
        known_ips=sorted(known_ips_set),
        api_rate_baseline=api_rate,
        transaction_rate_baseline=txn_rate,
        amount_statistics=amount_stats,
        endpoint_distribution=dict(endpoint_counts),
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
        key = e.timestamp.strftime("%Y-%m-%d-%H")
        hour_counts[key] += 1

    counts = list(hour_counts.values())
    mean = statistics.mean(counts) if counts else 0.0
    std = statistics.stdev(counts) if len(counts) > 1 else 0.0

    return {"mean": round(mean, 3), "std": round(std, 3), "total": len(events)}


def _compute_amount_stats(amounts: list[float]) -> dict:
    """Compute amount distribution statistics (p25, p50, p75, p95, max)."""
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
    Compare new incoming events against merchant behavioral profile.
    Returns structured, evidence-grounded risk signals.
    """
    if not new_events or profile.total_events == 0:
        return []

    signals: list[RiskSignal] = []

    # 1. Device novelty
    dev_sig = _check_device_novelty(profile, new_events)
    if dev_sig:
        signals.append(dev_sig)

    # 2. Country novelty
    country_sig = _check_country_novelty(profile, new_events)
    if country_sig:
        signals.append(country_sig)

    # 3. IP novelty
    ip_sig = _check_ip_novelty(profile, new_events)
    if ip_sig:
        signals.append(ip_sig)

    # 4. ASN novelty
    asn_sig = _check_asn_novelty(profile, new_events)
    if asn_sig:
        signals.append(asn_sig)

    # 5. Hour deviation (Unusual Hour)
    hour_sig = _check_hour_deviation(profile, new_events)
    if hour_sig:
        signals.append(hour_sig)

    # 6. API rate anomaly
    api_sig = _check_api_rate_deviation(profile, new_events)
    if api_sig:
        signals.append(api_sig)

    # 7. Transaction rate anomaly
    txn_rate_sig = _check_txn_rate_deviation(profile, new_events)
    if txn_rate_sig:
        signals.append(txn_rate_sig)

    # 8. Transaction amount anomaly
    amount_sig = _check_amount_deviation(profile, new_events)
    if amount_sig:
        signals.append(amount_sig)

    # 9. Sensitive action anomaly
    sensitive_sig = _check_sensitive_actions(profile, new_events)
    if sensitive_sig:
        signals.append(sensitive_sig)

    # 10. Auth failure anomaly
    auth_fail_sig = _check_auth_failures(profile, new_events)
    if auth_fail_sig:
        signals.append(auth_fail_sig)

    return signals


def _make_signal(
    merchant_id: str,
    signal_type: str,
    value: float,
    evidence_ids: list[str],
    reason: str,
    baseline_value: str,
    observed_value: str,
    timestamp: Optional[datetime] = None,
) -> RiskSignal:
    """Create a RiskSignal with normalized severity band and reason metadata."""
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
        reason=reason,
        baseline_value=baseline_value,
        observed_value=observed_value,
        evidence_event_ids=evidence_ids,
    )


def _check_device_novelty(profile: MerchantProfile, events: list[Event]) -> Optional[RiskSignal]:
    new_devices = set()
    for e in events:
        if e.device_id and e.device_id not in profile.known_devices:
            new_devices.add(e.device_id)

    if not new_devices:
        return None

    known_count = max(len(profile.known_devices), 1)
    novelty_ratio = len(new_devices) / known_count
    value = min(1.0, novelty_ratio * 0.7 + 0.3)

    evidence_ids = [e.event_id for e in events if e.device_id in new_devices]
    dev_str = ", ".join(list(new_devices)[:2])
    return _make_signal(
        profile.merchant_id,
        "NEW_DEVICE",
        value,
        evidence_ids,
        reason=f"Observed {len(new_devices)} previously unseen device fingerprint(s) ({dev_str})",
        baseline_value=f"{len(profile.known_devices)} known devices",
        observed_value=f"{len(new_devices)} new device(s)",
    )


def _check_country_novelty(profile: MerchantProfile, events: list[Event]) -> Optional[RiskSignal]:
    new_countries = set()
    for e in events:
        if e.country and e.country not in profile.known_countries:
            new_countries.add(e.country)

    if not new_countries:
        return None

    value = min(1.0, 0.5 + len(new_countries) * 0.2)
    evidence_ids = [e.event_id for e in events if e.country in new_countries]
    c_str = ", ".join(list(new_countries))
    return _make_signal(
        profile.merchant_id,
        "NEW_COUNTRY",
        value,
        evidence_ids,
        reason=f"Access requested from unfamiliar geographic region(s): {c_str}",
        baseline_value=f"Known countries: {', '.join(profile.known_countries)}",
        observed_value=f"New countries: {c_str}",
    )


def _check_ip_novelty(profile: MerchantProfile, events: list[Event]) -> Optional[RiskSignal]:
    new_ips = set()
    for e in events:
        if e.ip_address and profile.known_ips and e.ip_address not in profile.known_ips:
            new_ips.add(e.ip_address)

    if not new_ips:
        return None

    # Mild value for IP change (common with dynamic IPs), higher if combined
    value = min(1.0, 0.2 + len(new_ips) * 0.1)
    evidence_ids = [e.event_id for e in events if e.ip_address in new_ips]
    ip_str = ", ".join(list(new_ips)[:2])
    return _make_signal(
        profile.merchant_id,
        "NEW_IP",
        value,
        evidence_ids,
        reason=f"Events originated from new IP address(es): {ip_str}",
        baseline_value=f"{len(profile.known_ips)} known IPs",
        observed_value=f"{len(new_ips)} new IP(s)",
    )


def _check_asn_novelty(profile: MerchantProfile, events: list[Event]) -> Optional[RiskSignal]:
    new_asns = set()
    for e in events:
        if e.asn and e.asn not in profile.known_asns:
            new_asns.add(e.asn)

    if not new_asns:
        return None

    value = min(1.0, 0.3 + len(new_asns) * 0.2)
    evidence_ids = [e.event_id for e in events if e.asn in new_asns]
    asn_str = ", ".join(list(new_asns))
    return _make_signal(
        profile.merchant_id,
        "NEW_ASN",
        value,
        evidence_ids,
        reason=f"Autonomous System Network shift detected: {asn_str}",
        baseline_value=f"Known ASNs: {', '.join(profile.known_asns)}",
        observed_value=f"New ASNs: {asn_str}",
    )


def _check_hour_deviation(profile: MerchantProfile, events: list[Event]) -> Optional[RiskSignal]:
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
    hours_seen = sorted(list(set(e.timestamp.hour for e in unusual_events)))

    return _make_signal(
        profile.merchant_id,
        "UNUSUAL_HOUR",
        value,
        [e.event_id for e in unusual_events],
        reason=f"Activity recorded during off-peak historical hours (Hour {hours_seen})",
        baseline_value="Primary operating hours: " + ", ".join(f"{h}:00" for h, c in profile.typical_hours.items() if c > total_baseline * 0.05),
        observed_value=f"Unusual activity hour(s): {hours_seen}",
    )


def _check_api_rate_deviation(profile: MerchantProfile, events: list[Event]) -> Optional[RiskSignal]:
    api_events = [e for e in events if e.event_type == EventType.API_REQUEST]
    if not api_events:
        return None

    baseline_mean = profile.api_rate_baseline.get("mean", 0)
    baseline_std = profile.api_rate_baseline.get("std", 1)

    if baseline_mean == 0:
        if len(api_events) > 3:
            return _make_signal(
                profile.merchant_id,
                "API_RATE_ANOMALY",
                0.5,
                [e.event_id for e in api_events],
                reason=f"API burst detected ({len(api_events)} reqs) on zero-baseline merchant",
                baseline_value="0 reqs/hr",
                observed_value=f"{len(api_events)} reqs",
            )
        return None

    current_rate = len(api_events)
    z_score = (current_rate - baseline_mean) / max(baseline_std, 0.1)

    if z_score <= 2.0:
        return None

    value = min(1.0, (z_score - 2.0) / 6.0 + 0.3)
    return _make_signal(
        profile.merchant_id,
        "API_RATE_ANOMALY",
        value,
        [e.event_id for e in api_events],
        reason=f"API request volume z-score={z_score:.1f} (exceeds baseline mean {baseline_mean:.1f}/hr)",
        baseline_value=f"mean={baseline_mean:.1f}, std={baseline_std:.1f}",
        observed_value=f"{current_rate} reqs (z={z_score:.1f})",
    )


def _check_txn_rate_deviation(profile: MerchantProfile, events: list[Event]) -> Optional[RiskSignal]:
    txn_events = [e for e in events if e.event_type in (EventType.TRANSACTION, EventType.TRANSACTION_RESULT)]
    if not txn_events:
        return None

    baseline_mean = profile.transaction_rate_baseline.get("mean", 0)
    baseline_std = profile.transaction_rate_baseline.get("std", 1)

    if baseline_mean == 0:
        if len(txn_events) > 3:
            return _make_signal(
                profile.merchant_id,
                "TRANSACTION_RATE_ANOMALY",
                0.4,
                [e.event_id for e in txn_events],
                reason=f"Transaction volume spike ({len(txn_events)} txns) on zero-baseline merchant",
                baseline_value="0 txns/hr",
                observed_value=f"{len(txn_events)} txns",
            )
        return None

    current_rate = len(txn_events)
    z_score = (current_rate - baseline_mean) / max(baseline_std, 0.1)

    if z_score <= 2.0:
        return None

    value = min(1.0, (z_score - 2.0) / 6.0 + 0.3)
    return _make_signal(
        profile.merchant_id,
        "TRANSACTION_RATE_ANOMALY",
        value,
        [e.event_id for e in txn_events],
        reason=f"Transaction velocity z-score={z_score:.1f} (exceeds baseline mean {baseline_mean:.1f}/hr)",
        baseline_value=f"mean={baseline_mean:.1f}, std={baseline_std:.1f}",
        observed_value=f"{current_rate} txns (z={z_score:.1f})",
    )


def _check_amount_deviation(profile: MerchantProfile, events: list[Event]) -> Optional[RiskSignal]:
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

    z_scores = [(e.amount - baseline_mean) / max(baseline_std, 1) for e in outliers if e.amount]
    avg_z = statistics.mean(z_scores) if z_scores else 0

    value = min(1.0, (avg_z - 2.0) / 5.0 + 0.3) if avg_z > 2 else 0.2
    max_amount = max(e.amount for e in outliers if e.amount)
    return _make_signal(
        profile.merchant_id,
        "TRANSACTION_AMOUNT_ANOMALY",
        value,
        [e.event_id for e in outliers],
        reason=f"Outlier transaction amount(s) up to ₹{max_amount:,.2f} detected (exceeds p95 of ₹{baseline_p95:,.2f})",
        baseline_value=f"p95=₹{baseline_p95:,.2f}, mean=₹{baseline_mean:,.2f}",
        observed_value=f"outlier max=₹{max_amount:,.2f}",
    )


def _check_sensitive_actions(profile: MerchantProfile, events: list[Event]) -> Optional[RiskSignal]:
    sensitive_types = {EventType.CONFIG_CHANGE, EventType.PAYOUT_EVENT, EventType.ACCOUNT_ACTION}
    sensitive_events = [e for e in events if e.event_type in sensitive_types]

    if not sensitive_events:
        return None

    baseline_sensitive = profile.sensitive_action_count
    baseline_total = max(profile.total_events, 1)
    baseline_ratio = baseline_sensitive / baseline_total

    current_ratio = len(sensitive_events) / max(len(events), 1)

    if baseline_ratio == 0 and len(sensitive_events) > 0:
        value = 0.6
        reason = f"First-ever sensitive control plane modification ({len(sensitive_events)} action(s))"
    elif current_ratio > baseline_ratio * 3:
        value = min(1.0, 0.5 + (current_ratio / max(baseline_ratio, 0.001)) * 0.05)
        reason = f"Sensitive operation surge ({len(sensitive_events)} actions, {current_ratio/max(baseline_ratio, 0.001):.1f}x baseline ratio)"
    else:
        return None

    actions = [f"{e.event_type.value}:{e.action}" for e in sensitive_events if e.action]
    action_summary = ", ".join(actions[:3])

    return _make_signal(
        profile.merchant_id,
        "SENSITIVE_ACTION_ANOMALY",
        value,
        [e.event_id for e in sensitive_events],
        reason=f"{reason}: {action_summary}",
        baseline_value=f"{baseline_sensitive} historical sensitive actions",
        observed_value=f"{len(sensitive_events)} sensitive action(s) in window",
    )


def _check_auth_failures(profile: MerchantProfile, events: list[Event]) -> Optional[RiskSignal]:
    auth_fails = [e for e in events if e.event_type == EventType.AUTH_FAILURE]
    if not auth_fails:
        return None

    value = min(1.0, 0.3 + len(auth_fails) * 0.15)
    return _make_signal(
        profile.merchant_id,
        "AUTH_FAILURE_ANOMALY",
        value,
        [e.event_id for e in auth_fails],
        reason=f"Repeated authentication failures detected ({len(auth_fails)} attempt(s))",
        baseline_value="0 auth failures",
        observed_value=f"{len(auth_fails)} auth failure(s)",
    )
