"""
RiskSūtra — Comprehensive Day 2 Test Suite

Tests for:
1. Schema validation (Day 2 extended models)
2. Event ingestion & deduplication
3. Merchant Behavioral Genome calculation
4. Interpretable risk signals with reason metadata
5. Temporal Workflow Integrity Engine
6. Fraud Spike Detector (Benign vs Suspicious volume)
7. Abuse-Ring Graph Sentinel
8. Cross-Signal Risk Fusion Engine
9. Risk Evaluator (Precision, Recall, F1 metrics)
10. Synthetic generator & scenario injection
11. Database persistence
"""

import sys
import os
import pytest
from datetime import datetime, timedelta

# Ensure backend modules are importable
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from models.schemas import (
    Event, EventType, Incident, IncidentStatus, Merchant, MerchantProfile,
    MerchantType, RiskAssessment, RiskBand, RiskSignal, Severity,
)
from risk.baseline_engine import build_merchant_profile, compute_deviation_signals
from risk.workflow_engine import WorkflowIntegrityEngine
from risk.fraud_spike_detector import FraudSpikeDetector
from graph.abuse_sentinel import GraphService
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
from ml.evaluation.evaluator import RiskEvaluator
from db import database as db

TEST_DB_PATH = os.path.join(os.path.dirname(__file__), "test_risksutra.db")


@pytest.fixture(autouse=True)
def setup_test_db():
    """Use a separate test database, freshly created for each test."""
    if os.path.exists(TEST_DB_PATH):
        os.remove(TEST_DB_PATH)
    db.DB_TYPE = "sqlite"
    db.DB_PATH = TEST_DB_PATH
    db.SQLITE_PATH = TEST_DB_PATH
    db.init_db()
    yield
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

    def test_risk_signal_reason_fields(self):
        signal = RiskSignal(
            signal_id="SIG_test_001",
            merchant_id="MER_test_001",
            signal_type="NEW_DEVICE",
            value=0.75,
            severity=Severity.HIGH,
            reason="Observed 1 unseen device",
            baseline_value="3 known devices",
            observed_value="1 new device",
        )
        assert signal.reason == "Observed 1 unseen device"
        assert 0 <= signal.value <= 1


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


# ──────────────────────────────────────────────
# 3. Behavioral Genome Engine
# ──────────────────────────────────────────────

class TestBaselineGenomeEngine:
    def test_profile_from_events(self, sample_merchant):
        events = generate_normal_events(sample_merchant, days=7)
        profile = build_merchant_profile(sample_merchant.merchant_id, events)

        assert profile.merchant_id == sample_merchant.merchant_id
        assert profile.total_events > 0
        assert len(profile.known_devices) > 0
        assert len(profile.known_countries) > 0
        assert profile.baseline_window_start is not None

    def test_known_device_not_flagged(self, sample_merchant):
        events = generate_normal_events(sample_merchant, days=7)
        profile = build_merchant_profile(sample_merchant.merchant_id, events)

        test_events = events[-5:]
        signals = compute_deviation_signals(profile, test_events)

        device_signals = [s for s in signals if s.signal_type == "NEW_DEVICE"]
        assert len(device_signals) == 0


# ──────────────────────────────────────────────
# 4. Temporal Workflow Integrity Engine
# ──────────────────────────────────────────────

class TestWorkflowIntegrityEngine:
    def test_ato_attack_chain_detected(self, sample_merchant):
        events = generate_normal_events(sample_merchant, days=7)
        profile = build_merchant_profile(sample_merchant.merchant_id, events)

        ato_events, _ = inject_ato_credential_theft(sample_merchant)
        signals = compute_deviation_signals(profile, ato_events)

        wf_engine = WorkflowIntegrityEngine()
        wf_res = wf_engine.evaluate(profile, ato_events, signals)

        assert wf_res.workflow_score >= 0.50
        assert wf_res.is_suspicious_sequence is True
        assert len(wf_res.matched_patterns) > 0

    def test_legitimate_spike_workflow_remains_low(self, sample_merchant):
        events = generate_normal_events(sample_merchant, days=7)
        profile = build_merchant_profile(sample_merchant.merchant_id, events)

        spike_events, _ = inject_legitimate_spike(sample_merchant)
        signals = compute_deviation_signals(profile, spike_events)

        wf_engine = WorkflowIntegrityEngine()
        wf_res = wf_engine.evaluate(profile, spike_events, signals)

        assert wf_res.workflow_score <= 0.20
        assert wf_res.is_suspicious_sequence is False


# ──────────────────────────────────────────────
# 5. Fraud Spike Detector
# ──────────────────────────────────────────────

class TestFraudSpikeDetector:
    def test_benign_sale_spike_classification(self, sample_merchant):
        events = generate_normal_events(sample_merchant, days=7)
        profile = build_merchant_profile(sample_merchant.merchant_id, events)

        spike_events, _ = inject_legitimate_spike(sample_merchant)
        signals = compute_deviation_signals(profile, spike_events)

        detector = FraudSpikeDetector()
        res = detector.evaluate(profile, spike_events, signals)

        assert res.classification in ("BENIGN_SALE_SPIKE", "NORMAL")
        assert res.spike_score <= 0.30


# ──────────────────────────────────────────────
# 6. Abuse-Ring Graph Sentinel
# ──────────────────────────────────────────────

class TestGraphAbuseSentinel:
    def test_multi_merchant_device_sharing(self):
        graph = GraphService()
        e1 = Event(
            event_id="EVT_g1", merchant_id="MER_01", timestamp=datetime.utcnow(),
            event_type=EventType.LOGIN, device_id="DEV_shared_99", ip_address="10.0.0.1",
        )
        e2 = Event(
            event_id="EVT_g2", merchant_id="MER_02", timestamp=datetime.utcnow(),
            event_type=EventType.LOGIN, device_id="DEV_shared_99", ip_address="10.0.0.1",
        )
        graph.add_event(e1)
        graph.add_event(e2)

        clusters = graph.detect_abuse_clusters()
        assert len(clusters) > 0
        assert clusters[0].shared_devices == 1
        assert "MER_01" in clusters[0].merchants_involved
        assert "MER_02" in clusters[0].merchants_involved


# ──────────────────────────────────────────────
# 7. Risk Evaluator Metrics
# ──────────────────────────────────────────────

class TestRiskEvaluator:
    def test_evaluator_metrics_calculation(self):
        evaluator = RiskEvaluator()
        predictions = [
            {
                "merchant_id": "MER_01", "predicted_label": "attack", "ground_truth_label": "attack",
                "predicted_score": 85.0, "attack_start_time": datetime(2026, 8, 1, 10, 0),
                "detection_time": datetime(2026, 8, 1, 10, 2), "predicted_chain": ["CHAIN_A"], "ground_truth_chain": ["CHAIN_A"],
            },
            {
                "merchant_id": "MER_02", "predicted_label": "benign", "ground_truth_label": "benign",
                "predicted_score": 15.0, "attack_start_time": None, "detection_time": None,
                "predicted_chain": [], "ground_truth_chain": [],
            },
        ]
        metrics = evaluator.evaluate_predictions(predictions)
        assert metrics.precision == 1.0
        assert metrics.recall == 1.0
        assert metrics.f1_score == 1.0
        assert metrics.false_positive_rate == 0.0


# ──────────────────────────────────────────────
# 8. ATO vs Legitimate Spike Fusion Comparison
# ──────────────────────────────────────────────

class TestATODetection:
    def test_ato_scenario_raises_risk(self, sample_merchant):
        events = generate_normal_events(sample_merchant, days=7)
        profile = build_merchant_profile(sample_merchant.merchant_id, events)

        ato_events, _ = inject_ato_credential_theft(sample_merchant)
        signals = compute_deviation_signals(profile, ato_events)

        wf_res = WorkflowIntegrityEngine().evaluate(profile, ato_events, signals)
        fs_res = FraudSpikeDetector().evaluate(profile, ato_events, signals)

        assessment = compute_risk_assessment(sample_merchant.merchant_id, signals, workflow_result=wf_res, fraud_spike=fs_res)

        assert assessment.risk_score >= 56.0
        assert assessment.risk_band in (RiskBand.HIGH, RiskBand.CRITICAL)
        assert should_create_incident(assessment) is True


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
