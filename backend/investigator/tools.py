"""
RiskSūtra — AI Investigator Tools

Bounded evidence retrieval tools executed by the AI Investigator agent.
These tools interact safely with the deterministic risk engines and database repositories,
enforcing strict input validation, size bounding, and error resilience.
"""

import logging
from typing import Any, Dict, List, Optional
from db import database as db
from risk.baseline_engine import build_merchant_profile, compute_deviation_signals
from risk.workflow_engine import WorkflowIntegrityEngine
from risk.fraud_spike_detector import FraudSpikeDetector
from graph.abuse_sentinel import GraphService
from investigator.context import build_investigation_context

logger = logging.getLogger("risksutra.investigator.tools")

_workflow_engine = WorkflowIntegrityEngine()
_fraud_spike_detector = FraudSpikeDetector()
_graph_service = GraphService()


class InvestigatorTools:
    """Registry of deterministic tools accessible to the AI Investigator."""

    @staticmethod
    def get_incident_context(incident_id: str) -> Dict[str, Any]:
        """Fetch incident metadata, top risk signals, and baseline context."""
        try:
            if not incident_id or not isinstance(incident_id, str):
                return {"error": "Invalid incident_id"}
            ctx = build_investigation_context(incident_id)
            return ctx.model_dump()
        except Exception as e:
            logger.error(f"Error in get_incident_context: {e}")
            return {"error": f"Failed to retrieve incident context: {str(e)}"}

    @staticmethod
    def get_merchant_behavior(merchant_id: str) -> Dict[str, Any]:
        """Fetch merchant behavioral genome baseline profile."""
        try:
            if not merchant_id or not isinstance(merchant_id, str):
                return {"error": "Invalid merchant_id"}
            events = db.get_merchant_events(merchant_id)
            if not events:
                return {"merchant_id": merchant_id, "status": "NO_HISTORICAL_DATA"}
            profile = build_merchant_profile(merchant_id, events)
            return profile.model_dump()
        except Exception as e:
            logger.error(f"Error in get_merchant_behavior: {e}")
            return {"error": f"Failed to retrieve merchant behavior: {str(e)}"}

    @staticmethod
    def get_recent_events(merchant_id: str, limit: int = 20) -> Dict[str, Any]:
        """Fetch recent events for a merchant, bounded to max 50."""
        try:
            if not merchant_id or not isinstance(merchant_id, str):
                return {"error": "Invalid merchant_id"}
            safe_limit = max(1, min(int(limit), 50))
            events = db.get_recent_events(merchant_id, limit=safe_limit)
            return {
                "merchant_id": merchant_id,
                "count": len(events),
                "events": [e.model_dump() for e in events],
            }
        except Exception as e:
            logger.error(f"Error in get_recent_events: {e}")
            return {"error": f"Failed to retrieve recent events: {str(e)}"}

    @staticmethod
    def get_event_details(event_ids: List[str]) -> Dict[str, Any]:
        """Fetch full details for specified event IDs, bounded to max 20 events."""
        try:
            if not event_ids or not isinstance(event_ids, list):
                return {"error": "event_ids must be a non-empty list of strings"}
            safe_ids = [str(eid) for eid in event_ids[:20]]
            events = db.get_events_by_ids(safe_ids)
            return {
                "requested_count": len(safe_ids),
                "found_count": len(events),
                "events": [e.model_dump() for e in events],
            }
        except Exception as e:
            logger.error(f"Error in get_event_details: {e}")
            return {"error": f"Failed to retrieve event details: {str(e)}"}

    @staticmethod
    def get_risk_signals(merchant_id: str) -> Dict[str, Any]:
        """Fetch historical risk signals and reasons for a merchant."""
        try:
            if not merchant_id or not isinstance(merchant_id, str):
                return {"error": "Invalid merchant_id"}
            signals = db.get_merchant_signals(merchant_id, limit=30)
            return {
                "merchant_id": merchant_id,
                "signal_count": len(signals),
                "signals": [s.model_dump() for s in signals],
            }
        except Exception as e:
            logger.error(f"Error in get_risk_signals: {e}")
            return {"error": f"Failed to retrieve risk signals: {str(e)}"}

    @staticmethod
    def get_temporal_workflow(merchant_id: str) -> Dict[str, Any]:
        """Evaluate temporal workflow integrity for recent event sequences."""
        try:
            if not merchant_id or not isinstance(merchant_id, str):
                return {"error": "Invalid merchant_id"}
            events = db.get_merchant_events(merchant_id)
            if not events:
                return {"merchant_id": merchant_id, "workflow_score": 0.0, "matched_patterns": []}
            profile = build_merchant_profile(merchant_id, events)
            recent_events = events[-30:] if len(events) > 30 else events
            signals = compute_deviation_signals(profile, recent_events)
            wf_res = _workflow_engine.evaluate(profile, recent_events, signals)
            return wf_res.model_dump()
        except Exception as e:
            logger.error(f"Error in get_temporal_workflow: {e}")
            return {"error": f"Failed to evaluate temporal workflow: {str(e)}"}

    @staticmethod
    def get_entity_relationships(merchant_id: str) -> Dict[str, Any]:
        """Check Graph Abuse Sentinel for multi-merchant device/IP sharing."""
        try:
            if not merchant_id or not isinstance(merchant_id, str):
                return {"error": "Invalid merchant_id"}
            cluster = _graph_service.get_merchant_cluster(merchant_id)
            if not cluster:
                return {
                    "merchant_id": merchant_id,
                    "has_syndicate_cluster": False,
                    "cluster": None,
                }
            return {
                "merchant_id": merchant_id,
                "has_syndicate_cluster": True,
                "cluster": cluster.model_dump(),
            }
        except Exception as e:
            logger.error(f"Error in get_entity_relationships: {e}")
            return {"error": f"Failed to check entity relationships: {str(e)}"}

    @staticmethod
    def get_related_incidents(merchant_id: str) -> Dict[str, Any]:
        """Fetch all prior incidents for a merchant."""
        try:
            if not merchant_id or not isinstance(merchant_id, str):
                return {"error": "Invalid merchant_id"}
            incidents = db.get_merchant_incidents(merchant_id)
            return {
                "merchant_id": merchant_id,
                "incident_count": len(incidents),
                "incidents": [i.model_dump() for i in incidents],
            }
        except Exception as e:
            logger.error(f"Error in get_related_incidents: {e}")
            return {"error": f"Failed to retrieve related incidents: {str(e)}"}

    @staticmethod
    def get_transaction_context(merchant_id: str) -> Dict[str, Any]:
        """Analyze transaction velocity and amount anomalies against baseline."""
        try:
            if not merchant_id or not isinstance(merchant_id, str):
                return {"error": "Invalid merchant_id"}
            events = db.get_merchant_events(merchant_id)
            if not events:
                return {"merchant_id": merchant_id, "transaction_events": 0}
            txn_events = [e for e in events if e.event_type.value == "TRANSACTION"]
            amounts = [e.amount for e in txn_events if e.amount is not None]

            profile = build_merchant_profile(merchant_id, events)
            recent_events = events[-30:]
            signals = compute_deviation_signals(profile, recent_events)
            fs_res = _fraud_spike_detector.evaluate(profile, recent_events, signals)

            return {
                "merchant_id": merchant_id,
                "total_transactions": len(txn_events),
                "amount_max": max(amounts) if amounts else 0.0,
                "amount_avg": sum(amounts) / len(amounts) if amounts else 0.0,
                "fraud_spike_classification": fs_res.classification,
                "spike_score": fs_res.spike_score,
                "supporting_signals": fs_res.supporting_signals,
            }
        except Exception as e:
            logger.error(f"Error in get_transaction_context: {e}")
            return {"error": f"Failed to retrieve transaction context: {str(e)}"}

    @staticmethod
    def compare_with_merchant_baseline(merchant_id: str, event_ids: List[str]) -> Dict[str, Any]:
        """Compare specific event attributes against the merchant's known baseline."""
        try:
            if not merchant_id or not isinstance(merchant_id, str):
                return {"error": "Invalid merchant_id"}
            if not event_ids or not isinstance(event_ids, list):
                return {"error": "event_ids must be a non-empty list of strings"}

            events = db.get_merchant_events(merchant_id)
            profile = build_merchant_profile(merchant_id, events)
            target_events = db.get_events_by_ids(event_ids[:20])

            deviations = []
            for e in target_events:
                dev = {"event_id": e.event_id, "event_type": e.event_type.value, "anomalies": []}
                if e.device_id and e.device_id not in profile.known_devices:
                    dev["anomalies"].append(f"Unseen device: {e.device_id}")
                if e.country and profile.known_countries and e.country not in profile.known_countries:
                    dev["anomalies"].append(f"Geographic deviation: {e.country} (baseline: {profile.known_countries})")
                if e.asn and profile.known_asns and e.asn not in profile.known_asns:
                    dev["anomalies"].append(f"Unseen ASN: {e.asn}")
                if e.amount and profile.amount_statistics.get("p95"):
                    p95 = profile.amount_statistics["p95"]
                    if e.amount > p95 * 2.0:
                        dev["anomalies"].append(f"Amount {e.amount} significantly exceeds baseline p95 ({p95})")
                deviations.append(dev)

            return {
                "merchant_id": merchant_id,
                "evaluated_event_count": len(target_events),
                "deviations": deviations,
            }
        except Exception as e:
            logger.error(f"Error in compare_with_merchant_baseline: {e}")
            return {"error": f"Failed to compare baseline: {str(e)}"}


AVAILABLE_TOOLS = {
    "get_incident_context": InvestigatorTools.get_incident_context,
    "get_merchant_behavior": InvestigatorTools.get_merchant_behavior,
    "get_recent_events": InvestigatorTools.get_recent_events,
    "get_event_details": InvestigatorTools.get_event_details,
    "get_risk_signals": InvestigatorTools.get_risk_signals,
    "get_temporal_workflow": InvestigatorTools.get_temporal_workflow,
    "get_entity_relationships": InvestigatorTools.get_entity_relationships,
    "get_related_incidents": InvestigatorTools.get_related_incidents,
    "get_transaction_context": InvestigatorTools.get_transaction_context,
    "compare_with_merchant_baseline": InvestigatorTools.compare_with_merchant_baseline,
}
