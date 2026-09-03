"""
RiskSūtra — Domain Schemas

Strongly-typed Pydantic models for every domain entity.
These are the contracts used across all layers: API, services, persistence, and risk engines.
"""

from __future__ import annotations

import enum
from datetime import datetime, timezone
from typing import Optional

from pydantic import BaseModel, Field


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


# ──────────────────────────────────────────────
# Enums
# ──────────────────────────────────────────────

class MerchantType(str, enum.Enum):
    RESTAURANT = "RESTAURANT"
    SAAS = "SAAS"
    FASHION = "FASHION"
    DIGITAL_SERVICES = "DIGITAL_SERVICES"


class EventType(str, enum.Enum):
    LOGIN = "LOGIN"
    LOGOUT = "LOGOUT"
    API_REQUEST = "API_REQUEST"
    DEVICE_SEEN = "DEVICE_SEEN"
    IP_CHANGE = "IP_CHANGE"
    TRANSACTION = "TRANSACTION"
    TRANSACTION_RESULT = "TRANSACTION_RESULT"
    CONFIG_CHANGE = "CONFIG_CHANGE"
    PAYOUT_EVENT = "PAYOUT_EVENT"
    ACCOUNT_ACTION = "ACCOUNT_ACTION"
    AUTH_FAILURE = "AUTH_FAILURE"


class Severity(str, enum.Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class RiskBand(str, enum.Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class IncidentStatus(str, enum.Enum):
    OPEN = "OPEN"
    INVESTIGATING = "INVESTIGATING"
    RESOLVED = "RESOLVED"
    FALSE_POSITIVE = "FALSE_POSITIVE"


# ──────────────────────────────────────────────
# Merchant
# ──────────────────────────────────────────────

class Merchant(BaseModel):
    merchant_id: str = Field(..., description="Unique merchant identifier (MER_xxxx)")
    merchant_name: str = Field(..., description="Business name")
    merchant_type: MerchantType
    country: str = Field(default="IN", description="Primary operating country")
    created_at: datetime = Field(default_factory=utc_now)
    profile_metadata: dict = Field(default_factory=dict, description="Archetype-specific metadata")


# ──────────────────────────────────────────────
# Event
# ──────────────────────────────────────────────

class Event(BaseModel):
    event_id: str = Field(..., description="Unique event identifier")
    merchant_id: str = Field(..., description="Owning merchant")
    timestamp: datetime = Field(..., description="When the event occurred")
    event_type: EventType

    # Identity context (optional)
    device_id: Optional[str] = None
    session_id: Optional[str] = None
    ip_address: Optional[str] = None
    country: Optional[str] = None
    asn: Optional[str] = None

    # Transaction context (optional)
    transaction_id: Optional[str] = None
    amount: Optional[float] = None
    currency: Optional[str] = None
    payment_method: Optional[str] = None

    # API context (optional)
    endpoint: Optional[str] = None
    api_key_id: Optional[str] = None

    # Action context (optional)
    action: Optional[str] = None
    resource: Optional[str] = None

    # Flexible metadata
    metadata: dict = Field(default_factory=dict)


# ──────────────────────────────────────────────
# Risk Signal
# ──────────────────────────────────────────────

class RiskSignal(BaseModel):
    signal_id: str = Field(..., description="Unique signal identifier")
    merchant_id: str
    timestamp: datetime = Field(default_factory=utc_now)
    signal_type: str = Field(..., description="E.g. NEW_DEVICE, HOUR_DEVIATION, API_BURST")
    value: float = Field(..., ge=0.0, le=1.0, description="Normalized severity 0-1")
    severity: Severity
    source: str = Field(default="baseline_engine", description="Engine that produced the signal")
    reason: Optional[str] = Field(default=None, description="Human/interpretable reason string")
    baseline_value: Optional[str] = Field(default=None, description="Historical baseline reference")
    observed_value: Optional[str] = Field(default=None, description="Observed current anomaly value")
    evidence_event_ids: list[str] = Field(default_factory=list)


# ──────────────────────────────────────────────
# Workflow Integrity
# ──────────────────────────────────────────────

class WorkflowResult(BaseModel):
    workflow_score: float = Field(default=0.0, ge=0.0, le=1.0, description="Suspicious transition score 0-1")
    matched_patterns: list[str] = Field(default_factory=list, description="E.g. NEW_DEVICE_TO_SENSITIVE_ACTION")
    transition_anomalies: list[dict] = Field(default_factory=list)
    chain_events: list[dict] = Field(default_factory=list)
    evidence_event_ids: list[str] = Field(default_factory=list)
    is_suspicious_sequence: bool = False


# ──────────────────────────────────────────────
# Fraud-Spike Assessment
# ──────────────────────────────────────────────

class FraudSpikeAssessment(BaseModel):
    spike_score: float = Field(default=0.0, ge=0.0, le=1.0)
    classification: str = Field(default="NORMAL", description="NORMAL, BENIGN_SALE_SPIKE, SUSPICIOUS_SPIKE")
    baseline_comparison: dict = Field(default_factory=dict)
    supporting_signals: list[str] = Field(default_factory=list)
    evidence_event_ids: list[str] = Field(default_factory=list)


# ──────────────────────────────────────────────
# Abuse Cluster (Graph Sentinel)
# ──────────────────────────────────────────────

class AbuseCluster(BaseModel):
    cluster_id: str = Field(..., description="Graph cluster ID")
    entity_count: int = 0
    shared_devices: int = 0
    shared_ips: int = 0
    merchants_involved: list[str] = Field(default_factory=list)
    risk_score: float = Field(default=0.0, ge=0.0, le=1.0)
    evidence_event_ids: list[str] = Field(default_factory=list)


# ──────────────────────────────────────────────
# Risk Assessment
# ──────────────────────────────────────────────

class RiskAssessment(BaseModel):
    merchant_id: str
    risk_score: float = Field(..., ge=0.0, le=100.0)
    risk_band: RiskBand
    top_signals: list[RiskSignal] = Field(default_factory=list)
    workflow_result: Optional[WorkflowResult] = None
    fraud_spike: Optional[FraudSpikeAssessment] = None
    abuse_cluster: Optional[AbuseCluster] = None
    attack_chain: list[str] = Field(default_factory=list)
    evidence_event_ids: list[str] = Field(default_factory=list)
    model_version: str = "ato-v0.2-day2"
    assessed_at: datetime = Field(default_factory=utc_now)


# ──────────────────────────────────────────────
# Incident
# ──────────────────────────────────────────────

class Incident(BaseModel):
    incident_id: str = Field(..., description="Unique incident identifier")
    merchant_id: str
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)
    status: IncidentStatus = IncidentStatus.OPEN
    incident_type: str = Field(default="ATO", description="Classification: ATO, FRAUD_SPIKE, ABUSE_CLUSTER")
    risk_score: float = Field(..., ge=0.0, le=100.0)
    risk_band: RiskBand
    signal_ids: list[str] = Field(default_factory=list)
    signals: list[RiskSignal] = Field(default_factory=list)
    attack_chain: list[str] = Field(default_factory=list)
    related_entities: dict = Field(default_factory=dict)
    evidence_event_ids: list[str] = Field(default_factory=list)
    evidence_version: int = Field(default=1, description="Snapshot version incremented on scenario/event changes")
    model_version: str = "ato-v0.2-day2"
    summary: str = Field(default="", description="Human-readable summary")


# ──────────────────────────────────────────────
# Merchant Behavioral Profile (Genome)
# ──────────────────────────────────────────────

class MerchantProfile(BaseModel):
    merchant_id: str
    typical_hours: dict = Field(default_factory=dict, description="Hour → event count distribution")
    day_of_week_distribution: dict = Field(default_factory=dict, description="Day of week → event count")
    known_devices: list[str] = Field(default_factory=list)
    known_countries: list[str] = Field(default_factory=list)
    known_asns: list[str] = Field(default_factory=list)
    known_ips: list[str] = Field(default_factory=list)
    api_rate_baseline: dict = Field(default_factory=dict, description="mean, std of API requests/hour")
    transaction_rate_baseline: dict = Field(default_factory=dict, description="mean, std of txn/hour")
    amount_statistics: dict = Field(default_factory=dict, description="p25, p50, p75, p95, max")
    endpoint_distribution: dict = Field(default_factory=dict, description="Endpoint → request count")
    event_frequency: dict = Field(default_factory=dict, description="Per event_type frequency stats")
    sensitive_action_count: int = 0
    total_events: int = 0
    baseline_window_start: Optional[datetime] = None
    baseline_window_end: Optional[datetime] = None


# ──────────────────────────────────────────────
# Evaluation Metrics
# ──────────────────────────────────────────────

class EvaluationMetrics(BaseModel):
    precision: float
    recall: float
    f1_score: float
    false_positive_rate: float
    false_positive_count: int
    false_negative_count: int
    true_positive_count: int
    true_negative_count: int
    detection_lead_time_seconds: float
    attack_chain_recall: float


# ──────────────────────────────────────────────
# Scenario Metadata (for synthetic injection)
# ──────────────────────────────────────────────

class ScenarioMetadata(BaseModel):
    scenario_id: str
    scenario_type: str = Field(..., description="ATO_CREDENTIAL_THEFT, ATO_CONTROL_PLANE, LEGITIMATE_SPIKE, ABUSE_RING")
    merchant_id: str
    attack_start_time: datetime
    attack_end_time: datetime
    injected_event_ids: list[str] = Field(default_factory=list)
    label: str = Field(default="attack", description="attack or benign")


# ──────────────────────────────────────────────
# Day 3: AI Investigator Schemas
# ──────────────────────────────────────────────

class AssessmentVerdict(str, enum.Enum):
    LIKELY_ATO = "LIKELY_ATO"
    SUSPICIOUS = "SUSPICIOUS"
    INCONCLUSIVE = "INCONCLUSIVE"
    LIKELY_BENIGN = "LIKELY_BENIGN"


class LegitimateStatus(str, enum.Enum):
    SUPPORTED = "SUPPORTED"
    WEAK = "WEAK"
    REJECTED = "REJECTED"


class AttackStage(BaseModel):
    stage: str = Field(..., description="E.g. New Device, Geo Deviation, Sensitive Config Change")
    event_ids: list[str] = Field(default_factory=list)
    explanation: str = Field(..., description="Why this event fits into the attack sequence")


class KeyEvidenceItem(BaseModel):
    event_id: str
    signal: str
    severity: Severity
    reason: str


class LegitimateExplanation(BaseModel):
    hypothesis: str = Field(..., description="E.g. Benign sale campaign, Known merchant travel")
    supporting_evidence: list[str] = Field(default_factory=list)
    counter_evidence: list[str] = Field(default_factory=list)
    status: LegitimateStatus = LegitimateStatus.REJECTED


class InvestigationContext(BaseModel):
    incident_id: str
    merchant_id: str
    merchant_name: str
    merchant_type: str
    country: str
    risk_score: float
    risk_band: RiskBand
    model_version: str
    evidence_version: int = 1
    top_signals: list[dict] = Field(default_factory=list)
    evidence_events: list[dict] = Field(default_factory=list)
    genome_baseline: dict = Field(default_factory=dict)
    workflow_matches: list[str] = Field(default_factory=list)
    fraud_spike_classification: Optional[str] = None
    abuse_cluster_info: Optional[dict] = None
    related_incidents_count: int = 0


class AIInvestigationResult(BaseModel):
    incident_id: str
    assessment: AssessmentVerdict
    confidence: float = Field(..., ge=0.0, le=1.0)
    summary: str = Field(..., description="High-level narrative summary")
    why_this_matters: str = Field(..., description="Analyst justification")
    attack_progression: list[AttackStage] = Field(default_factory=list)
    key_evidence: list[KeyEvidenceItem] = Field(default_factory=list)
    behavioral_deviation: dict = Field(default_factory=dict, description="{summary: ..., deviations: [...]}")
    workflow_assessment: dict = Field(default_factory=dict, description="{matched_pattern: ..., transition_anomalies: [...], assessment: ...}")
    legitimate_explanations_considered: list[LegitimateExplanation] = Field(default_factory=list)
    contradictions_or_uncertainty: list[str] = Field(default_factory=list)
    recommended_defensive_actions: list[str] = Field(default_factory=list)
    risk_score_reference: float
    risk_score_source: str = "RiskSūtra deterministic risk engine"
    model_version: str = "ato-v0.2-day2"
    investigator_version: str = "risksutra-ai-inv-v1"
    evidence_event_ids: list[str] = Field(default_factory=list)
    generated_at: datetime = Field(default_factory=utc_now)


class InvestigationAuditRecord(BaseModel):
    audit_id: str
    incident_id: str
    merchant_id: str
    investigator_version: str = "risksutra-ai-inv-v1"
    provider: str
    model_name: str
    start_time: datetime
    end_time: datetime
    duration_ms: float
    tools_called: list[str] = Field(default_factory=list)
    evidence_count: int = 0
    assessment: AssessmentVerdict
    confidence: float
    is_fallback: bool = False
    error_message: Optional[str] = None

