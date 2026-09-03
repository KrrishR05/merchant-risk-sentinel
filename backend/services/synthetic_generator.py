"""
RiskSūtra — Synthetic Data Generator

Generates reproducible synthetic merchant data with per-archetype statistical distributions.
Creates normal merchant behavior, ATO attack sequences, and legitimate anomaly scenarios.

Random seed is fixed for reproducibility.
"""

import random
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from models.schemas import (
    Event, EventType, Merchant, MerchantType, ScenarioMetadata,
)

SEED = 42
_rng = random.Random(SEED)


def _uid(prefix: str = "") -> str:
    return f"{prefix}{uuid.UUID(int=_rng.getrandbits(128)).hex[:12]}"


# ──────────────────────────────────────────────
# Merchant Archetypes
# ──────────────────────────────────────────────

ARCHETYPES = {
    MerchantType.RESTAURANT: {
        "name_prefix": "Spice Kitchen",
        "country": "IN",
        "peak_hours": [11, 12, 13, 18, 19, 20, 21],
        "devices": 3,
        "countries": ["IN"],
        "asns": ["AS9829", "AS55836"],
        "ips_per_device": 2,
        "daily_events": (30, 60),
        "txn_amount_range": (50, 2000),
        "txn_amount_mean": 450,
        "txn_amount_std": 300,
        "api_endpoints": ["/api/orders", "/api/payments", "/api/menu"],
        "sensitive_action_prob": 0.01,
        "session_duration_hours": (1, 4),
    },
    MerchantType.SAAS: {
        "name_prefix": "CloudSync",
        "country": "IN",
        "peak_hours": list(range(8, 23)),  # Broad hours
        "devices": 5,
        "countries": ["IN", "US", "GB"],
        "asns": ["AS13335", "AS16509", "AS9829"],
        "ips_per_device": 3,
        "daily_events": (80, 150),
        "txn_amount_range": (500, 50000),
        "txn_amount_mean": 5000,
        "txn_amount_std": 8000,
        "api_endpoints": ["/api/subscriptions", "/api/billing", "/api/webhooks", "/api/users", "/api/keys"],
        "sensitive_action_prob": 0.02,
        "session_duration_hours": (2, 12),
    },
    MerchantType.FASHION: {
        "name_prefix": "TrendVault",
        "country": "IN",
        "peak_hours": [10, 11, 14, 15, 16, 19, 20, 21, 22],
        "devices": 4,
        "countries": ["IN", "AE"],
        "asns": ["AS9829", "AS55836", "AS15169"],
        "ips_per_device": 2,
        "daily_events": (50, 120),
        "txn_amount_range": (200, 15000),
        "txn_amount_mean": 1800,
        "txn_amount_std": 2500,
        "api_endpoints": ["/api/orders", "/api/payments", "/api/inventory", "/api/returns"],
        "sensitive_action_prob": 0.015,
        "session_duration_hours": (1, 6),
    },
    MerchantType.DIGITAL_SERVICES: {
        "name_prefix": "PixelForge",
        "country": "IN",
        "peak_hours": list(range(6, 24)),  # Nearly round the clock
        "devices": 6,
        "countries": ["IN", "US", "SG", "DE"],
        "asns": ["AS13335", "AS16509", "AS14618", "AS9829"],
        "ips_per_device": 3,
        "daily_events": (100, 200),
        "txn_amount_range": (100, 25000),
        "txn_amount_mean": 3000,
        "txn_amount_std": 5000,
        "api_endpoints": ["/api/payments", "/api/payouts", "/api/reports", "/api/webhooks", "/api/config"],
        "sensitive_action_prob": 0.025,
        "session_duration_hours": (1, 8),
    },
}


# ──────────────────────────────────────────────
# Merchant Generator
# ──────────────────────────────────────────────

def generate_merchants() -> list[Merchant]:
    """Generate one merchant per archetype."""
    merchants = []
    for i, (mtype, arch) in enumerate(ARCHETYPES.items()):
        m = Merchant(
            merchant_id=f"MER_{mtype.value.lower()}_{i+1:03d}",
            merchant_name=f"{arch['name_prefix']} {_rng.choice(['Alpha', 'Prime', 'Elite', 'Core'])}",
            merchant_type=mtype,
            country=arch["country"],
            created_at=datetime(2026, 1, 1) + timedelta(days=_rng.randint(0, 180)),
            profile_metadata={
                "archetype": mtype.value,
                "peak_hours": arch["peak_hours"],
                "known_device_count": arch["devices"],
                "known_countries": arch["countries"],
            },
        )
        merchants.append(m)
    return merchants


# ──────────────────────────────────────────────
# Event Generator
# ──────────────────────────────────────────────

def _generate_devices(merchant_id: str, arch: dict) -> list[str]:
    """Generate deterministic device IDs based on merchant_id so same merchant always gets same devices."""
    mrng = random.Random(hash(merchant_id) + 1000)
    return [f"DEV_{uuid.UUID(int=mrng.getrandbits(128)).hex[:12]}" for _ in range(arch["devices"])]


def _generate_ips(merchant_id: str, arch: dict, devices: list[str]) -> dict[str, list[str]]:
    """Map devices to IPs. Deterministic per merchant."""
    mrng = random.Random(hash(merchant_id) + 2000)
    return {
        dev: [f"{mrng.randint(10,200)}.{mrng.randint(0,255)}.{mrng.randint(0,255)}.{mrng.randint(1,254)}"
              for _ in range(arch["ips_per_device"])]
        for dev in devices
    }


def generate_normal_events(
    merchant: Merchant,
    days: int = 14,
    start_date: Optional[datetime] = None,
) -> list[Event]:
    """Generate realistic normal events for a merchant over `days` days."""
    arch = ARCHETYPES[merchant.merchant_type]
    if start_date is None:
        start_date = datetime(2026, 8, 1, tzinfo=timezone.utc)

    devices = _generate_devices(merchant.merchant_id, arch)
    device_ips = _generate_ips(merchant.merchant_id, arch, devices)
    api_keys = [_uid("KEY_") for _ in range(2)]

    events: list[Event] = []

    for day_offset in range(days):
        current_date = start_date + timedelta(days=day_offset)
        daily_count = _rng.randint(*arch["daily_events"])

        # Weekend adjustment for fashion
        if merchant.merchant_type == MerchantType.FASHION and current_date.weekday() >= 5:
            daily_count = int(daily_count * 1.4)

        for _ in range(daily_count):
            # Pick hour weighted toward peak
            if _rng.random() < 0.75:
                hour = _rng.choice(arch["peak_hours"])
            else:
                hour = _rng.randint(0, 23)

            minute = _rng.randint(0, 59)
            second = _rng.randint(0, 59)
            ts = current_date.replace(hour=hour, minute=minute, second=second)

            device = _rng.choice(devices)
            ip = _rng.choice(device_ips[device])
            country = _rng.choice(arch["countries"])
            asn = _rng.choice(arch["asns"])
            session = _uid("SES_")

            # Choose event type with realistic distribution
            event_type = _pick_normal_event_type(arch)
            event = _build_event(
                merchant_id=merchant.merchant_id,
                timestamp=ts,
                event_type=event_type,
                device_id=device,
                session_id=session,
                ip_address=ip,
                country=country,
                asn=asn,
                arch=arch,
                api_keys=api_keys,
            )
            events.append(event)

    events.sort(key=lambda e: e.timestamp)
    return events


def _pick_normal_event_type(arch: dict) -> EventType:
    """Weighted random event type for normal behavior."""
    weights = {
        EventType.LOGIN: 8,
        EventType.LOGOUT: 5,
        EventType.API_REQUEST: 25,
        EventType.DEVICE_SEEN: 5,
        EventType.TRANSACTION: 30,
        EventType.TRANSACTION_RESULT: 20,
        EventType.CONFIG_CHANGE: 1,
        EventType.PAYOUT_EVENT: 2,
        EventType.ACCOUNT_ACTION: 1,
    }
    types = list(weights.keys())
    w = [weights[t] for t in types]
    return _rng.choices(types, weights=w, k=1)[0]


def _build_event(
    merchant_id: str,
    timestamp: datetime,
    event_type: EventType,
    device_id: str,
    session_id: str,
    ip_address: str,
    country: str,
    asn: str,
    arch: dict,
    api_keys: list[str],
) -> Event:
    """Build a single event with appropriate fields based on event type."""
    event_id = _uid("EVT_")

    # Transaction-specific fields
    amount = None
    currency = None
    payment_method = None
    transaction_id = None
    if event_type in (EventType.TRANSACTION, EventType.TRANSACTION_RESULT):
        amount = max(
            arch["txn_amount_range"][0],
            min(
                arch["txn_amount_range"][1],
                _rng.gauss(arch["txn_amount_mean"], arch["txn_amount_std"]),
            ),
        )
        amount = round(amount, 2)
        currency = "INR"
        payment_method = _rng.choice(["card", "upi", "netbanking", "wallet"])
        transaction_id = _uid("TXN_")

    # API-specific fields
    endpoint = None
    api_key_id = None
    if event_type == EventType.API_REQUEST:
        endpoint = _rng.choice(arch["api_endpoints"])
        api_key_id = _rng.choice(api_keys)

    # Action fields for config/account events
    action = None
    resource = None
    if event_type == EventType.CONFIG_CHANGE:
        action = _rng.choice(["update_webhook", "update_settings", "view_config"])
        resource = "merchant_config"
    elif event_type == EventType.PAYOUT_EVENT:
        action = _rng.choice(["create_payout", "view_payouts"])
        resource = "payouts"
    elif event_type == EventType.ACCOUNT_ACTION:
        action = _rng.choice(["update_profile", "view_dashboard"])
        resource = "account"

    return Event(
        event_id=event_id,
        merchant_id=merchant_id,
        timestamp=timestamp,
        event_type=event_type,
        device_id=device_id,
        session_id=session_id,
        ip_address=ip_address,
        country=country,
        asn=asn,
        transaction_id=transaction_id,
        amount=amount,
        currency=currency,
        payment_method=payment_method,
        endpoint=endpoint,
        api_key_id=api_key_id,
        action=action,
        resource=resource,
        metadata={"generated": True, "scenario": "normal"},
    )


# ──────────────────────────────────────────────
# ATO Scenario Injection
# ──────────────────────────────────────────────

def inject_ato_credential_theft(
    merchant: Merchant,
    attack_time: Optional[datetime] = None,
) -> tuple[list[Event], ScenarioMetadata]:
    """
    Scenario A: Credential Theft ATO
    New device → unusual location → API burst → sensitive config → transaction spike
    """
    if attack_time is None:
        attack_time = datetime.now(timezone.utc)

    attack_device = _uid("DEV_ATK_")
    attack_ip = f"{_rng.randint(40,80)}.{_rng.randint(100,200)}.{_rng.randint(0,255)}.{_rng.randint(1,254)}"
    attack_session = _uid("SES_ATK_")
    attack_country = "RU"  # Outside normal geography
    attack_asn = "AS44050"

    events = []
    event_ids = []

    # 1. New device login at unusual hour
    e1 = Event(
        event_id=_uid("EVT_ATO_"),
        merchant_id=merchant.merchant_id,
        timestamp=attack_time,
        event_type=EventType.LOGIN,
        device_id=attack_device,
        session_id=attack_session,
        ip_address=attack_ip,
        country=attack_country,
        asn=attack_asn,
        metadata={"generated": True, "scenario": "ato_credential_theft"},
    )
    events.append(e1)
    event_ids.append(e1.event_id)

    # 2. Device seen
    e2 = Event(
        event_id=_uid("EVT_ATO_"),
        merchant_id=merchant.merchant_id,
        timestamp=attack_time + timedelta(seconds=15),
        event_type=EventType.DEVICE_SEEN,
        device_id=attack_device,
        session_id=attack_session,
        ip_address=attack_ip,
        country=attack_country,
        asn=attack_asn,
        metadata={"generated": True, "scenario": "ato_credential_theft"},
    )
    events.append(e2)
    event_ids.append(e2.event_id)

    # 3. API burst — multiple rapid requests
    for i in range(8):
        e = Event(
            event_id=_uid("EVT_ATO_"),
            merchant_id=merchant.merchant_id,
            timestamp=attack_time + timedelta(seconds=30 + i * 5),
            event_type=EventType.API_REQUEST,
            device_id=attack_device,
            session_id=attack_session,
            ip_address=attack_ip,
            country=attack_country,
            asn=attack_asn,
            endpoint=_rng.choice(["/api/config", "/api/keys", "/api/payouts", "/api/settings"]),
            api_key_id=_uid("KEY_ATK_"),
            metadata={"generated": True, "scenario": "ato_credential_theft"},
        )
        events.append(e)
        event_ids.append(e.event_id)

    # 4. Sensitive config change
    e_config = Event(
        event_id=_uid("EVT_ATO_"),
        merchant_id=merchant.merchant_id,
        timestamp=attack_time + timedelta(minutes=2),
        event_type=EventType.CONFIG_CHANGE,
        device_id=attack_device,
        session_id=attack_session,
        ip_address=attack_ip,
        country=attack_country,
        asn=attack_asn,
        action="update_webhook_url",
        resource="webhook_config",
        metadata={"generated": True, "scenario": "ato_credential_theft", "sensitive": True},
    )
    events.append(e_config)
    event_ids.append(e_config.event_id)

    # 5. Payout change
    e_payout = Event(
        event_id=_uid("EVT_ATO_"),
        merchant_id=merchant.merchant_id,
        timestamp=attack_time + timedelta(minutes=3),
        event_type=EventType.PAYOUT_EVENT,
        device_id=attack_device,
        session_id=attack_session,
        ip_address=attack_ip,
        country=attack_country,
        asn=attack_asn,
        action="update_payout_account",
        resource="payout_config",
        metadata={"generated": True, "scenario": "ato_credential_theft", "sensitive": True},
    )
    events.append(e_payout)
    event_ids.append(e_payout.event_id)

    # 6. Abnormal transaction burst
    for i in range(5):
        e_txn = Event(
            event_id=_uid("EVT_ATO_"),
            merchant_id=merchant.merchant_id,
            timestamp=attack_time + timedelta(minutes=4 + i),
            event_type=EventType.TRANSACTION,
            device_id=attack_device,
            session_id=attack_session,
            ip_address=attack_ip,
            country=attack_country,
            asn=attack_asn,
            transaction_id=_uid("TXN_ATK_"),
            amount=round(_rng.uniform(10000, 50000), 2),  # Unusually large
            currency="INR",
            payment_method="card",
            metadata={"generated": True, "scenario": "ato_credential_theft"},
        )
        events.append(e_txn)
        event_ids.append(e_txn.event_id)

    scenario = ScenarioMetadata(
        scenario_id=_uid("SCN_"),
        scenario_type="ATO_CREDENTIAL_THEFT",
        merchant_id=merchant.merchant_id,
        attack_start_time=attack_time,
        attack_end_time=events[-1].timestamp,
        injected_event_ids=event_ids,
        label="attack",
    )

    return events, scenario


def inject_legitimate_spike(
    merchant: Merchant,
    spike_time: Optional[datetime] = None,
) -> tuple[list[Event], ScenarioMetadata]:
    """
    Negative control: Legitimate sale spike.
    High transaction volume but known devices, known geography, normal workflow.
    """
    arch = ARCHETYPES[merchant.merchant_type]
    if spike_time is None:
        spike_time = datetime.now(timezone.utc)

    # Use KNOWN devices and geography (same deterministic devices as normal events)
    devices = _generate_devices(merchant.merchant_id, arch)
    device_ips = _generate_ips(merchant.merchant_id, arch, devices)

    events = []
    event_ids = []

    # Generate high-volume normal-looking transactions
    for i in range(25):
        device = _rng.choice(devices)
        ip = _rng.choice(device_ips[device])
        country = _rng.choice(arch["countries"])
        asn = _rng.choice(arch["asns"])

        e = Event(
            event_id=_uid("EVT_SPIKE_"),
            merchant_id=merchant.merchant_id,
            timestamp=spike_time + timedelta(minutes=i * 2, seconds=_rng.randint(0, 59)),
            event_type=EventType.TRANSACTION,
            device_id=device,
            session_id=_uid("SES_"),
            ip_address=ip,
            country=country,
            asn=asn,
            transaction_id=_uid("TXN_SPIKE_"),
            amount=round(max(50, _rng.gauss(arch["txn_amount_mean"], arch["txn_amount_std"])), 2),
            currency="INR",
            payment_method=_rng.choice(["card", "upi", "netbanking"]),
            metadata={"generated": True, "scenario": "legitimate_spike"},
        )
        events.append(e)
        event_ids.append(e.event_id)

    scenario = ScenarioMetadata(
        scenario_id=_uid("SCN_"),
        scenario_type="LEGITIMATE_SPIKE",
        merchant_id=merchant.merchant_id,
        attack_start_time=spike_time,
        attack_end_time=events[-1].timestamp,
        injected_event_ids=event_ids,
        label="benign",
    )

    return events, scenario
