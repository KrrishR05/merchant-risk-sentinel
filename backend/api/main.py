"""
RiskSūtra — FastAPI Application (Day 2 Intelligence Edition)

Main HTTP API serving the risk intelligence platform.
Handles event ingestion, merchant behavioral genome queries, temporal workflow analysis,
fraud spike detection, syndicate graph abuse clusters, and incident management.
"""

import logging
import sys
import os
import traceback
from datetime import datetime, timezone
from typing import Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, ValidationError

# Ensure backend modules are importable
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from db import database as db
from models.schemas import Event, Merchant, RiskBand
from investigator.agent import RiskSutraAIInvestigator
from investigator.audit import persist_investigation, retrieve_audit, retrieve_investigation
from services.risk_orchestrator import (
    get_graph_clusters,
    get_merchant_profile,
    get_merchant_risk,
    get_ordered_event_sequence,
    ingest_event,
    ingest_events_batch,
)
from services.synthetic_generator import (
    generate_merchants,
    generate_normal_events,
    inject_ato_credential_theft,
    inject_legitimate_spike,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("risksutra.api")

app = FastAPI(
    title="RiskSūtra API",
    description="AI Merchant Risk Intelligence — Account Takeover & Behavioral Genome Engine",
    version="0.2.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup():
    logger.info("Initializing RiskSūtra database...")
    db.init_db()
    logger.info("RiskSūtra API ready")


# ──────────────────────────────────────────────
# Error Handling
# ──────────────────────────────────────────────

@app.exception_handler(ValidationError)
async def validation_error_handler(request, exc):
    return JSONResponse(
        status_code=422,
        content={"error": "Validation error", "details": str(exc)},
    )


@app.exception_handler(Exception)
async def general_error_handler(request, exc):
    logger.error(f"Unhandled error: {exc}\n{traceback.format_exc()}")
    return JSONResponse(
        status_code=500,
        content={"error": "Internal server error", "message": "An unexpected error occurred."},
    )


# ──────────────────────────────────────────────
# Health
# ──────────────────────────────────────────────

@app.get("/health")
def health():
    try:
        conn = db.get_connection()
        conn.execute("SELECT 1")
        conn.close()
        db_status = "ok"
    except Exception:
        db_status = "degraded"

    return {
        "status": "ok" if db_status == "ok" else "degraded",
        "service": "RiskSūtra API",
        "version": "0.2.0-day2",
        "database": db_status,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


# ──────────────────────────────────────────────
# Events
# ──────────────────────────────────────────────

@app.post("/events")
def create_event(event: Event):
    """Ingest a single event and trigger risk evaluation."""
    try:
        result = ingest_event(event)
        return {
            "status": "ok",
            "ingested": result["ingested"],
            "duplicate": result["duplicate"],
            "risk_assessment": result["risk_assessment"].model_dump() if result["risk_assessment"] else None,
            "incident_created": result["incident_created"].model_dump() if result["incident_created"] else None,
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Event ingestion error: {e}")
        raise HTTPException(status_code=500, detail="Event ingestion failed")


class EventBatch(BaseModel):
    events: list[Event]


@app.post("/events/batch")
def create_events_batch(batch: EventBatch):
    """Ingest a batch of events and trigger risk evaluation."""
    if not batch.events:
        raise HTTPException(status_code=400, detail="Empty event batch")
    try:
        result = ingest_events_batch(batch.events)
        return {
            "status": "ok",
            "ingested": result["ingested"],
            "risk_assessment": result["risk_assessment"].model_dump() if result["risk_assessment"] else None,
            "incident_created": result["incident_created"].model_dump() if result["incident_created"] else None,
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


# ──────────────────────────────────────────────
# Merchants & Behavioral Genome
# ──────────────────────────────────────────────

@app.get("/merchants")
def list_merchants():
    merchants = db.get_all_merchants()
    return {"merchants": [m.model_dump() for m in merchants]}


@app.get("/merchants/{merchant_id}")
def get_merchant(merchant_id: str):
    merchant = db.get_merchant(merchant_id)
    if not merchant:
        raise HTTPException(status_code=404, detail=f"Merchant {merchant_id} not found")
    return merchant.model_dump()


@app.get("/merchants/{merchant_id}/behavior")
@app.get("/merchants/{merchant_id}/profile")
def get_behavior(merchant_id: str):
    """Retrieve Merchant Behavioral Genome profile."""
    merchant = db.get_merchant(merchant_id)
    if not merchant:
        raise HTTPException(status_code=404, detail=f"Merchant {merchant_id} not found")
    profile = get_merchant_profile(merchant_id)
    return profile.model_dump()


@app.get("/merchants/{merchant_id}/signals")
def get_signals(
    merchant_id: str,
    limit: int = Query(default=50, le=200),
):
    """Retrieve historical deviation signals for a merchant."""
    merchant = db.get_merchant(merchant_id)
    if not merchant:
        raise HTTPException(status_code=404, detail=f"Merchant {merchant_id} not found")
    signals = db.get_merchant_signals(merchant_id, limit=limit)
    return {"merchant_id": merchant_id, "signals": [s.model_dump() for s in signals]}


@app.get("/merchants/{merchant_id}/risk")
def get_risk(merchant_id: str):
    """Retrieve composite risk assessment."""
    merchant = db.get_merchant(merchant_id)
    if not merchant:
        raise HTTPException(status_code=404, detail=f"Merchant {merchant_id} not found")
    assessment = get_merchant_risk(merchant_id)
    return assessment.model_dump()


@app.get("/merchants/{merchant_id}/workflow")
def get_workflow(merchant_id: str):
    """Retrieve Temporal Workflow Integrity result."""
    merchant = db.get_merchant(merchant_id)
    if not merchant:
        raise HTTPException(status_code=404, detail=f"Merchant {merchant_id} not found")
    assessment = get_merchant_risk(merchant_id)
    return assessment.workflow_result.model_dump() if assessment.workflow_result else {}


@app.get("/merchants/{merchant_id}/events")
def get_events(
    merchant_id: str,
    limit: int = Query(default=50, le=500),
):
    merchant = db.get_merchant(merchant_id)
    if not merchant:
        raise HTTPException(status_code=404, detail=f"Merchant {merchant_id} not found")
    events = db.get_recent_events(merchant_id, limit=limit)
    return {"events": [e.model_dump() for e in events]}


@app.get("/merchants/{merchant_id}/timeline")
def get_timeline(
    merchant_id: str,
    start: Optional[str] = None,
    end: Optional[str] = None,
    limit: int = Query(default=100, le=500),
):
    merchant = db.get_merchant(merchant_id)
    if not merchant:
        raise HTTPException(status_code=404, detail=f"Merchant {merchant_id} not found")

    start_time = datetime.fromisoformat(start) if start else None
    end_time = datetime.fromisoformat(end) if end else None

    events = get_ordered_event_sequence(merchant_id, start_time, end_time, limit)
    return {
        "merchant_id": merchant_id,
        "events": [e.model_dump() for e in events],
        "count": len(events),
    }


# ──────────────────────────────────────────────
# Incidents & Evidence Correlator
# ──────────────────────────────────────────────

@app.get("/incidents")
def list_incidents(limit: int = Query(default=50, le=200)):
    incidents = db.get_all_incidents(limit=limit)
    return {"incidents": [i.model_dump() for i in incidents]}


@app.get("/incidents/{incident_id}")
def get_incident(incident_id: str):
    incident = db.get_incident(incident_id)
    if not incident:
        raise HTTPException(status_code=404, detail=f"Incident {incident_id} not found")
    return incident.model_dump()


@app.get("/incidents/{incident_id}/evidence")
def get_incident_evidence(incident_id: str):
    """Retrieve correlated evidence events for an incident."""
    incident = db.get_incident(incident_id)
    if not incident:
        raise HTTPException(status_code=404, detail=f"Incident {incident_id} not found")

    events = db.get_events_by_ids(incident.evidence_event_ids)
    return {
        "incident_id": incident_id,
        "merchant_id": incident.merchant_id,
        "evidence_event_count": len(events),
        "evidence_events": [e.model_dump() for e in events],
    }


@app.post("/incidents/{incident_id}/investigate")
def run_investigation(incident_id: str):
    """Trigger AI Investigator loop for an incident."""
    incident = db.get_incident(incident_id)
    if not incident:
        raise HTTPException(status_code=404, detail=f"Incident {incident_id} not found")

    investigator = RiskSutraAIInvestigator()
    output = investigator.investigate_incident(incident_id)
    result = output["result"]
    audit = output["audit"]

    persist_investigation(result, audit)

    return {
        "incident_id": incident_id,
        "investigation": result.model_dump(),
        "audit": audit.model_dump(),
    }


@app.post("/incidents/{incident_id}/investigate/stream")
@app.get("/incidents/{incident_id}/investigate/stream")
def stream_investigation(incident_id: str):
    """Stream genuine investigation stage progress and final result SSE events."""
    incident = db.get_incident(incident_id)
    if not incident:
        raise HTTPException(status_code=404, detail=f"Incident {incident_id} not found")

    investigator = RiskSutraAIInvestigator()
    return StreamingResponse(
        investigator.investigate_incident_stream(incident_id),
        media_type="text/event-stream"
    )


@app.get("/incidents/{incident_id}/investigation")
def get_investigation(incident_id: str):
    """Retrieve existing investigation result if present."""
    incident = db.get_incident(incident_id)
    if not incident:
        raise HTTPException(status_code=404, detail=f"Incident {incident_id} not found")

    existing = retrieve_investigation(incident_id)
    if existing:
        # Verify exact incident_id, merchant_id, and evidence_version alignment
        if existing.incident_id != incident.incident_id:
            raise HTTPException(status_code=404, detail="Incident ID mismatch")
        if existing.evidence_version != incident.evidence_version:
            raise HTTPException(status_code=404, detail=f"Investigation stale for incident {incident_id} evidence version {incident.evidence_version}")
        return existing.model_dump()

    raise HTTPException(status_code=404, detail=f"No investigation performed yet for incident {incident_id}")


@app.get("/incidents/{incident_id}/investigation/audit")
def get_investigation_audit(incident_id: str):
    """Retrieve investigation audit record for an incident."""
    incident = db.get_incident(incident_id)
    if not incident:
        raise HTTPException(status_code=404, detail=f"Incident {incident_id} not found")

    audit = retrieve_audit(incident_id)
    if not audit:
        raise HTTPException(status_code=404, detail=f"No investigation audit available yet for incident {incident_id}")

    return audit.model_dump()


# ──────────────────────────────────────────────
# Graph & Analytics
# ──────────────────────────────────────────────

@app.get("/graph/clusters")
def list_graph_clusters():
    """Retrieve multi-merchant syndicate abuse clusters."""
    clusters = get_graph_clusters()
    return {"clusters": [c.model_dump() for c in clusters]}


@app.get("/risk/analytics")
def get_risk_analytics():
    """System-wide risk analytics summary."""
    merchants = db.get_all_merchants()
    incidents = db.get_all_incidents(limit=100)

    assessments = [get_merchant_risk(m.merchant_id) for m in merchants]
    high_risk = [a for a in assessments if a.risk_band in (RiskBand.HIGH, RiskBand.CRITICAL)]

    return {
        "total_merchants": len(merchants),
        "total_incidents": len(incidents),
        "active_incidents": len([i for i in incidents if i.status.value == "OPEN"]),
        "high_risk_merchants_count": len(high_risk),
        "risk_distribution": {
            "LOW": len([a for a in assessments if a.risk_band == RiskBand.LOW]),
            "MEDIUM": len([a for a in assessments if a.risk_band == RiskBand.MEDIUM]),
            "HIGH": len([a for a in assessments if a.risk_band == RiskBand.HIGH]),
            "CRITICAL": len([a for a in assessments if a.risk_band == RiskBand.CRITICAL]),
        },
        "model_version": "ato-v0.2-day2",
    }


# ──────────────────────────────────────────────
# Scenario Injection
# ──────────────────────────────────────────────

class ScenarioRequest(BaseModel):
    merchant_id: str
    scenario_type: str = "ato_credential_theft"


@app.post("/scenarios/inject")
def inject_scenario(req: ScenarioRequest):
    """Inject a synthetic scenario for testing/demo purposes."""
    merchant = db.get_merchant(req.merchant_id)
    if not merchant:
        raise HTTPException(status_code=404, detail=f"Merchant {req.merchant_id} not found")

    if req.scenario_type == "ato_credential_theft":
        events, scenario = inject_ato_credential_theft(merchant)
    elif req.scenario_type == "legitimate_spike":
        events, scenario = inject_legitimate_spike(merchant)
    else:
        raise HTTPException(status_code=400, detail=f"Unknown scenario type: {req.scenario_type}")

    result = ingest_events_batch(events)
    existing_incidents = db.get_merchant_incidents(req.merchant_id)
    active_incident = result.get("incident_created") or (existing_incidents[0] if existing_incidents else None)

    assessment = result.get("risk_assessment") or get_merchant_risk(req.merchant_id)

    if active_incident:
        active_incident.evidence_event_ids = [e.event_id for e in events]
        active_incident.signal_ids = [s.signal_id for s in assessment.top_signals]
        active_incident.risk_score = assessment.risk_score
        active_incident.risk_band = assessment.risk_band
        active_incident.incident_type = "LEGITIMATE_SPIKE_EVAL" if req.scenario_type == "legitimate_spike" else "ATO"
        active_incident.summary = f"Scenario {req.scenario_type} evaluation incident"
        active_incident.evidence_version = getattr(active_incident, "evidence_version", 1) + 1
        db.save_incident(active_incident)
    else:
        incident_id = f"INC_EVAL_{req.merchant_id}_{datetime.now(timezone.utc).strftime('%H%M%S')}"
        active_incident = Incident(
            incident_id=incident_id,
            merchant_id=req.merchant_id,
            created_at=datetime.now(timezone.utc),
            status=IncidentStatus.OPEN,
            incident_type="LEGITIMATE_SPIKE_EVAL" if req.scenario_type == "legitimate_spike" else "RISK_EVALUATION",
            risk_score=assessment.risk_score,
            risk_band=assessment.risk_band,
            signal_ids=[s.signal_id for s in assessment.top_signals],
            evidence_event_ids=[e.event_id for e in events],
            summary=f"Automated evaluation incident for scenario {req.scenario_type}",
        )
        db.save_incident(active_incident)

    return {
        "status": "ok",
        "scenario": scenario.model_dump(),
        "events_injected": result["ingested"],
        "risk_assessment": result["risk_assessment"].model_dump() if result["risk_assessment"] else get_merchant_risk(req.merchant_id).model_dump(),
        "incident_created": active_incident.model_dump(),
        "incident_id": active_incident.incident_id,
    }


# ──────────────────────────────────────────────
# Overview
# ──────────────────────────────────────────────

@app.get("/overview")
def get_overview():
    """Dashboard overview data."""
    merchants = db.get_all_merchants()
    incidents = db.get_all_incidents(limit=100)
    recent_events = db.get_all_events(limit=20)

    merchant_risks = []
    for m in merchants:
        assessment = get_merchant_risk(m.merchant_id)
        merchant_risks.append({
            "merchant_id": m.merchant_id,
            "merchant_name": m.merchant_name,
            "merchant_type": m.merchant_type.value,
            "risk_score": assessment.risk_score,
            "risk_band": assessment.risk_band.value,
        })

    return {
        "total_merchants": len(merchants),
        "total_incidents": len(incidents),
        "active_incidents": len([i for i in incidents if i.status.value == "OPEN"]),
        "merchant_risks": merchant_risks,
        "recent_events": [e.model_dump() for e in recent_events[:10]],
        "risk_distribution": {
            "LOW": len([mr for mr in merchant_risks if mr["risk_band"] == "LOW"]),
            "MEDIUM": len([mr for mr in merchant_risks if mr["risk_band"] == "MEDIUM"]),
            "HIGH": len([mr for mr in merchant_risks if mr["risk_band"] == "HIGH"]),
            "CRITICAL": len([mr for mr in merchant_risks if mr["risk_band"] == "CRITICAL"]),
        },
    }
