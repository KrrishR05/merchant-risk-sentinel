"""
RiskSūtra Day 3 — E2E Demo Scenario Validation Script

Executes:
1. Demo Scenario 1: Account Takeover (ATO)
2. Demo Scenario 2: Legitimate Campaign Spike
3. Validates AI Investigator outputs, audit trails, and evidence grounding.
"""

import os
import sys
from datetime import datetime

# Set stdout encoding to UTF-8 for Windows compatibility
sys.stdout.reconfigure(encoding='utf-8')

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from db import database as db
from models.schemas import Merchant, MerchantType, AssessmentVerdict
from services.synthetic_generator import (
    generate_merchants,
    generate_normal_events,
    inject_ato_credential_theft,
    inject_legitimate_spike,
)
from services.risk_orchestrator import ingest_events_batch
from investigator.agent import RiskSutraAIInvestigator
from investigator.providers import MockProvider, get_ai_provider

def run_demo_validation():
    print("=" * 60)
    print("RISK SŪTRA DAY 3 — AI INVESTIGATOR DEMO VALIDATION")
    print("=" * 60)

    # 1. Initialize fresh DB
    db.DB_TYPE = "sqlite"
    db.SQLITE_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "demo_risksutra.db")
    db.DB_PATH = db.SQLITE_PATH
    if os.path.exists(db.SQLITE_PATH):
        os.remove(db.SQLITE_PATH)
    db.init_db()

    # 2. Setup Merchant
    m = Merchant(
        merchant_id="MER_demo_001",
        merchant_name="Zomato Premier Merchant",
        merchant_type=MerchantType.RESTAURANT,
        country="IN",
        created_at=datetime(2026, 1, 1),
    )
    db.save_merchant(m)
    print(f"\n[+] Created Merchant: {m.merchant_name} ({m.merchant_id})")

    # Ingest baseline normal events
    base_events = generate_normal_events(m, days=7)
    db.save_events_bulk(base_events)
    print(f"[+] Ingested {len(base_events)} baseline historical events into Merchant Behavioral Genome")

    # ──────────────────────────────────────────────
    # SCENARIO 1: ACCOUNT TAKEOVER (ATO)
    # ──────────────────────────────────────────────
    print("\n" + "─" * 50)
    print("DEMO SCENARIO 1 — ACCOUNT TAKEOVER (ATO)")
    print("─" * 50)

    ato_events, scenario1 = inject_ato_credential_theft(m)
    res1 = ingest_events_batch(ato_events)

    inc1 = res1["incident_created"]
    assert inc1 is not None, "Scenario 1 should generate an incident!"

    print(f"[*] Ingested {res1['ingested']} ATO attack events")
    print(f"[*] Incident Created: {inc1.incident_id}")
    print(f"[*] Deterministic Risk Score: {inc1.risk_score:.1f} ({inc1.risk_band.value})")

    investigator = RiskSutraAIInvestigator()
    out1 = investigator.investigate_incident(inc1.incident_id)
    inv1 = out1["result"]
    audit1 = out1["audit"]

    print("\n--- AI INVESTIGATOR OUTPUT ---")
    print(f"Verdict: {inv1.assessment.value} (Confidence: {inv1.confidence * 100:.0f}%)")
    print(f"Summary: {inv1.summary}")
    print(f"Why it matters: {inv1.why_this_matters}")
    print(f"Attack Stages Identified: {len(inv1.attack_progression)}")
    for stage in inv1.attack_progression:
        print(f"   ├─ {stage.stage}: {stage.explanation}")
    print(f"Key Evidence Citations: {len(inv1.key_evidence)}")
    for ev in inv1.key_evidence:
        print(f"   ├─ {ev.event_id} ({ev.signal}): {ev.reason}")
    print(f"Defensive Recommendations: {len(inv1.recommended_defensive_actions)}")
    for rec in inv1.recommended_defensive_actions:
        print(f"   ├─ [ACTION] {rec}")
    print(f"Audit Trail: Provider={audit1.provider}, Duration={audit1.duration_ms:.1f}ms, Tools={audit1.tools_called}")

    assert inv1.assessment == AssessmentVerdict.LIKELY_ATO
    assert inv1.confidence >= 0.75

    # ──────────────────────────────────────────────
    # SCENARIO 2: LEGITIMATE CAMPAIGN SPIKE
    # ──────────────────────────────────────────────
    print("\n" + "─" * 50)
    print("DEMO SCENARIO 2 — LEGITIMATE CAMPAIGN SPIKE")
    print("─" * 50)

    m2 = Merchant(
        merchant_id="MER_demo_002",
        merchant_name="Festive Sales Store",
        merchant_type=MerchantType.FASHION,
        country="IN",
        created_at=datetime(2026, 1, 1),
    )
    db.save_merchant(m2)

    base_events2 = generate_normal_events(m2, days=7)
    db.save_events_bulk(base_events2)

    spike_events, scenario2 = inject_legitimate_spike(m2)
    res2 = ingest_events_batch(spike_events)

    inc2 = res2["incident_created"]
    if not inc2:
        merchant_incs = db.get_merchant_incidents(m2.merchant_id)
        inc2 = merchant_incs[0] if merchant_incs else None

    if inc2:
        out2 = investigator.investigate_incident(inc2.incident_id)
        inv2 = out2["result"]
        print(f"[*] Ingested {res2['ingested']} high volume sale events")
        print(f"[*] Deterministic Risk Score: {inc2.risk_score:.1f} ({inc2.risk_band.value})")
        print("\n--- AI INVESTIGATOR OUTPUT ---")
        print(f"Verdict: {inv2.assessment.value} (Confidence: {inv2.confidence * 100:.0f}%)")
        print(f"Summary: {inv2.summary}")
        print("Legitimate Hypotheses Evaluated:")
        for leg in inv2.legitimate_explanations_considered:
            print(f"   ├─ {leg.hypothesis} -> STATUS: {leg.status.value}")
        assert inv2.assessment != AssessmentVerdict.LIKELY_ATO, "Legitimate spike should NOT be classified as ATO!"
    else:
        print("[*] Legitimate spike correctly absorbed by FraudSpikeDetector without triggering ATO incident.")

    print("\n" + "=" * 60)
    print("ALL DAY 3 DEMO SCENARIOS PASSED SUCCESSFULLY!")
    print("=" * 60)

if __name__ == "__main__":
    run_demo_validation()
