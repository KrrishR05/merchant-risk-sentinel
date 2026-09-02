"""
RiskSūtra — Domain Schemas

Strongly-typed Pydantic models for every domain entity.
These are the contracts used across all layers: API, services, persistence, and risk engines.
"""

from __future__ import annotations

import enum
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


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
    created_at: datetime = Field(default_factory=datetime.utcnow)
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
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    signal_type: str = Field(..., description="E.g. NEW_DEVICE, HOUR_DEVIATION, API_BURST")
    value: float = Field(..., ge=0.0, le=1.0, description="Normalized severity 0-1")
    severity: Severity
    source: str = Field(default="baseline_engine", description="Engine that produced the signal")
    evidence_event_ids: list[str] = Field(default_factory=list)


# ──────────────────────────────────────────────
# Risk Assessment
# ──────────────────────────────────────────────

class RiskAssessment(BaseModel):
    merchant_id: str
    risk_score: float = Field(..., ge=0.0, le=100.0)
    risk_band: RiskBand
    top_signals: list[RiskSignal] = Field(default_factory=list)
    evidence_event_ids: list[str] = Field(default_factory=list)
    model_version: str = "v0.1.0-statistical"
    assessed_at: datetime = Field(default_factory=datetime.utcnow)


# ──────────────────────────────────────────────
# Incident
# ──────────────────────────────────────────────

class Incident(BaseModel):
    incident_id: str = Field(..., description="Unique incident identifier")
    merchant_id: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    status: IncidentStatus = IncidentStatus.OPEN
    incident_type: str = Field(default="ATO", description="Classification: ATO, FRAUD_SPIKE, etc.")
    risk_score: float = Field(..., ge=0.0, le=100.0)
    risk_band: RiskBand
    signal_ids: list[str] = Field(default_factory=list)
    evidence_event_ids: list[str] = Field(default_factory=list)
    summary: str = Field(default="", description="Human-readable summary (populated by AI later)")


# ──────────────────────────────────────────────
# Merchant Behavioral Profile
# ──────────────────────────────────────────────

class MerchantProfile(BaseModel):
    merchant_id: str
    typical_hours: dict = Field(default_factory=dict, description="Hour → event count distribution")
    known_devices: list[str] = Field(default_factory=list)
    known_countries: list[str] = Field(default_factory=list)
    known_asns: list[str] = Field(default_factory=list)
    api_rate_baseline: dict = Field(default_factory=dict, description="mean, std of API requests/hour")
    transaction_rate_baseline: dict = Field(default_factory=dict, description="mean, std of txn/hour")
    amount_statistics: dict = Field(default_factory=dict, description="p25, p50, p75, p95, max")
    event_frequency: dict = Field(default_factory=dict, description="Per event_type frequency stats")
    sensitive_action_count: int = 0
    total_events: int = 0
    baseline_window_start: Optional[datetime] = None
    baseline_window_end: Optional[datetime] = None


# ──────────────────────────────────────────────
# Scenario Metadata (for synthetic injection)
# ──────────────────────────────────────────────

class ScenarioMetadata(BaseModel):
    scenario_id: str
    scenario_type: str = Field(..., description="ATO_CREDENTIAL_THEFT, ATO_CONTROL_PLANE, LEGITIMATE_SPIKE")
    merchant_id: str
    attack_start_time: datetime
    attack_end_time: datetime
    injected_event_ids: list[str] = Field(default_factory=list)
    label: str = Field(default="attack", description="attack or benign")
