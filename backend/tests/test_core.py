"""
RiskSūtra — Automated Tests

Tests for:
1. Schema validation
2. Event ingestion
3. Baseline calculation
4. Risk calculation
5. Legitimate anomaly handling
6. ATO scenario injection
7. API endpoints
"""

import sys
import os
import pytest

# Ensure backend modules are importable
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from datetime import datetime, timedelta

from models.schemas import (
    Event, EventType, Incident, IncidentStatus, Merchant, MerchantProfile,
    MerchantType, RiskAssessment, RiskBand, RiskSignal, Severity,
)
from risk.baseline_engine import build_merchant_profile, compute_deviation_signals
from risk.fusion_engine import (
    compute_risk_assessment,
    create_incident_from_assessment,
    should_create_incident,
)
from services.synthetic_generator import (
    generate_merchants,
    generate_normal_events,
    inject_ato_credential_theft,
    inject_legitimate_spike,
)
from db import database as db


# ──────────────────────────────────────────────
# Test Fixtures
# ──────────────────────────────────────────────

TEST_DB_PATH = os.path.join(os.path.dirname(__file__), "test_risksutra.db")


@pytest.fixture(autouse=True)
def setup_test_db():
    """Use a separate test database, freshly created for each test."""
    # Clean up any leftover DB from previous test
    if os.path.exists(TEST_DB_PATH):
        os.remove(TEST_DB_PATH)
    db.DB_TYPE = "sqlite"
    db.DB_PATH = TEST_DB_PATH
    db.SQLITE_PATH = TEST_DB_PATH
    db.init_db()
    yield
    # Cleanup
    if os.path.exists(TEST_DB_PATH):
        os.remove(TEST_DB_PATH)


@pytest.fixture
def sample_merchant():
    return Merchant(
        merchant_id="MER_test_001",
        merchant_name="Test Restaurant Alpha",
        merchant_type=MerchantType.RESTAURANT,
        country="IN",
        created_at=datetime(2026, 1, 15),
    )


@pytest.fixture
def sample_event(sample_merchant):
    return Event(
        event_id="EVT_test_001",
        merchant_id=sample_merchant.merchant_id,
        timestamp=datetime(2026, 8, 15, 14, 30, 0),
        event_type=EventType.TRANSACTION,
        device_id="DEV_known_001",
        ip_address="192.168.1.1",
        country="IN",
        asn="AS9829",
        amount=500.0,
        currency="INR",
        payment_method="upi",
    )


# ──────────────────────────────────────────────
# 1. Schema Validation
# ──────────────────────────────────────────────

class TestSchemaValidation:
    def test_merchant_creation(self, sample_merchant):
        assert sample_merchant.merchant_id == "MER_test_001"
        assert sample_merchant.merchant_type == MerchantType.RESTAURANT

    def test_event_creation(self, sample_event):
        assert sample_event.event_type == EventType.TRANSACTION
        assert sample_event.amount == 500.0

    def test_event_optional_fields(self):
        """Missing optional fields should not crash."""
        event = Event(
            event_id="EVT_min_001",
            merchant_id="MER_test_001",
            timestamp=datetime.utcnow(),
            event_type=EventType.LOGIN,
        )
        assert event.device_id is None
        assert event.amount is None
        assert event.metadata == {}

    def test_risk_signal_bounds(self):
        """Signal value must be 0-1."""
        signal = RiskSignal(
            signal_id="SIG_test_001",
            merchant_id="MER_test_001",
            signal_type="NEW_DEVICE",
            value=0.75,
            severity=Severity.HIGH,
        )
        assert 0 <= signal.value <= 1

    def test_risk_signal_invalid_value(self):
        """Signal value outside 0-1 should fail validation."""
        with pytest.raises(Exception):
            RiskSignal(
                signal_id="SIG_bad",
                merchant_id="MER_test_001",
                signal_type="NEW_DEVICE",
                value=1.5,  # Invalid
                severity=Severity.HIGH,
            )


# ──────────────────────────────────────────────
# 2. Event Ingestion
# ──────────────────────────────────────────────

class TestEventIngestion:
    def test_save_and_retrieve_event(self, sample_merchant, sample_event):
        db.save_merchant(sample_merchant)
        assert db.save_event(sample_event) is True

        events = db.get_merchant_events(sample_merchant.merchant_id)
        assert len(events) == 1
        assert events[0].event_id == sample_event.event_id

    def test_duplicate_event_deduplication(self, sample_merchant, sample_event):
        db.save_merchant(sample_merchant)
        assert db.save_event(sample_event) is True
        assert db.save_event(sample_event) is False  # Duplicate

        events = db.get_merchant_events(sample_merchant.merchant_id)
        assert len(events) == 1  # Only one stored

    def test_bulk_insert(self, sample_merchant):
        db.save_merchant(sample_merchant)
        events = [
            Event(
                event_id=f"EVT_bulk_{i}",
                merchant_id=sample_merchant.merchant_id,
                timestamp=datetime(2026, 8, 15, 10 + i, 0, 0),
                event_type=EventType.TRANSACTION,
                amount=100.0 * (i + 1),
                currency="INR",
            )
            for i in range(5)
        ]
        inserted = db.save_events_bulk(events)
        assert inserted == 5


# ──────────────────────────────────────────────
# 3. Baseline Calculation
# ──────────────────────────────────────────────

class TestBaselineEngine:
    def test_profile_from_events(self, sample_merchant):
        events = generate_normal_events(sample_merchant, days=7)
        profile = build_merchant_profile(sample_merchant.merchant_id, events)

        assert profile.merchant_id == sample_merchant.merchant_id
        assert profile.total_events > 0
        assert len(profile.known_devices) > 0
        assert len(profile.known_countries) > 0
        assert profile.baseline_window_start is not None

    def test_empty_events_profile(self):
        profile = build_merchant_profile("MER_empty", [])
        assert profile.total_events == 0
        assert len(profile.known_devices) == 0

    def test_known_device_not_flagged(self, sample_merchant):
        """Normal merchant events should not produce device novelty signals."""
        events = generate_normal_events(sample_merchant, days=7)
        profile = build_merchant_profile(sample_merchant.merchant_id, events)

        # Use a subset of the SAME events — known devices
        test_events = events[-5:]
        signals = compute_deviation_signals(profile, test_events)

        # No NEW_DEVICE signal because all devices are known
        device_signals = [s for s in signals if s.signal_type == "NEW_DEVICE"]
        assert len(device_signals) == 0


# ──────────────────────────────────────────────
# 4. Risk Calculation
# ──────────────────────────────────────────────

class TestRiskEngine:
    def test_no_signals_low_risk(self):
        """No signals should produce LOW risk."""
        assessment = compute_risk_assessment("MER_test_001", [])
        assert assessment.risk_band == RiskBand.LOW
        assert assessment.risk_score == 0.0

    def test_high_signals_produce_incident(self):
        """Multiple high-severity signals should create an incident."""
        signals = [
            RiskSignal(signal_id="SIG_1", merchant_id="MER_test_001",
                       signal_type="NEW_DEVICE", value=0.9, severity=Severity.CRITICAL),
            RiskSignal(signal_id="SIG_2", merchant_id="MER_test_001",
                       signal_type="NEW_COUNTRY", value=0.7, severity=Severity.HIGH),
            RiskSignal(signal_id="SIG_3", merchant_id="MER_test_001",
                       signal_type="API_RATE_SPIKE", value=0.8, severity=Severity.CRITICAL),
            RiskSignal(signal_id="SIG_4", merchant_id="MER_test_001",
                       signal_type="SENSITIVE_ACTION_SPIKE", value=0.7, severity=Severity.HIGH),
            RiskSignal(signal_id="SIG_5", merchant_id="MER_test_001",
                       signal_type="TXN_RATE_SPIKE", value=0.75, severity=Severity.HIGH),
            RiskSignal(signal_id="SIG_6", merchant_id="MER_test_001",
                       signal_type="HOUR_DEVIATION", value=0.65, severity=Severity.HIGH),
        ]
        assessment = compute_risk_assessment("MER_test_001", signals)
        assert assessment.risk_score > 55  # Should be HIGH or CRITICAL
        assert should_create_incident(assessment) is True

    def test_incident_creation(self):
        signals = [
            RiskSignal(signal_id="SIG_inc", merchant_id="MER_test_001",
                       signal_type="NEW_DEVICE", value=0.9, severity=Severity.CRITICAL),
        ]
        assessment = compute_risk_assessment("MER_test_001", signals)
        if should_create_incident(assessment):
            incident = create_incident_from_assessment(assessment)
            assert incident.incident_id.startswith("INC_")
            assert incident.merchant_id == "MER_test_001"


# ──────────────────────────────────────────────
# 5. Normal Merchant Does Not Become High Risk
# ──────────────────────────────────────────────

class TestNormalBehavior:
    def test_normal_merchant_stays_low_risk(self):
        """Critical test: normal merchant behavior should not auto-flag as ATO."""
        merchants = generate_merchants()
        merchant = merchants[0]

        # Generate normal history
        history = generate_normal_events(merchant, days=14)
        profile = build_merchant_profile(merchant.merchant_id, history)

        # Test with more normal events (from same distributions)
        test_events = generate_normal_events(merchant, days=1)
        signals = compute_deviation_signals(profile, test_events)
        assessment = compute_risk_assessment(merchant.merchant_id, signals)

        # Normal behavior should NOT create an incident
        assert assessment.risk_band in (RiskBand.LOW, RiskBand.MEDIUM)
        assert not should_create_incident(assessment)


# ──────────────────────────────────────────────
# 6. ATO Scenario Raises Risk
# ──────────────────────────────────────────────

class TestATODetection:
    def test_ato_scenario_increases_risk(self):
        """ATO injection must cause risk score to increase."""
        merchants = generate_merchants()
        merchant = merchants[0]

        # Build baseline from normal history
        history = generate_normal_events(merchant, days=14)
        profile = build_merchant_profile(merchant.merchant_id, history)

        # Inject ATO
        ato_events, scenario = inject_ato_credential_theft(merchant)
        assert scenario.scenario_type == "ATO_CREDENTIAL_THEFT"
        assert len(ato_events) > 5

        # Evaluate ATO events against baseline
        signals = compute_deviation_signals(profile, ato_events)
        assessment = compute_risk_assessment(merchant.merchant_id, signals)

        # ATO should produce elevated risk
        assert assessment.risk_score > 30
        assert len(assessment.top_signals) > 0

    def test_ato_produces_new_device_signal(self):
        merchants = generate_merchants()
        merchant = merchants[0]

        history = generate_normal_events(merchant, days=14)
        profile = build_merchant_profile(merchant.merchant_id, history)

        ato_events, _ = inject_ato_credential_theft(merchant)
        signals = compute_deviation_signals(profile, ato_events)

        device_signals = [s for s in signals if s.signal_type == "NEW_DEVICE"]
        assert len(device_signals) > 0


# ──────────────────────────────────────────────
# 7. Legitimate Spike Does Not Trigger ATO
# ──────────────────────────────────────────────

class TestLegitimateSpike:
    def test_legitimate_spike_lower_risk_than_ato(self):
        """Legitimate spike should produce lower risk than ATO."""
        merchants = generate_merchants()
        merchant = merchants[1]

        history = generate_normal_events(merchant, days=14)
        profile = build_merchant_profile(merchant.merchant_id, history)

        # ATO risk
        ato_events, _ = inject_ato_credential_theft(merchant)
        ato_signals = compute_deviation_signals(profile, ato_events)
        ato_assessment = compute_risk_assessment(merchant.merchant_id, ato_signals)

        # Legitimate spike risk
        spike_events, _ = inject_legitimate_spike(merchant)
        spike_signals = compute_deviation_signals(profile, spike_events)
        spike_assessment = compute_risk_assessment(merchant.merchant_id, spike_signals)

        # Legitimate spike should produce LOWER risk than ATO
        assert spike_assessment.risk_score < ato_assessment.risk_score


# ──────────────────────────────────────────────
# 8. Database Persistence
# ──────────────────────────────────────────────

class TestDatabasePersistence:
    def test_merchant_roundtrip(self, sample_merchant):
        db.save_merchant(sample_merchant)
        retrieved = db.get_merchant(sample_merchant.merchant_id)
        assert retrieved is not None
        assert retrieved.merchant_id == sample_merchant.merchant_id
        assert retrieved.merchant_type == sample_merchant.merchant_type

    def test_incident_persistence(self, sample_merchant):
        db.save_merchant(sample_merchant)
        incident = Incident(
            incident_id="INC_test_001",
            merchant_id=sample_merchant.merchant_id,
            risk_score=85.0,
            risk_band=RiskBand.CRITICAL,
        )
        db.save_incident(incident)
        retrieved = db.get_incident("INC_test_001")
        assert retrieved is not None
        assert retrieved.risk_score == 85.0

    def test_nonexistent_merchant(self):
        result = db.get_merchant("MER_nonexistent")
        assert result is None

    def test_nonexistent_incident(self):
        result = db.get_incident("INC_nonexistent")
        assert result is None


# ──────────────────────────────────────────────
# 9. Synthetic Generator
# ──────────────────────────────────────────────

class TestSyntheticGenerator:
    def test_generates_four_merchants(self):
        merchants = generate_merchants()
        assert len(merchants) == 4
        types = {m.merchant_type for m in merchants}
        assert MerchantType.RESTAURANT in types
        assert MerchantType.SAAS in types
        assert MerchantType.FASHION in types
        assert MerchantType.DIGITAL_SERVICES in types

    def test_normal_events_generated(self):
        merchants = generate_merchants()
        events = generate_normal_events(merchants[0], days=7)
        assert len(events) > 100  # At least 30*7 = 210 for restaurant
        assert all(e.merchant_id == merchants[0].merchant_id for e in events)

    def test_events_sorted_by_timestamp(self):
        merchants = generate_merchants()
        events = generate_normal_events(merchants[0], days=3)
        timestamps = [e.timestamp for e in events]
        assert timestamps == sorted(timestamps)

    def test_ato_scenario_labeled(self):
        merchants = generate_merchants()
        _, scenario = inject_ato_credential_theft(merchants[0])
        assert scenario.label == "attack"
        assert len(scenario.injected_event_ids) > 0

    def test_legitimate_spike_labeled(self):
        merchants = generate_merchants()
        _, scenario = inject_legitimate_spike(merchants[0])
        assert scenario.label == "benign"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
