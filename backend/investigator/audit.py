"""
RiskSūtra — Investigation Audit Service

Saves and fetches investigation results and decision audit records.
"""

import logging
from typing import Optional, Tuple
from db import database as db
from models.schemas import AIInvestigationResult, InvestigationAuditRecord

logger = logging.getLogger("risksutra.investigator.audit")


def persist_investigation(result: AIInvestigationResult, audit: InvestigationAuditRecord):
    """Save both the AIInvestigationResult and its corresponding InvestigationAuditRecord."""
    incident = db.get_incident(result.incident_id)
    merchant_id = incident.merchant_id if incident else "UNKNOWN"
    db.save_investigation_result(result, merchant_id)
    db.save_investigation_audit(audit)
    logger.info(f"Persisted AI investigation & audit trail for incident {result.incident_id}")


def retrieve_investigation(incident_id: str) -> Optional[AIInvestigationResult]:
    """Retrieve saved AIInvestigationResult for an incident."""
    return db.get_investigation_result(incident_id)


def retrieve_audit(incident_id: str) -> Optional[InvestigationAuditRecord]:
    """Retrieve saved InvestigationAuditRecord for an incident."""
    return db.get_investigation_audit(incident_id)
