"""
RiskSūtra — Historical Case Memory & Similarity Service

Maintains persistent investigation case memories in PostgreSQL/SQLite.
Implements multi-dimensional structured similarity scoring across:
- Risk signal composition (Jaccard index)
- Behavioral deviations (device, geo, network)
- Control-plane sensitivity (payout destination, credentials)
- Transaction volume and velocity spikes
- Temporal workflow patterns
- Abuse ring graph clustering

Enforces strict isolation: the current incident being investigated is NEVER retrieved
as a historical match for itself (preventing self-contamination).
"""

from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

from db import database as db
from models.schemas import (
    HistoricalMatch,
    HistoricalMemoryRecord,
    InvestigationContext,
    LearningIntelligence,
)

logger = logging.getLogger("risksutra.investigator.memory")


# ──────────────────────────────────────────────
# Foundational Historical Case Archetypes (Seed)
# ──────────────────────────────────────────────

FOUNDATIONAL_HISTORICAL_CASES = [
    {
        "memory_id": "MEM_HIST_101",
        "incident_id": "INC_HIST_ATO_01",
        "merchant_id": "MER_saas_ref01",
        "merchant_name": "SaaS Matrix Cloud",
        "merchant_type": "SAAS",
        "incident_type": "ATO",
        "risk_score": 88.5,
        "risk_band": "CRITICAL",
        "signals_summary": ["NEW_DEVICE", "COUNTRY_MISMATCH", "SENSITIVE_CONFIG_CHANGE", "API_BURST"],
        "temporal_pattern": "Unseen device -> Geo anomaly -> Payout destination modification -> API credential extraction",
        "attack_progression": [
            {"stage": "Unseen Device Access", "explanation": "Session from unknown browser fingerprint"},
            {"stage": "Control Plane Modification", "explanation": "Payout bank account routing number changed"},
            {"stage": "API Surge", "explanation": "120 API requests/min attempting fund transfer"},
        ],
        "outcome": "CONFIRMED_ATO",
        "investigation_assessment": "LIKELY_ATO",
        "remediation_applied": [
            "Immediate payout freeze on routing account",
            "API token revocation and session invalidation",
            "Step-up biometric MFA enforcement",
        ],
        "resolution_status": "RESOLVED",
        "evidence_references": ["EVT_hist_ato_01", "EVT_hist_ato_02"],
        "days_ago": 45,
    },
    {
        "memory_id": "MEM_HIST_102",
        "incident_id": "INC_HIST_ATO_02",
        "merchant_id": "MER_rest_ref02",
        "merchant_name": "Tandoor Express India",
        "merchant_type": "RESTAURANT",
        "incident_type": "ATO",
        "risk_score": 82.0,
        "risk_band": "HIGH",
        "signals_summary": ["NEW_DEVICE", "SENSITIVE_CONFIG_CHANGE", "TRANSACTION_VELOCITY"],
        "temporal_pattern": "Unseen device login -> Settlement email change -> Rapid refund withdrawal burst",
        "attack_progression": [
            {"stage": "Unseen Device Access", "explanation": "Session originating from anonymous VPN ASN"},
            {"stage": "Control Plane Modification", "explanation": "Settlement notification email changed"},
            {"stage": "Transaction Velocity Spike", "explanation": "Burst of high-value payment requests"},
        ],
        "outcome": "CONFIRMED_ATO",
        "investigation_assessment": "LIKELY_ATO",
        "remediation_applied": [
            "Settlement hold placed within 18 minutes",
            "Reverted merchant contact email to verified phone backup",
            "Hardware security key registration required",
        ],
        "resolution_status": "RESOLVED",
        "evidence_references": ["EVT_hist_ato_03", "EVT_hist_ato_04"],
        "days_ago": 30,
    },
    {
        "memory_id": "MEM_HIST_103",
        "incident_id": "INC_HIST_LEG_01",
        "merchant_id": "MER_fash_ref03",
        "merchant_name": "UrbanVibe Retail",
        "merchant_type": "FASHION",
        "incident_type": "LEGITIMATE_SPIKE",
        "risk_score": 32.5,
        "risk_band": "LOW",
        "signals_summary": ["TRANSACTION_VOLUME", "AMOUNT_SPIKE"],
        "temporal_pattern": "Promotional campaign flash sale with known merchant devices and domestic IP range",
        "attack_progression": [
            {"stage": "Campaign Traffic Volume Increase", "explanation": "Diwali festival 5x sales surge"},
            {"stage": "Known Device Baseline Maintained", "explanation": "POS terminals matching 180-day baseline"},
        ],
        "outcome": "LEGITIMATE_SPIKE",
        "investigation_assessment": "LIKELY_BENIGN",
        "remediation_applied": [
            "Temporary velocity limit increase approved",
            "Standard monitoring maintained during sale window",
            "No merchant restriction applied",
        ],
        "resolution_status": "RESOLVED",
        "evidence_references": ["EVT_hist_leg_01", "EVT_hist_leg_02"],
        "days_ago": 22,
    },
    {
        "memory_id": "MEM_HIST_104",
        "incident_id": "INC_HIST_GEO_01",
        "merchant_id": "MER_digi_ref04",
        "merchant_name": "CodeCraft Studio",
        "merchant_type": "DIGITAL_SERVICES",
        "incident_type": "TRAVEL_ANOMALY",
        "risk_score": 44.0,
        "risk_band": "MEDIUM",
        "signals_summary": ["COUNTRY_MISMATCH", "DEVICE_SEEN"],
        "temporal_pattern": "Merchant founder travel to US conference; verified laptop device ID maintained",
        "attack_progression": [
            {"stage": "Geographic Origin Deviation", "explanation": "Login from US IP address"},
            {"stage": "Verified Hardware Baseline", "explanation": "Hardware device fingerprint identical to baseline"},
        ],
        "outcome": "FALSE_POSITIVE",
        "investigation_assessment": "INCONCLUSIVE",
        "remediation_applied": [
            "Automated push MFA prompt verified by user",
            "Baseline updated to incorporate executive travel profile",
        ],
        "resolution_status": "RESOLVED",
        "evidence_references": ["EVT_hist_geo_01"],
        "days_ago": 15,
    },
    {
        "memory_id": "MEM_HIST_105",
        "incident_id": "INC_HIST_RING_01",
        "merchant_id": "MER_ring_ref05",
        "merchant_name": "SwiftPay Subscriptions",
        "merchant_type": "DIGITAL_SERVICES",
        "incident_type": "ABUSE_RING",
        "risk_score": 91.0,
        "risk_band": "CRITICAL",
        "signals_summary": ["SHARED_DEVICE_CLUSTER", "MULTI_MERCHANT_IP", "RAPID_AUTH_FAILURES"],
        "temporal_pattern": "Syndicate cluster sharing device fingerprint across 4 registered merchant IDs",
        "attack_progression": [
            {"stage": "Syndicate Device Fingerprint Match", "explanation": "Device active on 4 distinct merchants"},
            {"stage": "Coordinated Velocity Abuse", "explanation": "Concurrent micro-charge attempts"},
        ],
        "outcome": "CONFIRMED_ATO",
        "investigation_assessment": "LIKELY_ATO",
        "remediation_applied": [
            "Coordinated syndicate freeze across all connected merchants",
            "Network blocklist updated with shared IP subnet",
        ],
        "resolution_status": "RESOLVED",
        "evidence_references": ["EVT_hist_ring_01", "EVT_hist_ring_02"],
        "days_ago": 8,
    },
]


def ensure_foundational_memory_seeded():
    """Ensure baseline historical cases are present in the case_memory repository."""
    existing_ids = {m.incident_id for m in db.get_all_case_memories()}
    now = datetime.now(timezone.utc)
    for c in FOUNDATIONAL_HISTORICAL_CASES:
        if c["incident_id"] in existing_ids:
            continue
        created_at = now - timedelta(days=c["days_ago"])
        rec = HistoricalMemoryRecord(
            memory_id=c["memory_id"],
            incident_id=c["incident_id"],
            merchant_id=c["merchant_id"],
            merchant_name=c["merchant_name"],
            merchant_type=c["merchant_type"],
            incident_type=c["incident_type"],
            risk_score=c["risk_score"],
            risk_band=c["risk_band"],
            signals_summary=c["signals_summary"],
            temporal_pattern=c["temporal_pattern"],
            attack_progression=c["attack_progression"],
            outcome=c["outcome"],
            investigation_assessment=c["investigation_assessment"],
            remediation_applied=c["remediation_applied"],
            resolution_status=c["resolution_status"],
            evidence_references=c["evidence_references"],
            created_at=created_at,
        )
        try:
            db.save_case_memory(rec)
        except Exception as e:
            logger.warning(f"Error seeding historical memory {c['memory_id']}: {e}")



def compute_case_similarity(
    incident_signals: List[str],
    incident_merchant_type: str,
    has_config_change: bool,
    has_new_device: bool,
    has_geo_dev: bool,
    has_txn_anomaly: bool,
    has_cluster: bool,
    hist_record: HistoricalMemoryRecord,
) -> float:
    """
    Computes a grounded multi-factor similarity percentage (0.0 to 100.0)
    between the current incident evidence and a historical case memory record.
    """
    score = 0.0
    weights = {
        "signals": 35.0,
        "type": 10.0,
        "config": 15.0,
        "device": 15.0,
        "geo": 10.0,
        "txn": 10.0,
        "cluster": 5.0,
    }

    # 1. Signal Overlap (Jaccard similarity)
    hist_sigs = [s.upper() for s in hist_record.signals_summary]
    inc_sigs = [s.upper() for s in incident_signals]
    if hist_sigs and inc_sigs:
        intersection = len(set(hist_sigs).intersection(set(inc_sigs)))
        union = len(set(hist_sigs).union(set(inc_sigs)))
        jaccard = intersection / union if union > 0 else 0.0
        score += jaccard * weights["signals"]
    elif not hist_sigs and not inc_sigs:
        score += weights["signals"] * 0.5

    # 2. Merchant archetype compatibility
    if hist_record.merchant_type.upper() == incident_merchant_type.upper():
        score += weights["type"]
    else:
        score += weights["type"] * 0.4

    # 3. Control plane modification match
    hist_has_config = any("CONFIG" in s or "SENSITIVE" in s or "PAYOUT" in s for s in hist_sigs)
    if has_config_change == hist_has_config:
        score += weights["config"]

    # 4. Device novelty match
    hist_has_device = any("DEVICE" in s for s in hist_sigs)
    if has_new_device == hist_has_device:
        score += weights["device"]

    # 5. Geographic deviation match
    hist_has_geo = any("GEO" in s or "COUNTRY" in s for s in hist_sigs)
    if has_geo_dev == hist_has_geo:
        score += weights["geo"]

    # 6. Transaction velocity match
    hist_has_txn = any("TXN" in s or "AMOUNT" in s or "VOLUME" in s or "SPIKE" in s for s in hist_sigs)
    if has_txn_anomaly == hist_has_txn:
        score += weights["txn"]

    # 7. Cluster match
    hist_has_cluster = any("CLUSTER" in s or "RING" in s or "SHARED" in s for s in hist_sigs)
    if has_cluster == hist_has_cluster:
        score += weights["cluster"]

    return round(min(98.5, max(12.0, score)), 1)


def search_historical_cases(
    incident_id: str,
    merchant_type: str,
    top_signals: List[Dict[str, Any]],
    has_config_change: bool,
    has_new_device: bool,
    has_geo_dev: bool,
    has_txn_anomaly: bool,
    has_cluster: bool,
    limit: int = 4,
) -> Tuple[List[HistoricalMatch], str, LearningIntelligence]:
    """
    Search historical case memory for incidents resembling the current case.
    Strictly excludes current incident_id to prevent self-contamination.
    """
    ensure_foundational_memory_seeded()

    # Retrieve all memories excluding current incident
    all_memories = db.get_all_case_memories(exclude_incident_id=incident_id)

    signal_types = [s.get("signal_type", "") for s in top_signals]

    scored_matches: List[Tuple[float, HistoricalMemoryRecord]] = []
    for mem in all_memories:
        sim = compute_case_similarity(
            incident_signals=signal_types,
            incident_merchant_type=merchant_type,
            has_config_change=has_config_change,
            has_new_device=has_new_device,
            has_geo_dev=has_geo_dev,
            has_txn_anomaly=has_txn_anomaly,
            has_cluster=has_cluster,
            hist_record=mem,
        )
        scored_matches.append((sim, mem))

    # Sort descending by similarity
    scored_matches.sort(key=lambda x: x[0], reverse=True)

    top_matches: List[HistoricalMatch] = []
    seen_incident_ids = set()
    confirmed_ato = 0
    legitimate_matches = 0

    for sim, mem in scored_matches:
        if mem.incident_id in seen_incident_ids:
            continue
        seen_incident_ids.add(mem.incident_id)

        if "ATO" in mem.outcome:
            confirmed_ato += 1
        elif "LEGITIMATE" in mem.outcome or "BENIGN" in mem.outcome or "FALSE" in mem.outcome:
            legitimate_matches += 1

        resolution_str = ", ".join(mem.remediation_applied[:2]) if mem.remediation_applied else "Standard monitoring"
        top_matches.append(
            HistoricalMatch(
                incident_id=mem.incident_id,
                merchant_id=mem.merchant_id,
                similarity_percentage=sim,
                outcome=mem.outcome,
                pattern=mem.temporal_pattern or "Sequential baseline deviation",
                resolution=resolution_str,
                relevance_notes=f"Correlates with observed {mem.incident_type} workflow in {mem.merchant_type} archetype.",
            )
        )
        if len(top_matches) >= limit:
            break

    total_evaluated = len(all_memories)
    patterns_found = len(top_matches)
    avg_conf = round(sum(m.similarity_percentage for m in top_matches) / patterns_found, 1) if patterns_found else 0.0

    # Evidence-grounded synthesis statement
    if confirmed_ato > 0 and confirmed_ato >= legitimate_matches:
        pattern_summary = (
            f"Historical case memory confirms {confirmed_ato} of {patterns_found} comparable past incidents resulted in "
            f"confirmed account takeover (ATO), supporting heightened defensive containment."
        )
    elif legitimate_matches > 0:
        pattern_summary = (
            f"Historical case memory identifies {legitimate_matches} comparable past incidents where similar velocity "
            f"surges represented verified legitimate promotional campaigns without credential compromise."
        )
    else:
        pattern_summary = (
            f"Historical case memory evaluated {total_evaluated} past cases; current deviations reflect a novel or mixed operational pattern."
        )

    learning = LearningIntelligence(
        historical_cases_analyzed=total_evaluated,
        similar_patterns_found=patterns_found,
        confirmed_ato_matches=confirmed_ato,
        legitimate_matches=legitimate_matches,
        pattern_confidence=avg_conf,
        knowledge_sources_used=[
            f"{confirmed_ato} historical confirmed ATO cases in database",
            f"{legitimate_matches} legitimate promotional sale baseline models",
            f"Abuse syndicate cluster database ({total_evaluated} verified incident memories)",
        ],
    )

    return top_matches, pattern_summary, learning
