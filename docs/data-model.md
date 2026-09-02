# RiskSūtra — Data Model

## Domain Entities

### Merchant
Represents a business using the payment platform.

| Field | Type | Description |
|-------|------|-------------|
| merchant_id | str | Unique identifier (MER_xxxx) |
| merchant_name | str | Business name |
| merchant_type | enum | RESTAURANT, SAAS, FASHION, DIGITAL_SERVICES |
| country | str | Primary operating country |
| created_at | datetime | Account creation timestamp |
| profile_metadata | dict | Archetype-specific metadata |

### Event
A single operational event from a merchant's activity stream.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| event_id | str | Yes | Unique event identifier |
| merchant_id | str | Yes | Owning merchant |
| timestamp | datetime | Yes | When the event occurred |
| event_type | enum | Yes | Event classification |
| device_id | str | No | Device fingerprint |
| session_id | str | No | Session identifier |
| ip_address | str | No | Source IP |
| country | str | No | Geo-resolved country |
| asn | str | No | Autonomous system number |
| transaction_id | str | No | Associated transaction |
| amount | float | No | Transaction amount |
| currency | str | No | Currency code |
| payment_method | str | No | Payment method used |
| endpoint | str | No | API endpoint accessed |
| api_key_id | str | No | API key used |
| action | str | No | Action performed |
| resource | str | No | Resource affected |
| metadata | dict | No | Additional context |

### Event Types

```
LOGIN, LOGOUT, API_REQUEST, DEVICE_SEEN, IP_CHANGE,
TRANSACTION, TRANSACTION_RESULT, CONFIG_CHANGE,
PAYOUT_EVENT, ACCOUNT_ACTION, AUTH_FAILURE
```

### Risk Signal
A typed observation produced by a detection engine.

| Field | Type | Description |
|-------|------|-------------|
| signal_id | str | Unique signal identifier |
| merchant_id | str | Affected merchant |
| timestamp | datetime | When signal was generated |
| signal_type | str | Classification of the signal |
| value | float | Normalized severity (0.0–1.0) |
| severity | enum | LOW, MEDIUM, HIGH, CRITICAL |
| source | str | Engine that produced the signal |
| evidence_event_ids | list[str] | Supporting events |

### Incident
A risk incident requiring attention.

| Field | Type | Description |
|-------|------|-------------|
| incident_id | str | Unique identifier |
| merchant_id | str | Affected merchant |
| created_at | datetime | Incident creation time |
| status | enum | OPEN, INVESTIGATING, RESOLVED, FALSE_POSITIVE |
| incident_type | str | Classification (ATO, FRAUD_SPIKE, etc.) |
| risk_score | float | Composite score at creation |
| risk_band | enum | LOW, MEDIUM, HIGH, CRITICAL |
| signal_ids | list[str] | Contributing signals |
| evidence_event_ids | list[str] | Supporting events |
| summary | str | Human-readable summary |

### Merchant Behavioral Profile
Statistical baseline of a merchant's normal operations.

| Field | Type | Description |
|-------|------|-------------|
| merchant_id | str | Merchant identifier |
| typical_hours | dict | Hour-of-day activity distribution |
| known_devices | set[str] | Historically seen devices |
| known_countries | set[str] | Historically seen countries |
| known_asns | set[str] | Historically seen ASNs |
| api_rate_baseline | dict | Mean/std of API request rate |
| transaction_rate_baseline | dict | Mean/std of transaction rate |
| amount_statistics | dict | Quantiles of transaction amounts |
| event_frequency | dict | Per-type event frequency stats |
| sensitive_action_count | int | Historical sensitive action count |
| total_events | int | Total historical events |
| baseline_window_start | datetime | Profile start time |
| baseline_window_end | datetime | Profile end time |
