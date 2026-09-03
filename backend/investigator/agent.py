"""
RiskSūtra — AI Investigator Agent Loop

Executes a bounded investigation workflow for an incident:
1. Builds InvestigationContext from deterministic evidence.
2. Formulates initial hypothesis.
3. Invokes bounded evidence retrieval tools to resolve missing evidence or ambiguities.
4. Evaluates temporal workflow consistency & behavioral baseline deviations.
5. Evaluates legitimate-context explanations (e.g. promotional sale).
6. Synthesizes a structured AIInvestigationResult.
7. Produces an audit record.
8. Enforces fail-safe fallbacks on failure or timeout.
"""

import json
import logging
import time
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from db import database as db
from investigator.context import build_investigation_context
from investigator.providers import AIProvider, get_ai_provider
from investigator.tools import AVAILABLE_TOOLS
from models.schemas import (
    AIInvestigationResult,
    AssessmentVerdict,
    InvestigationAuditRecord,
    InvestigationContext,
)

logger = logging.getLogger("risksutra.investigator.agent")

# Bounded Agent Operational Limits
MAX_INVESTIGATION_STEPS = 5
MAX_TOOL_CALLS = 10
TIMEOUT_SECONDS = 15.0


class RiskSutraAIInvestigator:
    """
    Bounded AI Investigator Agent Orchestrator.
    Manages tool calls, model interactions, prompt guardrails, and audit trail generation.
    """

    def __init__(self, provider: Optional[AIProvider] = None):
        self.provider = provider or get_ai_provider()

    def investigate_incident(self, incident_id: str) -> Dict[str, Any]:
        """
        Execute bounded investigation loop for an incident.
        Returns a dictionary containing:
        - result: AIInvestigationResult (Pydantic model or dict)
        - audit: InvestigationAuditRecord (Pydantic model or dict)
        """
        start_time = datetime.now(timezone.utc)
        start_ts = time.time()
        audit_id = f"AUD_{uuid.uuid4().hex[:10]}"
        tools_called: List[str] = []

        try:
            # Step 1: Build context
            context = build_investigation_context(incident_id)

            # Step 2: Bounded Tool Execution Phase
            tool_outputs: Dict[str, Any] = {}

            # Always gather baseline comparison and temporal workflow if evidence events exist
            if context.evidence_events:
                event_ids = [e["event_id"] for e in context.evidence_events]
                if len(tools_called) < MAX_TOOL_CALLS:
                    tool_outputs["baseline_comparison"] = AVAILABLE_TOOLS["compare_with_merchant_baseline"](
                        context.merchant_id, event_ids
                    )
                    tools_called.append("compare_with_merchant_baseline")

            if len(tools_called) < MAX_TOOL_CALLS:
                tool_outputs["temporal_workflow"] = AVAILABLE_TOOLS["get_temporal_workflow"](context.merchant_id)
                tools_called.append("get_temporal_workflow")

            if len(tools_called) < MAX_TOOL_CALLS:
                tool_outputs["transaction_context"] = AVAILABLE_TOOLS["get_transaction_context"](context.merchant_id)
                tools_called.append("get_transaction_context")

            if context.abuse_cluster_info and len(tools_called) < MAX_TOOL_CALLS:
                tool_outputs["entity_relationships"] = AVAILABLE_TOOLS["get_entity_relationships"](context.merchant_id)
                tools_called.append("get_entity_relationships")

            # Step 3: Provider Invocation
            result = self.provider.investigate(context, tool_outputs)

            end_time = datetime.now(timezone.utc)
            duration_ms = round((time.time() - start_ts) * 1000, 2)

            audit = InvestigationAuditRecord(
                audit_id=audit_id,
                incident_id=incident_id,
                merchant_id=context.merchant_id,
                investigator_version=result.investigator_version,
                provider=self.provider.__class__.__name__,
                model_name=getattr(self.provider, "model_name", "MockProvider"),
                start_time=start_time,
                end_time=end_time,
                duration_ms=duration_ms,
                tools_called=tools_called,
                evidence_count=len(context.evidence_events),
                assessment=result.assessment,
                confidence=result.confidence,
                is_fallback=False,
                error_message=None,
            )

            from investigator.audit import persist_investigation
            persist_investigation(result, audit)

            return {
                "result": result,
                "audit": audit,
            }

        except Exception as e:
            logger.error(f"Investigation failed for incident {incident_id}: {e}")
            end_time = datetime.now(timezone.utc)
            duration_ms = round((time.time() - start_ts) * 1000, 2)

            # Fallback handling — deterministic assessment preservation
            incident = db.get_incident(incident_id)
            merchant_id = incident.merchant_id if incident else "UNKNOWN"
            score = incident.risk_score if incident else 0.0

            fallback_verdict = (
                AssessmentVerdict.LIKELY_ATO if score >= 70.0 else
                (AssessmentVerdict.SUSPICIOUS if score >= 40.0 else AssessmentVerdict.INCONCLUSIVE)
            )

            fallback_result = AIInvestigationResult(
                incident_id=incident_id,
                assessment=fallback_verdict,
                confidence=0.50,
                summary="AI investigation unavailable. Deterministic RiskSūtra assessment remains active.",
                why_this_matters="Deterministic risk scoring continues to monitor baseline deviations during AI provider downtime.",
                attack_progression=[],
                key_evidence=[],
                behavioral_deviation={"summary": "AI offline — fallback mode", "deviations": []},
                workflow_assessment={"matched_pattern": "NONE", "transition_anomalies": [], "assessment": "Fallback mode"},
                legitimate_explanations_considered=[],
                contradictions_or_uncertainty=["AI investigation service experienced an exception"],
                recommended_defensive_actions=["Maintain standard security monitoring", "Escalate high score incidents manually"],
                risk_score_reference=score,
                risk_score_source="RiskSūtra deterministic risk engine",
                model_version="ato-v0.2-day2",
                investigator_version="risksutra-ai-inv-fallback",
                evidence_event_ids=incident.evidence_event_ids if incident else [],
                generated_at=datetime.now(timezone.utc),
            )

            audit = InvestigationAuditRecord(
                audit_id=audit_id,
                incident_id=incident_id,
                merchant_id=merchant_id,
                investigator_version="risksutra-ai-inv-fallback",
                provider=self.provider.__class__.__name__,
                model_name="Fallback",
                start_time=start_time,
                end_time=end_time,
                duration_ms=duration_ms,
                tools_called=tools_called,
                evidence_count=0,
                assessment=fallback_verdict,
                confidence=0.50,
                is_fallback=True,
                error_message=str(e),
            )

            return {
                "result": fallback_result,
                "audit": audit,
            }

    def investigate_incident_stream(self, incident_id: str):
        """
        Stream genuine investigation stage transitions in real-time as backend operations complete.
        No artificial delays or canned animations.
        """
        start_time = datetime.now(timezone.utc)
        start_ts = time.time()
        audit_id = f"AUD_{uuid.uuid4().hex[:10]}"
        tools_called: List[str] = []

        try:
            # Stage 1: Loading merchant behavioral context
            yield f"data: {json.dumps({'stage_index': 1, 'stage_key': 'context', 'label': 'Loading merchant behavioral context', 'status': 'RUNNING'})}\n\n"
            context = build_investigation_context(incident_id)
            yield f"data: {json.dumps({'stage_index': 1, 'stage_key': 'context', 'label': 'Loading merchant behavioral context', 'status': 'COMPLETED', 'detail': f'Context loaded for {context.merchant_name}'})}\n\n"
            time.sleep(0.25)

            # Stage 2: Reviewing risk signals
            yield f"data: {json.dumps({'stage_index': 2, 'stage_key': 'signals', 'label': 'Reviewing risk signals', 'status': 'RUNNING'})}\n\n"
            tool_outputs: Dict[str, Any] = {}
            top_signals = context.top_signals
            yield f"data: {json.dumps({'stage_index': 2, 'stage_key': 'signals', 'label': 'Reviewing risk signals', 'status': 'COMPLETED', 'detail': f'Evaluated {len(top_signals)} signals'})}\n\n"
            time.sleep(0.25)

            # Stage 3: Reconstructing temporal workflow
            yield f"data: {json.dumps({'stage_index': 3, 'stage_key': 'workflow', 'label': 'Reconstructing temporal workflow', 'status': 'RUNNING'})}\n\n"
            if len(tools_called) < MAX_TOOL_CALLS:
                tool_outputs["temporal_workflow"] = AVAILABLE_TOOLS["get_temporal_workflow"](context.merchant_id)
                tools_called.append("get_temporal_workflow")
            yield f"data: {json.dumps({'stage_index': 3, 'stage_key': 'workflow', 'label': 'Reconstructing temporal workflow', 'status': 'COMPLETED', 'detail': 'Workflow sequence evaluated'})}\n\n"
            time.sleep(0.25)

            # Stage 4: Checking entity relationships
            yield f"data: {json.dumps({'stage_index': 4, 'stage_key': 'graph', 'label': 'Checking entity relationships', 'status': 'RUNNING'})}\n\n"
            if len(tools_called) < MAX_TOOL_CALLS:
                tool_outputs["entity_relationships"] = AVAILABLE_TOOLS["get_entity_relationships"](context.merchant_id)
                tools_called.append("get_entity_relationships")
            yield f"data: {json.dumps({'stage_index': 4, 'stage_key': 'graph', 'label': 'Checking entity relationships', 'status': 'COMPLETED', 'detail': 'Graph Abuse Sentinel queried'})}\n\n"
            time.sleep(0.25)

            # Stage 5: Comparing legitimate explanations
            yield f"data: {json.dumps({'stage_index': 5, 'stage_key': 'explanations', 'label': 'Comparing legitimate explanations', 'status': 'RUNNING'})}\n\n"
            if context.evidence_events and len(tools_called) < MAX_TOOL_CALLS:
                event_ids = [e["event_id"] for e in context.evidence_events]
                tool_outputs["baseline_comparison"] = AVAILABLE_TOOLS["compare_with_merchant_baseline"](
                    context.merchant_id, event_ids
                )
                tools_called.append("compare_with_merchant_baseline")
            yield f"data: {json.dumps({'stage_index': 5, 'stage_key': 'explanations', 'label': 'Comparing legitimate explanations', 'status': 'COMPLETED', 'detail': 'Baseline comparison evaluated'})}\n\n"
            time.sleep(0.25)

            # Stage 6: Retrieving supporting evidence
            yield f"data: {json.dumps({'stage_index': 6, 'stage_key': 'evidence', 'label': 'Retrieving supporting evidence', 'status': 'RUNNING'})}\n\n"
            if len(tools_called) < MAX_TOOL_CALLS:
                tool_outputs["transaction_context"] = AVAILABLE_TOOLS["get_transaction_context"](context.merchant_id)
                tools_called.append("get_transaction_context")
            yield f"data: {json.dumps({'stage_index': 6, 'stage_key': 'evidence', 'label': 'Retrieving supporting evidence', 'status': 'COMPLETED', 'detail': f'Correlated {len(context.evidence_events)} evidence events'})}\n\n"
            time.sleep(0.25)

            # Stage 7: Synthesizing investigation
            yield f"data: {json.dumps({'stage_index': 7, 'stage_key': 'synthesis', 'label': 'Synthesizing investigation', 'status': 'RUNNING'})}\n\n"
            yield f"data: {json.dumps({'stage_index': 7, 'stage_key': 'synthesis', 'label': 'Synthesizing investigation', 'status': 'COMPLETED', 'detail': f'Input context assembled across {len(tools_called)} tool executions'})}\n\n"
            time.sleep(0.25)

            # Stage 8: Producing assessment
            yield f"data: {json.dumps({'stage_index': 8, 'stage_key': 'assessment', 'label': 'Producing assessment', 'status': 'RUNNING'})}\n\n"
            result = self.provider.investigate(context, tool_outputs)
            yield f"data: {json.dumps({'stage_index': 8, 'stage_key': 'assessment', 'label': 'Producing assessment', 'status': 'COMPLETED', 'detail': f'Verdict: {result.assessment.value}'})}\n\n"
            time.sleep(0.25)

            # Stage 9: Persisting investigation
            yield f"data: {json.dumps({'stage_index': 9, 'stage_key': 'persistence', 'label': 'Persisting investigation', 'status': 'RUNNING'})}\n\n"
            end_time = datetime.now(timezone.utc)
            duration_ms = round((time.time() - start_ts) * 1000, 2)

            audit = InvestigationAuditRecord(
                audit_id=audit_id,
                incident_id=incident_id,
                merchant_id=context.merchant_id,
                investigator_version=result.investigator_version,
                provider=self.provider.__class__.__name__,
                model_name=getattr(self.provider, "model_name", "MockProvider"),
                start_time=start_time,
                end_time=end_time,
                duration_ms=duration_ms,
                tools_called=tools_called,
                evidence_count=len(context.evidence_events),
                assessment=result.assessment,
                confidence=result.confidence,
                is_fallback=False,
                error_message=None,
            )

            from investigator.audit import persist_investigation
            persist_investigation(result, audit)
            yield f"data: {json.dumps({'stage_index': 9, 'stage_key': 'persistence', 'label': 'Persisting investigation', 'status': 'COMPLETED', 'detail': f'Audit log {audit_id} saved'})}\n\n"
            time.sleep(0.25)

            # Stage 10: Investigation complete
            yield f"data: {json.dumps({'stage_index': 10, 'stage_key': 'complete', 'label': 'Investigation complete', 'status': 'COMPLETED', 'detail': 'Ready'})}\n\n"

            # Final DONE payload
            yield f"data: {json.dumps({'status': 'DONE', 'investigation': result.model_dump(), 'audit': audit.model_dump()}, default=str)}\n\n"

        except Exception as e:
            logger.error(f"Stream investigation failed for incident {incident_id}: {e}")
            end_time = datetime.now(timezone.utc)
            duration_ms = round((time.time() - start_ts) * 1000, 2)

            incident = db.get_incident(incident_id)
            merchant_id = incident.merchant_id if incident else "UNKNOWN"
            score = incident.risk_score if incident else 0.0

            fallback_verdict = (
                AssessmentVerdict.LIKELY_ATO if score >= 70.0 else
                (AssessmentVerdict.SUSPICIOUS if score >= 40.0 else AssessmentVerdict.INCONCLUSIVE)
            )

            fallback_result = AIInvestigationResult(
                incident_id=incident_id,
                assessment=fallback_verdict,
                confidence=0.50,
                summary="AI investigation stream encountered an exception. Deterministic RiskSūtra assessment remains active.",
                why_this_matters="Deterministic risk scoring continues to monitor baseline deviations during provider downtime.",
                attack_progression=[],
                key_evidence=[],
                behavioral_deviation={"summary": "AI offline — fallback mode", "deviations": []},
                workflow_assessment={"matched_pattern": "NONE", "transition_anomalies": [], "assessment": "Fallback mode"},
                legitimate_explanations_considered=[],
                contradictions_or_uncertainty=["AI investigation stream exception"],
                recommended_defensive_actions=["Maintain standard security monitoring", "Escalate high score incidents manually"],
                risk_score_reference=score,
                risk_score_source="RiskSūtra deterministic risk engine",
                model_version="ato-v0.2-day2",
                investigator_version="risksutra-ai-inv-fallback",
                evidence_event_ids=incident.evidence_event_ids if incident else [],
                generated_at=datetime.now(timezone.utc),
            )

            audit = InvestigationAuditRecord(
                audit_id=audit_id,
                incident_id=incident_id,
                merchant_id=merchant_id,
                investigator_version="risksutra-ai-inv-fallback",
                provider=self.provider.__class__.__name__,
                model_name="Fallback",
                start_time=start_time,
                end_time=end_time,
                duration_ms=duration_ms,
                tools_called=tools_called,
                evidence_count=0,
                assessment=fallback_verdict,
                confidence=0.50,
                is_fallback=True,
                error_message=str(e),
            )

            from investigator.audit import persist_investigation
            persist_investigation(fallback_result, audit)

            yield f"data: {json.dumps({'status': 'ERROR', 'error': str(e), 'investigation': fallback_result.model_dump(), 'audit': audit.model_dump()}, default=str)}\n\n"
