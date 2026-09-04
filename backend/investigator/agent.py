"""
RiskSūtra — AI Investigator Agent Loop

Executes a bounded, evidence-grounded investigation workflow for an incident:
1. Builds InvestigationContext from deterministic evidence and behavioral baseline.
2. Invokes bounded evidence retrieval tools (genome, temporal workflow, transaction context, graph clusters).
3. Queries historical case memory for pattern similarity and outcome intelligence.
4. Evaluates legitimate-context hypotheses (promotional sale, authorized travel).
5. Synthesizes a structured AIInvestigationResult adhering to full Part 7 domain contracts.
6. Persists investigation results, decision audit logs, and case memory records.
7. Streams real-time progress events without artificial delays.
"""

from __future__ import annotations

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
    HistoricalMemoryRecord,
    InvestigationAuditRecord,
    InvestigationContext,
)

logger = logging.getLogger("risksutra.investigator.agent")

MAX_INVESTIGATION_STEPS = 10
MAX_TOOL_CALLS = 12
TIMEOUT_SECONDS = 15.0


class RiskSutraAIInvestigator:
    """
    Bounded AI Investigator Agent Orchestrator.
    Coordinates evidence retrieval, historical case memory correlation, AI provider invocation,
    audit generation, and persistent incident intelligence.
    """

    def __init__(self, provider: Optional[AIProvider] = None):
        self.provider = provider or get_ai_provider()

    def investigate_incident(self, incident_id: str) -> Dict[str, Any]:
        """
        Execute bounded investigation loop for an incident.
        Returns dictionary containing:
        - result: AIInvestigationResult
        - audit: InvestigationAuditRecord
        """
        start_time = datetime.now(timezone.utc)
        start_ts = time.time()
        audit_id = f"AUD_{uuid.uuid4().hex[:10]}"
        tools_called: List[str] = []

        try:
            # Step 1: Build verified context
            context = build_investigation_context(incident_id)

            # Step 2: Bounded Tool Execution Phase
            tool_outputs: Dict[str, Any] = {}

            if context.evidence_events and len(tools_called) < MAX_TOOL_CALLS:
                event_ids = [e["event_id"] for e in context.evidence_events]
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

            # Step 3: Historical Case Memory Retrieval
            signal_types = [s.get("signal_type", "") for s in context.top_signals]
            has_config_change = any("CONFIG" in st or "SENSITIVE" in st or "PAYOUT" in st for st in signal_types)
            has_new_device = any("DEVICE" in st for st in signal_types)
            has_geo_dev = any("GEO" in st or "COUNTRY" in st for st in signal_types)
            has_txn_anomaly = any("TXN" in st or "AMOUNT" in st for st in signal_types)

            if len(tools_called) < MAX_TOOL_CALLS:
                tool_outputs["historical_cases"] = AVAILABLE_TOOLS["search_historical_case_memory"](
                    incident_id=context.incident_id,
                    merchant_type=context.merchant_type,
                    top_signals=context.top_signals,
                    has_config_change=has_config_change,
                    has_new_device=has_new_device,
                    has_geo_dev=has_geo_dev,
                    has_txn_anomaly=has_txn_anomaly,
                    has_cluster=bool(context.abuse_cluster_info),
                )
                tools_called.append("search_historical_case_memory")

            # Step 4: Provider Invocation
            result = self.provider.investigate(context, tool_outputs)

            end_time = datetime.now(timezone.utc)
            duration_ms = round((time.time() - start_ts) * 1000, 2)

            audit = InvestigationAuditRecord(
                audit_id=audit_id,
                incident_id=incident_id,
                merchant_id=context.merchant_id,
                evidence_version=getattr(context, "evidence_version", 1),
                investigator_version=result.investigator_version,
                provider=self.provider.__class__.__name__,
                model_name=getattr(self.provider, "model_name", "MockProvider"),
                start_time=start_time,
                end_time=end_time,
                duration_ms=duration_ms,
                tools_called=tools_called,
                historical_cases_retrieved=len(result.historical_matches),
                evidence_count=len(context.evidence_events),
                assessment=result.assessment,
                confidence=result.confidence,
                is_fallback=False,
                error_message=None,
            )

            # Step 5: Persistence of investigation result and audit record
            from investigator.audit import persist_investigation
            persist_investigation(result, audit)

            # Step 6: Persist case memory record for continuous learning
            case_mem = HistoricalMemoryRecord(
                memory_id=f"MEM_{incident_id}",
                incident_id=incident_id,
                merchant_id=context.merchant_id,
                merchant_name=context.merchant_name,
                merchant_type=context.merchant_type,
                incident_type="ATO" if result.assessment == AssessmentVerdict.LIKELY_ATO else ("LEGITIMATE_SPIKE" if result.assessment == AssessmentVerdict.LIKELY_BENIGN else "SUSPICIOUS_ACTIVITY"),
                risk_score=result.risk_score_reference,
                risk_band=context.risk_band.value,
                signals_summary=[s.get("signal_type", "") for s in context.top_signals],
                temporal_pattern=result.temporal_analysis.get("matched_pattern", "") or "Sequential baseline deviation",
                attack_progression=[p.model_dump() for p in result.attack_progression],
                outcome="CONFIRMED_ATO" if result.assessment == AssessmentVerdict.LIKELY_ATO else ("LEGITIMATE_SPIKE" if result.assessment == AssessmentVerdict.LIKELY_BENIGN else "RESOLVED"),
                investigation_assessment=result.assessment.value,
                remediation_applied=result.recommended_defensive_actions[:3],
                resolution_status="OPEN",
                evidence_references=[e.event_id for e in result.key_evidence],
                created_at=datetime.now(timezone.utc),
            )
            try:
                db.save_case_memory(case_mem)
            except Exception as e_mem:
                logger.warning(f"Could not persist case memory: {e_mem}")

            return {
                "result": result,
                "audit": audit,
            }

        except Exception as e:
            logger.error(f"Investigation failed for incident {incident_id}: {e}")
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
                merchant_id=merchant_id,
                run_id=audit_id,
                assessment=fallback_verdict,
                confidence=0.50,
                summary="AI investigation unavailable. Deterministic RiskSūtra assessment remains active.",
                executive_summary="AI investigation service unavailable. Deterministic RiskSūtra risk engine remains active and authoritative.",
                what_happened="Deterministic signals evaluated. Automated AI deep-synthesis encountered an exception.",
                why_this_matters="Deterministic risk scoring continues to monitor baseline deviations during AI provider downtime.",
                why_it_matters="Deterministic risk scoring continues to monitor baseline deviations during AI provider downtime.",
                root_cause_hypotheses=["AI provider offline or transient connectivity error"],
                attack_progression=[],
                key_evidence=[],
                behavioral_deviation={"summary": "AI offline — fallback mode", "deviations": []},
                behavioral_deviations={"summary": "AI offline — fallback mode", "deviations": []},
                workflow_assessment={"matched_pattern": "NONE", "transition_anomalies": [], "assessment": "Fallback mode"},
                temporal_analysis={"matched_pattern": "NONE", "transition_anomalies": [], "assessment": "Fallback mode"},
                entity_relationships={"has_cluster": False, "details": "Fallback mode"},
                transaction_analysis={"transaction_count": 0},
                legitimate_explanations_considered=[],
                contradictions_or_uncertainty=["AI investigation service experienced an exception"],
                contradictory_evidence=["AI investigation service experienced an exception"],
                missing_evidence=["AI synthesis telemetry unavailable"],
                historical_matches=[],
                historical_pattern_summary="Historical memory lookup skipped in fallback mode",
                recommended_defensive_actions=["Maintain standard security monitoring", "Escalate high score incidents manually"],
                immediate_actions=["Maintain standard security monitoring"],
                containment_actions=["Escalate high score incidents manually"],
                recovery_actions=["Retry AI investigation once connectivity is restored"],
                resolution_conditions=["System connectivity restored"],
                estimated_resolution_window="Immediate review",
                monitoring_requirements=["Standard deterministic telemetry"],
                analyst_questions=["Confirm provider connectivity status"],
                evidence_event_ids=incident.evidence_event_ids if incident else [],
                evidence_version=getattr(incident, "evidence_version", 1) if incident else 1,
                risk_score_reference=score,
                risk_score_source="RiskSūtra deterministic risk engine",
                model_version="ato-v0.2-day2",
                investigator_version="risksutra-ai-inv-fallback",
                generated_at=datetime.now(timezone.utc),
            )

            audit = InvestigationAuditRecord(
                audit_id=audit_id,
                incident_id=incident_id,
                merchant_id=merchant_id,
                evidence_version=getattr(incident, "evidence_version", 1) if incident else 1,
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
        Stream genuine investigation stage progress in real-time as backend operations complete.
        Zero artificial delays or canned animations.
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

            # Stage 2: Reviewing risk signals
            yield f"data: {json.dumps({'stage_index': 2, 'stage_key': 'signals', 'label': 'Reviewing risk signals', 'status': 'RUNNING'})}\n\n"
            tool_outputs: Dict[str, Any] = {}
            top_signals = context.top_signals
            yield f"data: {json.dumps({'stage_index': 2, 'stage_key': 'signals', 'label': 'Reviewing risk signals', 'status': 'COMPLETED', 'detail': f'Evaluated {len(top_signals)} signals'})}\n\n"

            # Stage 3: Reconstructing temporal workflow
            yield f"data: {json.dumps({'stage_index': 3, 'stage_key': 'workflow', 'label': 'Reconstructing temporal workflow', 'status': 'RUNNING'})}\n\n"
            if len(tools_called) < MAX_TOOL_CALLS:
                tool_outputs["temporal_workflow"] = AVAILABLE_TOOLS["get_temporal_workflow"](context.merchant_id)
                tools_called.append("get_temporal_workflow")
            yield f"data: {json.dumps({'stage_index': 3, 'stage_key': 'workflow', 'label': 'Reconstructing temporal workflow', 'status': 'COMPLETED', 'detail': 'Workflow sequence evaluated'})}\n\n"

            # Stage 4: Checking entity relationships
            yield f"data: {json.dumps({'stage_index': 4, 'stage_key': 'graph', 'label': 'Checking entity relationships', 'status': 'RUNNING'})}\n\n"
            if len(tools_called) < MAX_TOOL_CALLS:
                tool_outputs["entity_relationships"] = AVAILABLE_TOOLS["get_entity_relationships"](context.merchant_id)
                tools_called.append("get_entity_relationships")
            yield f"data: {json.dumps({'stage_index': 4, 'stage_key': 'graph', 'label': 'Checking entity relationships', 'status': 'COMPLETED', 'detail': 'Graph Abuse Sentinel queried'})}\n\n"

            # Stage 5: Searching historical case memory
            yield f"data: {json.dumps({'stage_index': 5, 'stage_key': 'memory', 'label': 'Searching historical case memory', 'status': 'RUNNING'})}\n\n"
            signal_types = [s.get("signal_type", "") for s in context.top_signals]
            has_config_change = any("CONFIG" in st or "SENSITIVE" in st or "PAYOUT" in st for st in signal_types)
            has_new_device = any("DEVICE" in st for st in signal_types)
            has_geo_dev = any("GEO" in st or "COUNTRY" in st for st in signal_types)
            has_txn_anomaly = any("TXN" in st or "AMOUNT" in st for st in signal_types)

            if len(tools_called) < MAX_TOOL_CALLS:
                tool_outputs["historical_cases"] = AVAILABLE_TOOLS["search_historical_case_memory"](
                    incident_id=context.incident_id,
                    merchant_type=context.merchant_type,
                    top_signals=context.top_signals,
                    has_config_change=has_config_change,
                    has_new_device=has_new_device,
                    has_geo_dev=has_geo_dev,
                    has_txn_anomaly=has_txn_anomaly,
                    has_cluster=bool(context.abuse_cluster_info),
                )
                tools_called.append("search_historical_case_memory")
            hist_found = len(tool_outputs.get("historical_cases", {}).get("historical_matches", []))
            yield f"data: {json.dumps({'stage_index': 5, 'stage_key': 'memory', 'label': 'Searching historical case memory', 'status': 'COMPLETED', 'detail': f'Correlated {hist_found} historical cases'})}\n\n"

            # Stage 6: Comparing legitimate explanations & baseline
            yield f"data: {json.dumps({'stage_index': 6, 'stage_key': 'explanations', 'label': 'Comparing legitimate explanations', 'status': 'RUNNING'})}\n\n"
            if context.evidence_events and len(tools_called) < MAX_TOOL_CALLS:
                event_ids = [e["event_id"] for e in context.evidence_events]
                tool_outputs["baseline_comparison"] = AVAILABLE_TOOLS["compare_with_merchant_baseline"](
                    context.merchant_id, event_ids
                )
                tools_called.append("compare_with_merchant_baseline")
            yield f"data: {json.dumps({'stage_index': 6, 'stage_key': 'explanations', 'label': 'Comparing legitimate explanations', 'status': 'COMPLETED', 'detail': 'Baseline genome deviations evaluated'})}\n\n"

            # Stage 7: Retrieving supporting transaction evidence
            yield f"data: {json.dumps({'stage_index': 7, 'stage_key': 'evidence', 'label': 'Retrieving supporting evidence', 'status': 'RUNNING'})}\n\n"
            if len(tools_called) < MAX_TOOL_CALLS:
                tool_outputs["transaction_context"] = AVAILABLE_TOOLS["get_transaction_context"](context.merchant_id)
                tools_called.append("get_transaction_context")
            yield f"data: {json.dumps({'stage_index': 7, 'stage_key': 'evidence', 'label': 'Retrieving supporting evidence', 'status': 'COMPLETED', 'detail': f'Correlated {len(context.evidence_events)} evidence events'})}\n\n"

            # Stage 8: Invoking AI Investigator synthesis
            yield f"data: {json.dumps({'stage_index': 8, 'stage_key': 'synthesis', 'label': 'Invoking AI investigator', 'status': 'RUNNING'})}\n\n"
            result = self.provider.investigate(context, tool_outputs)
            yield f"data: {json.dumps({'stage_index': 8, 'stage_key': 'synthesis', 'label': 'Invoking AI investigator', 'status': 'COMPLETED', 'detail': f'Verdict: {result.assessment.value} ({int(result.confidence * 100)}% conf)'})}\n\n"

            # Stage 9: Persisting investigation and audit record
            yield f"data: {json.dumps({'stage_index': 9, 'stage_key': 'persistence', 'label': 'Persisting investigation', 'status': 'RUNNING'})}\n\n"
            end_time = datetime.now(timezone.utc)
            duration_ms = round((time.time() - start_ts) * 1000, 2)

            audit = InvestigationAuditRecord(
                audit_id=audit_id,
                incident_id=incident_id,
                merchant_id=context.merchant_id,
                evidence_version=getattr(context, "evidence_version", 1),
                investigator_version=result.investigator_version,
                provider=self.provider.__class__.__name__,
                model_name=getattr(self.provider, "model_name", "MockProvider"),
                start_time=start_time,
                end_time=end_time,
                duration_ms=duration_ms,
                tools_called=tools_called,
                historical_cases_retrieved=len(result.historical_matches),
                evidence_count=len(context.evidence_events),
                assessment=result.assessment,
                confidence=result.confidence,
                is_fallback=False,
                error_message=None,
            )

            from investigator.audit import persist_investigation
            persist_investigation(result, audit)

            # Persist case memory
            case_mem = HistoricalMemoryRecord(
                memory_id=f"MEM_{incident_id}",
                incident_id=incident_id,
                merchant_id=context.merchant_id,
                merchant_name=context.merchant_name,
                merchant_type=context.merchant_type,
                incident_type="ATO" if result.assessment == AssessmentVerdict.LIKELY_ATO else ("LEGITIMATE_SPIKE" if result.assessment == AssessmentVerdict.LIKELY_BENIGN else "SUSPICIOUS_ACTIVITY"),
                risk_score=result.risk_score_reference,
                risk_band=context.risk_band.value,
                signals_summary=[s.get("signal_type", "") for s in context.top_signals],
                temporal_pattern=result.temporal_analysis.get("matched_pattern", "") or "Sequential baseline deviation",
                attack_progression=[p.model_dump() for p in result.attack_progression],
                outcome="CONFIRMED_ATO" if result.assessment == AssessmentVerdict.LIKELY_ATO else ("LEGITIMATE_SPIKE" if result.assessment == AssessmentVerdict.LIKELY_BENIGN else "RESOLVED"),
                investigation_assessment=result.assessment.value,
                remediation_applied=result.recommended_defensive_actions[:3],
                resolution_status="OPEN",
                evidence_references=[e.event_id for e in result.key_evidence],
                created_at=datetime.now(timezone.utc),
            )
            try:
                db.save_case_memory(case_mem)
            except Exception as e_mem:
                logger.warning(f"Could not persist stream case memory: {e_mem}")

            yield f"data: {json.dumps({'stage_index': 9, 'stage_key': 'persistence', 'label': 'Persisting investigation', 'status': 'COMPLETED', 'detail': f'Audit log {audit_id} saved'})}\n\n"

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
                merchant_id=merchant_id,
                run_id=audit_id,
                assessment=fallback_verdict,
                confidence=0.50,
                summary="AI investigation stream encountered an exception. Deterministic RiskSūtra assessment remains active.",
                executive_summary="AI investigation stream encountered an exception. Deterministic RiskSūtra risk engine remains active and authoritative.",
                what_happened="Deterministic signals evaluated. Real-time stream encountered an unhandled exception.",
                why_this_matters="Deterministic risk scoring continues to monitor baseline deviations during provider downtime.",
                why_it_matters="Deterministic risk scoring continues to monitor baseline deviations during provider downtime.",
                root_cause_hypotheses=["Transient system exception during investigation pipeline execution"],
                attack_progression=[],
                key_evidence=[],
                behavioral_deviation={"summary": "AI offline — fallback mode", "deviations": []},
                behavioral_deviations={"summary": "AI offline — fallback mode", "deviations": []},
                workflow_assessment={"matched_pattern": "NONE", "transition_anomalies": [], "assessment": "Fallback mode"},
                temporal_analysis={"matched_pattern": "NONE", "transition_anomalies": [], "assessment": "Fallback mode"},
                entity_relationships={"has_cluster": False, "details": "Fallback mode"},
                transaction_analysis={"transaction_count": 0},
                legitimate_explanations_considered=[],
                contradictions_or_uncertainty=["AI investigation stream exception"],
                contradictory_evidence=["AI investigation stream exception"],
                missing_evidence=["AI stream data unavailable"],
                historical_matches=[],
                historical_pattern_summary="Historical lookup skipped in stream fallback",
                recommended_defensive_actions=["Maintain standard security monitoring", "Escalate high score incidents manually"],
                immediate_actions=["Maintain standard security monitoring"],
                containment_actions=["Escalate high score incidents manually"],
                recovery_actions=["Retry AI investigation"],
                resolution_conditions=["System recovery"],
                estimated_resolution_window="Immediate review",
                monitoring_requirements=["Standard deterministic telemetry"],
                analyst_questions=["Review system logs"],
                evidence_event_ids=incident.evidence_event_ids if incident else [],
                evidence_version=getattr(incident, "evidence_version", 1) if incident else 1,
                risk_score_reference=score,
                risk_score_source="RiskSūtra deterministic risk engine",
                model_version="ato-v0.2-day2",
                investigator_version="risksutra-ai-inv-fallback",
                generated_at=datetime.now(timezone.utc),
            )

            audit = InvestigationAuditRecord(
                audit_id=audit_id,
                incident_id=incident_id,
                merchant_id=merchant_id,
                evidence_version=getattr(incident, "evidence_version", 1) if incident else 1,
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
            try:
                persist_investigation(fallback_result, audit)
            except Exception as e_pers:
                logger.error(f"Fallback persist failed: {e_pers}")

            yield f"data: {json.dumps({'status': 'ERROR', 'error': str(e), 'investigation': fallback_result.model_dump(), 'audit': audit.model_dump()}, default=str)}\n\n"
