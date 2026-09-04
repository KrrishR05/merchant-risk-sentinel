"""
RiskSūtra — Defensive Policy Gate Service

Enforces strictly bounded, defense-only responses for Merchant Account Takeover (ATO).
Guarantees the architectural contract:
AI INVESTIGATION → RECOMMENDED RESPONSE → POLICY / RISK GATE → ALLOWED DEFENSIVE ACTION

The LLM is strictly prohibited from inventing arbitrary actions.
Offense-capable actions, credential theft, unauthorized penetration, or unverified automated
disruptions are strictly rejected by this gate.
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from db import database as db
from models.schemas import (
    ActionExecutionRequest,
    ActionExecutionResult,
    AssessmentVerdict,
    DefensiveAction,
    Incident,
    IncidentStatus,
    RiskBand,
)

logger = logging.getLogger("risksutra.policy_gate")

# Explicit defense-only allowed set
DEFENSIVE_POLICY_RULES = {
    DefensiveAction.REQUIRE_STEP_UP_MFA: {
        "min_risk_band": RiskBand.LOW,
        "allowed_verdicts": [AssessmentVerdict.SUSPICIOUS, AssessmentVerdict.LIKELY_ATO, AssessmentVerdict.INCONCLUSIVE],
        "resulting_status": IncidentStatus.CONTAINED,
        "description": "Enforce biometric or hardware token step-up authentication across administrative sessions.",
    },
    DefensiveAction.INVALIDATE_SUSPICIOUS_SESSION: {
        "min_risk_band": RiskBand.MEDIUM,
        "allowed_verdicts": [AssessmentVerdict.SUSPICIOUS, AssessmentVerdict.LIKELY_ATO],
        "resulting_status": IncidentStatus.CONTAINED,
        "description": "Terminate and invalidate access tokens originated from anomalous or unverified client devices.",
    },
    DefensiveAction.RESTRICT_SENSITIVE_OPERATIONS: {
        "min_risk_band": RiskBand.MEDIUM,
        "allowed_verdicts": [AssessmentVerdict.SUSPICIOUS, AssessmentVerdict.LIKELY_ATO],
        "resulting_status": IncidentStatus.CONTAINED,
        "description": "Block modifications to settlement bank accounts, webhook destinations, and merchant email settings.",
    },
    DefensiveAction.REVOKE_COMPROMISED_API_KEYS: {
        "min_risk_band": RiskBand.HIGH,
        "allowed_verdicts": [AssessmentVerdict.SUSPICIOUS, AssessmentVerdict.LIKELY_ATO],
        "resulting_status": IncidentStatus.CONTAINED,
        "description": "Revoke API credentials active during the anomalous access window and notify merchant owner.",
    },
    DefensiveAction.TEMPORARY_PAYOUT_HOLD: {
        "min_risk_band": RiskBand.HIGH,
        "allowed_verdicts": [AssessmentVerdict.LIKELY_ATO],
        "resulting_status": IncidentStatus.CONTAINED,
        "description": "Apply temporary hold on outbound merchant payout settlements pending owner verification.",
    },
    DefensiveAction.REQUIRE_MERCHANT_VERIFICATION: {
        "min_risk_band": RiskBand.LOW,
        "allowed_verdicts": [AssessmentVerdict.SUSPICIOUS, AssessmentVerdict.LIKELY_ATO, AssessmentVerdict.INCONCLUSIVE, AssessmentVerdict.LIKELY_BENIGN],
        "resulting_status": IncidentStatus.RECOVERY_REQUIRED,
        "description": "Initiate out-of-band identity verification with verified merchant business contact.",
    },
    DefensiveAction.INITIATE_SECURITY_REVIEW: {
        "min_risk_band": RiskBand.LOW,
        "allowed_verdicts": [AssessmentVerdict.SUSPICIOUS, AssessmentVerdict.LIKELY_ATO, AssessmentVerdict.INCONCLUSIVE, AssessmentVerdict.LIKELY_BENIGN],
        "resulting_status": IncidentStatus.INVESTIGATING,
        "description": "Create an escalated security review ticket for manual compliance & security operations review.",
    },
}


class PolicyGate:
    """
    Deterministic gatekeeper ensuring all defensive responses are bounded, verified,
    and auditable before execution.
    """

    @staticmethod
    def get_allowed_actions(incident: Incident, latest_verdict: Optional[AssessmentVerdict] = None) -> List[Dict[str, Any]]:
        """List all currently permitted defensive actions for an incident based on risk score and assessment."""
        allowed = []
        band_hierarchy = {RiskBand.LOW: 1, RiskBand.MEDIUM: 2, RiskBand.HIGH: 3, RiskBand.CRITICAL: 4}
        incident_band_val = band_hierarchy.get(incident.risk_band, 1)

        for action_enum, rule in DEFENSIVE_POLICY_RULES.items():
            rule_min_band_val = band_hierarchy.get(rule["min_risk_band"], 1)
            # Check risk band threshold
            if incident_band_val >= rule_min_band_val:
                # Check verdict compatibility if verdict is known
                if latest_verdict is None or latest_verdict in rule["allowed_verdicts"]:
                    allowed.append({
                        "action": action_enum.value,
                        "description": rule["description"],
                        "resulting_status": rule["resulting_status"].value,
                    })
        return allowed

    @classmethod
    def execute_action(
        cls,
        incident_id: str,
        request: ActionExecutionRequest,
    ) -> ActionExecutionResult:
        """Alias for evaluate_and_execute."""
        return cls.evaluate_and_execute(incident_id, request)

    @classmethod
    def evaluate_and_execute(
        cls,
        incident_id: str,
        request: ActionExecutionRequest,
    ) -> ActionExecutionResult:
        """
        Evaluate defensive action request against bounded security policy.
        If passed, execute action, transition incident status, and log to audit trail.
        """
        incident = db.get_incident(incident_id)
        if not incident:
            raise ValueError(f"Incident {incident_id} not found")

        action_enum = request.action
        if action_enum not in DEFENSIVE_POLICY_RULES:
            # Strictly reject arbitrary actions
            logger.warning(f"POLICY GATE REJECTED: Unknown or arbitrary action {action_enum}")
            return ActionExecutionResult(
                execution_id=f"EXEC_REJ_{uuid.uuid4().hex[:8]}",
                incident_id=incident_id,
                merchant_id=incident.merchant_id,
                action=action_enum,
                status="BLOCKED_BY_POLICY",
                policy_check_passed=False,
                policy_reason=f"Action '{action_enum}' is outside the authorized bounded defense-only action set.",
                resulting_incident_status=incident.status,
                audit_notes="Arbitrary action rejected by RiskSūtra Policy Gate.",
            )

        rule = DEFENSIVE_POLICY_RULES[action_enum]
        band_hierarchy = {RiskBand.LOW: 1, RiskBand.MEDIUM: 2, RiskBand.HIGH: 3, RiskBand.CRITICAL: 4}
        if band_hierarchy.get(incident.risk_band, 1) < band_hierarchy.get(rule["min_risk_band"], 1):
            policy_msg = f"Action {action_enum.value} requires risk band at least {rule['min_risk_band'].value}, but incident is {incident.risk_band.value}."
            logger.warning(f"POLICY GATE BLOCKED: {policy_msg}")
            return ActionExecutionResult(
                execution_id=f"EXEC_BLK_{uuid.uuid4().hex[:8]}",
                incident_id=incident_id,
                merchant_id=incident.merchant_id,
                action=action_enum,
                status="BLOCKED_BY_POLICY",
                policy_check_passed=False,
                policy_reason=policy_msg,
                resulting_incident_status=incident.status,
                audit_notes="Blocked due to insufficient risk justification for restrictive action.",
            )

        # Action is validated and permitted -> Execute state transition
        new_status = rule["resulting_status"]
        incident.status = new_status
        db.save_incident(incident)

        exec_id = f"EXEC_{uuid.uuid4().hex[:10]}"
        logger.info(
            f"POLICY GATE EXECUTED: Action {action_enum.value} on incident {incident_id} "
            f"(Merchant {incident.merchant_id}) -> Status transitioned to {new_status.value}"
        )

        audit_note = (
            f"Defensive control '{action_enum.value}' executed by actor '{request.actor}'. "
            f"Justification: {request.reason}. State updated to {new_status.value}."
        )

        return ActionExecutionResult(
            execution_id=exec_id,
            incident_id=incident_id,
            merchant_id=incident.merchant_id,
            action=action_enum,
            status="EXECUTED",
            policy_check_passed=True,
            policy_reason="Action verified within authorized defensive boundaries.",
            resulting_incident_status=new_status,
            timestamp=datetime.now(timezone.utc),
            audit_notes=audit_note,
        )
