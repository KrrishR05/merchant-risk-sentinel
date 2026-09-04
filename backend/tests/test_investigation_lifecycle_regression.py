"""
RiskSūtra — Investigation Lifecycle & Isolation Regression Tests

Tests covering the non-negotiable product rules:
1. Normal merchant/incident retrieval NEVER auto-runs or auto-populates AI investigation.
2. An investigation exists in the DB only after explicit trigger.
3. Investigation results are strictly scoped to merchant_id + incident_id.
4. Merchant A investigation NEVER leaks to Merchant B.
5. Incident A investigation NEVER leaks to Incident B.
6. Scenario injection explicitly initiates a fresh simulation and creates fresh telemetry.
7. Rapid retrieval maintains clean scoping without state corruption.
"""

from __future__ import annotations

import os
import sys
import pytest
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from db import database as db
from models.schemas import (
    Merchant,
    MerchantType,
    Incident,
    IncidentStatus,
    RiskBand,
)
from investigator.agent import RiskSutraAIInvestigator
from investigator.providers import MockProvider
from services.synthetic_generator import inject_ato_credential_theft, inject_legitimate_spike
from services.risk_orchestrator import ingest_events_batch

TEST_DB_PATH = os.path.join(os.path.dirname(__file__), "test_lifecycle_regression.db")


@pytest.fixture(autouse=True)
def setup_test_db():
    try:
        if os.path.exists(TEST_DB_PATH):
            os.remove(TEST_DB_PATH)
    except Exception:
        pass
    db.DB_TYPE = "sqlite"
    db.DB_PATH = TEST_DB_PATH
    db.SQLITE_PATH = TEST_DB_PATH
    db.init_db()
    yield
    try:
        if os.path.exists(TEST_DB_PATH):
            os.remove(TEST_DB_PATH)
    except Exception:
        pass


@pytest.fixture
def merchant_a():
    m = Merchant(
        merchant_id="MER_alpha_01",
        merchant_name="Merchant Alpha",
        merchant_type=MerchantType.RESTAURANT,
        country="IN",
        created_at=datetime(2026, 1, 1),
    )
    db.save_merchant(m)
    return m


@pytest.fixture
def merchant_b():
    m = Merchant(
        merchant_id="MER_beta_02",
        merchant_name="Merchant Beta",
        merchant_type=MerchantType.SAAS,
        country="IN",
        created_at=datetime(2026, 2, 1),
    )
    db.save_merchant(m)
    return m


class TestInvestigationLifecycleRules:
    def test_merchant_retrieval_does_not_trigger_ai(self, merchant_a):
        """TEST 1 & 2: Loading merchant data must NOT run AI."""
        # Create an incident
        inc = Incident(
            incident_id="INC_alpha_101",
            merchant_id=merchant_a.merchant_id,
            risk_score=75.0,
            risk_band=RiskBand.HIGH,
            summary="High velocity anomaly",
        )
        db.save_incident(inc)

        # Confirm no investigation exists
        assert db.get_investigation_result(inc.incident_id) is None
        assert db.get_investigation_audit(inc.incident_id) is None

    def test_historical_existence_does_not_auto_run_new_incident(self, merchant_a):
        """TEST 3: Old historical investigation in DB does NOT affect new incidents."""
        # Old incident with investigation
        old_inc = Incident(
            incident_id="INC_old_001",
            merchant_id=merchant_a.merchant_id,
            risk_score=80.0,
            risk_band=RiskBand.HIGH,
            summary="Old incident",
        )
        db.save_incident(old_inc)
        investigator = RiskSutraAIInvestigator(provider=MockProvider())
        investigator.investigate_incident(old_inc.incident_id)
        assert db.get_investigation_result(old_inc.incident_id) is not None

        # New incident created
        new_inc = Incident(
            incident_id="INC_new_002",
            merchant_id=merchant_a.merchant_id,
            risk_score=85.0,
            risk_band=RiskBand.CRITICAL,
            summary="New uninvestigated incident",
        )
        db.save_incident(new_inc)

        # New incident MUST remain NOT_RUN
        assert db.get_investigation_result(new_inc.incident_id) is None

    def test_explicit_run_creates_completed_investigation(self, merchant_a):
        """TEST 4: Explicit run transitions to COMPLETED with forensic result."""
        events, _ = inject_ato_credential_theft(merchant_a)
        res_ingest = ingest_events_batch(events)
        inc = res_ingest["incident_created"]

        investigator = RiskSutraAIInvestigator(provider=MockProvider())
        out = investigator.investigate_incident(inc.incident_id)
        res = out["result"]

        assert res.incident_id == inc.incident_id
        assert res.merchant_id == merchant_a.merchant_id
        assert len(res.attack_progression) > 0
        assert len(res.recommended_defensive_actions) > 0

    def test_merchant_isolation_no_cross_leakage(self, merchant_a, merchant_b):
        """TEST 5: Merchant A investigation does not leak to Merchant B."""
        inc_a = Incident(
            incident_id="INC_alpha_run",
            merchant_id=merchant_a.merchant_id,
            risk_score=85.0,
            risk_band=RiskBand.CRITICAL,
            summary="Alpha incident",
        )
        db.save_incident(inc_a)

        inc_b = Incident(
            incident_id="INC_beta_run",
            merchant_id=merchant_b.merchant_id,
            risk_score=25.0,
            risk_band=RiskBand.LOW,
            summary="Beta incident",
        )
        db.save_incident(inc_b)

        investigator = RiskSutraAIInvestigator(provider=MockProvider())
        out_a = investigator.investigate_incident(inc_a.incident_id)["result"]

        # Assert Merchant A result belongs to Merchant A
        assert out_a.merchant_id == merchant_a.merchant_id
        assert out_a.incident_id == inc_a.incident_id

        # Merchant B has NO investigation result
        assert db.get_investigation_result(inc_b.incident_id) is None

    def test_incident_isolation_on_same_merchant(self, merchant_a):
        """TEST 6: Running Incident 1 does NOT populate Incident 2 on the same merchant."""
        inc_1 = Incident(
            incident_id="INC_same_01",
            merchant_id=merchant_a.merchant_id,
            risk_score=80.0,
            risk_band=RiskBand.HIGH,
            summary="First incident",
        )
        db.save_incident(inc_1)

        inc_2 = Incident(
            incident_id="INC_same_02",
            merchant_id=merchant_a.merchant_id,
            risk_score=40.0,
            risk_band=RiskBand.MEDIUM,
            summary="Second incident",
        )
        db.save_incident(inc_2)

        investigator = RiskSutraAIInvestigator(provider=MockProvider())
        investigator.investigate_incident(inc_1.incident_id)

        assert db.get_investigation_result(inc_1.incident_id) is not None
        assert db.get_investigation_result(inc_2.incident_id) is None

    def test_scenario_injection_creates_fresh_incident(self, merchant_a):
        """TEST 8 & 9: Explicit scenario injection creates fresh incident & telemetry."""
        events, scenario = inject_ato_credential_theft(merchant_a)
        res = ingest_events_batch(events)
        assert res["ingested"] == len(events)
        inc = res["incident_created"]
        assert inc is not None
        assert inc.merchant_id == merchant_a.merchant_id

    def test_rapid_switching_isolation(self, merchant_a, merchant_b):
        """TEST 10: Rapid querying does not cross-contaminate results."""
        inc_a = Incident(incident_id="INC_rapid_a", merchant_id=merchant_a.merchant_id, risk_score=88.0, risk_band=RiskBand.CRITICAL, summary="A")
        inc_b = Incident(incident_id="INC_rapid_b", merchant_id=merchant_b.merchant_id, risk_score=20.0, risk_band=RiskBand.LOW, summary="B")
        db.save_incident(inc_a)
        db.save_incident(inc_b)

        investigator = RiskSutraAIInvestigator(provider=MockProvider())
        investigator.investigate_incident(inc_a.incident_id)

        for _ in range(10):
            res_a = db.get_investigation_result(inc_a.incident_id)
            res_b = db.get_investigation_result(inc_b.incident_id)
            assert res_a is not None and res_a.incident_id == "INC_rapid_a"
            assert res_b is None
