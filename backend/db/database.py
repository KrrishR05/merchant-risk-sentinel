"""
RiskSūtra — Database Layer

Dual-mode persistence layer supporting both PostgreSQL (production) and SQLite (development).

Controlled by DB_TYPE environment variable:
  - DB_TYPE=postgresql  → uses psycopg2 with DATABASE_URL
  - DB_TYPE=sqlite      → uses sqlite3 with local file (default for dev)

Repository-pattern abstraction so callers never know which backend is active.
"""

import json
import os
import sqlite3
import logging
from datetime import datetime
from typing import Optional

logger = logging.getLogger("risksutra.db")

# ──────────────────────────────────────────────
# Configuration
# ──────────────────────────────────────────────

DB_TYPE = os.environ.get("DB_TYPE", "sqlite").lower()  # "postgresql" or "sqlite"
DATABASE_URL = os.environ.get("DATABASE_URL", "")
SQLITE_PATH = os.environ.get(
    "SQLITE_PATH",
    os.path.join(os.path.dirname(__file__), "..", "..", "data", "risksutra.db"),
)

# Keep legacy compat
DB_PATH = SQLITE_PATH

# Lazy-loaded psycopg2 — only imported when DB_TYPE=postgresql
_pg_pool = None


def _ensure_dir(path: str):
    d = os.path.dirname(path)
    if d:
        os.makedirs(d, exist_ok=True)


# ──────────────────────────────────────────────
# Connection Management
# ──────────────────────────────────────────────

def _get_pg_connection():
    """Get a PostgreSQL connection using psycopg2."""
    global _pg_pool
    try:
        import psycopg2
        import psycopg2.extras
    except ImportError:
        raise RuntimeError(
            "psycopg2-binary is required for PostgreSQL mode. "
            "Install with: pip install psycopg2-binary"
        )

    if not DATABASE_URL:
        raise RuntimeError(
            "DATABASE_URL environment variable is required for PostgreSQL mode. "
            "Example: postgresql://user:password@localhost:5432/risksutra"
        )

    conn = psycopg2.connect(DATABASE_URL)
    conn.autocommit = False
    return conn


def _get_sqlite_connection() -> sqlite3.Connection:
    """Get a SQLite connection."""
    _ensure_dir(SQLITE_PATH)
    conn = sqlite3.connect(SQLITE_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def get_connection():
    """Get a database connection based on DB_TYPE."""
    if DB_TYPE == "postgresql":
        return _get_pg_connection()
    else:
        return _get_sqlite_connection()


# ──────────────────────────────────────────────
# Schema Initialization
# ──────────────────────────────────────────────

_PG_SCHEMA = """
CREATE TABLE IF NOT EXISTS merchants (
    merchant_id TEXT PRIMARY KEY,
    merchant_name TEXT NOT NULL,
    merchant_type TEXT NOT NULL,
    country TEXT DEFAULT 'IN',
    created_at TIMESTAMP NOT NULL,
    profile_metadata JSONB DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS events (
    event_id TEXT PRIMARY KEY,
    merchant_id TEXT NOT NULL REFERENCES merchants(merchant_id),
    timestamp TIMESTAMP NOT NULL,
    event_type TEXT NOT NULL,
    device_id TEXT,
    session_id TEXT,
    ip_address TEXT,
    country TEXT,
    asn TEXT,
    transaction_id TEXT,
    amount DOUBLE PRECISION,
    currency TEXT,
    payment_method TEXT,
    endpoint TEXT,
    api_key_id TEXT,
    action TEXT,
    resource TEXT,
    metadata JSONB DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS risk_signals (
    signal_id TEXT PRIMARY KEY,
    merchant_id TEXT NOT NULL REFERENCES merchants(merchant_id),
    timestamp TIMESTAMP NOT NULL,
    signal_type TEXT NOT NULL,
    value DOUBLE PRECISION NOT NULL,
    severity TEXT NOT NULL,
    source TEXT DEFAULT 'baseline_engine',
    evidence_event_ids JSONB DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS incidents (
    incident_id TEXT PRIMARY KEY,
    merchant_id TEXT NOT NULL REFERENCES merchants(merchant_id),
    created_at TIMESTAMP NOT NULL,
    status TEXT DEFAULT 'OPEN',
    incident_type TEXT DEFAULT 'ATO',
    risk_score DOUBLE PRECISION NOT NULL,
    risk_band TEXT NOT NULL,
    signal_ids JSONB DEFAULT '[]',
    evidence_event_ids JSONB DEFAULT '[]',
    summary TEXT DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_events_merchant ON events(merchant_id);
CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp);
CREATE INDEX IF NOT EXISTS idx_events_merchant_ts ON events(merchant_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_signals_merchant ON risk_signals(merchant_id);
CREATE INDEX IF NOT EXISTS idx_incidents_merchant ON incidents(merchant_id);
"""

_SQLITE_SCHEMA = """
CREATE TABLE IF NOT EXISTS merchants (
    merchant_id TEXT PRIMARY KEY,
    merchant_name TEXT NOT NULL,
    merchant_type TEXT NOT NULL,
    country TEXT DEFAULT 'IN',
    created_at TEXT NOT NULL,
    profile_metadata TEXT DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS events (
    event_id TEXT PRIMARY KEY,
    merchant_id TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    event_type TEXT NOT NULL,
    device_id TEXT,
    session_id TEXT,
    ip_address TEXT,
    country TEXT,
    asn TEXT,
    transaction_id TEXT,
    amount REAL,
    currency TEXT,
    payment_method TEXT,
    endpoint TEXT,
    api_key_id TEXT,
    action TEXT,
    resource TEXT,
    metadata TEXT DEFAULT '{}',
    FOREIGN KEY (merchant_id) REFERENCES merchants(merchant_id)
);

CREATE TABLE IF NOT EXISTS risk_signals (
    signal_id TEXT PRIMARY KEY,
    merchant_id TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    signal_type TEXT NOT NULL,
    value REAL NOT NULL,
    severity TEXT NOT NULL,
    source TEXT DEFAULT 'baseline_engine',
    evidence_event_ids TEXT DEFAULT '[]',
    FOREIGN KEY (merchant_id) REFERENCES merchants(merchant_id)
);

CREATE TABLE IF NOT EXISTS incidents (
    incident_id TEXT PRIMARY KEY,
    merchant_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    status TEXT DEFAULT 'OPEN',
    incident_type TEXT DEFAULT 'ATO',
    risk_score REAL NOT NULL,
    risk_band TEXT NOT NULL,
    signal_ids TEXT DEFAULT '[]',
    evidence_event_ids TEXT DEFAULT '[]',
    summary TEXT DEFAULT '',
    FOREIGN KEY (merchant_id) REFERENCES merchants(merchant_id)
);

CREATE INDEX IF NOT EXISTS idx_events_merchant ON events(merchant_id);
CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp);
CREATE INDEX IF NOT EXISTS idx_events_merchant_ts ON events(merchant_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_signals_merchant ON risk_signals(merchant_id);
CREATE INDEX IF NOT EXISTS idx_incidents_merchant ON incidents(merchant_id);
"""


def init_db():
    """Create all tables if they don't exist."""
    conn = get_connection()
    try:
        if DB_TYPE == "postgresql":
            cur = conn.cursor()
            cur.execute(_PG_SCHEMA)
            conn.commit()
            cur.close()
            logger.info("PostgreSQL database initialized")
        else:
            conn.executescript(_SQLITE_SCHEMA)
            conn.commit()
            logger.info("SQLite database initialized")
    finally:
        conn.close()


# ──────────────────────────────────────────────
# Helper: row → dict (works for both PG and SQLite)
# ──────────────────────────────────────────────

def _row_to_dict(row, columns: list[str]) -> dict:
    """Convert a database row to a dictionary."""
    if isinstance(row, sqlite3.Row):
        return dict(row)
    # psycopg2 tuple result
    return {col: val for col, val in zip(columns, row)}


def _fetchall_as_dicts(cursor, columns: list[str]) -> list[dict]:
    """Fetch all rows from cursor as list of dicts."""
    rows = cursor.fetchall()
    if not rows:
        return []
    if isinstance(rows[0], sqlite3.Row):
        return [dict(r) for r in rows]
    return [{col: val for col, val in zip(columns, row)} for row in rows]


def _execute(conn, query: str, params: tuple | list = ()):
    """Execute a query that works with both SQLite and PostgreSQL.
    Handles placeholder conversion: SQLite uses ?, PostgreSQL uses %s.
    """
    if DB_TYPE == "postgresql":
        # Convert ? placeholders to %s for PostgreSQL
        query = query.replace("?", "%s")
        cur = conn.cursor()
        cur.execute(query, params)
        return cur
    else:
        return conn.execute(query, params)


def _commit_and_close(conn):
    """Commit and close connection."""
    conn.commit()
    conn.close()


# ──────────────────────────────────────────────
# JSON helpers (PG uses native JSONB, SQLite uses TEXT)
# ──────────────────────────────────────────────

def _to_json_field(value) -> str:
    """Serialize a Python object for storage."""
    if DB_TYPE == "postgresql":
        import psycopg2.extras
        return json.dumps(value) if not isinstance(value, str) else value
    return json.dumps(value) if not isinstance(value, str) else value


def _from_json_field(value):
    """Deserialize a JSON field from storage."""
    if value is None:
        return {}
    if isinstance(value, (dict, list)):
        return value  # PostgreSQL JSONB already returns Python objects
    return json.loads(value)


# ──────────────────────────────────────────────
# Imports for schema types
# ──────────────────────────────────────────────

from models.schemas import (
    Event, EventType, Incident, IncidentStatus, Merchant, MerchantProfile,
    MerchantType, RiskBand, RiskSignal, Severity,
)

MERCHANT_COLS = ["merchant_id", "merchant_name", "merchant_type", "country", "created_at", "profile_metadata"]
EVENT_COLS = [
    "event_id", "merchant_id", "timestamp", "event_type",
    "device_id", "session_id", "ip_address", "country", "asn",
    "transaction_id", "amount", "currency", "payment_method",
    "endpoint", "api_key_id", "action", "resource", "metadata",
]
SIGNAL_COLS = ["signal_id", "merchant_id", "timestamp", "signal_type", "value", "severity", "source", "evidence_event_ids"]
INCIDENT_COLS = ["incident_id", "merchant_id", "created_at", "status", "incident_type", "risk_score", "risk_band", "signal_ids", "evidence_event_ids", "summary"]


# ──────────────────────────────────────────────
# Merchant Repository
# ──────────────────────────────────────────────

def save_merchant(merchant: Merchant):
    conn = get_connection()
    try:
        # Use upsert approach
        if DB_TYPE == "postgresql":
            cur = conn.cursor()
            cur.execute(
                """INSERT INTO merchants (merchant_id, merchant_name, merchant_type, country, created_at, profile_metadata)
                   VALUES (%s, %s, %s, %s, %s, %s)
                   ON CONFLICT (merchant_id) DO UPDATE SET
                     merchant_name = EXCLUDED.merchant_name,
                     merchant_type = EXCLUDED.merchant_type,
                     country = EXCLUDED.country,
                     created_at = EXCLUDED.created_at,
                     profile_metadata = EXCLUDED.profile_metadata""",
                (
                    merchant.merchant_id,
                    merchant.merchant_name,
                    merchant.merchant_type.value,
                    merchant.country,
                    merchant.created_at,
                    json.dumps(merchant.profile_metadata),
                ),
            )
            cur.close()
        else:
            conn.execute(
                "INSERT OR REPLACE INTO merchants VALUES (?, ?, ?, ?, ?, ?)",
                (
                    merchant.merchant_id,
                    merchant.merchant_name,
                    merchant.merchant_type.value,
                    merchant.country,
                    merchant.created_at.isoformat(),
                    json.dumps(merchant.profile_metadata),
                ),
            )
        _commit_and_close(conn)
    except Exception:
        conn.close()
        raise


def get_merchant(merchant_id: str) -> Optional[Merchant]:
    conn = get_connection()
    try:
        cur = _execute(conn, "SELECT * FROM merchants WHERE merchant_id = ?", (merchant_id,))
        rows = _fetchall_as_dicts(cur, MERCHANT_COLS)
        if DB_TYPE == "postgresql":
            cur.close()
        conn.close()
        if not rows:
            return None
        return _dict_to_merchant(rows[0])
    except Exception:
        conn.close()
        raise


def get_all_merchants() -> list[Merchant]:
    conn = get_connection()
    try:
        cur = _execute(conn, "SELECT * FROM merchants")
        rows = _fetchall_as_dicts(cur, MERCHANT_COLS)
        if DB_TYPE == "postgresql":
            cur.close()
        conn.close()
        return [_dict_to_merchant(r) for r in rows]
    except Exception:
        conn.close()
        raise


def _dict_to_merchant(d: dict) -> Merchant:
    created_at = d["created_at"]
    if isinstance(created_at, str):
        created_at = datetime.fromisoformat(created_at)
    return Merchant(
        merchant_id=d["merchant_id"],
        merchant_name=d["merchant_name"],
        merchant_type=MerchantType(d["merchant_type"]),
        country=d["country"],
        created_at=created_at,
        profile_metadata=_from_json_field(d["profile_metadata"]),
    )


# ──────────────────────────────────────────────
# Event Repository
# ──────────────────────────────────────────────

def save_event(event: Event) -> bool:
    """Save event. Returns False if duplicate event_id (deduplicated)."""
    conn = get_connection()
    try:
        cur = _execute(conn, "SELECT 1 FROM events WHERE event_id = ?", (event.event_id,))
        existing = cur.fetchone()
        if DB_TYPE == "postgresql":
            cur.close()
        if existing:
            conn.close()
            return False

        _insert_event(conn, event)
        _commit_and_close(conn)
        return True
    except Exception:
        conn.close()
        raise


def save_events_bulk(events: list[Event]) -> int:
    """Bulk insert events, deduplicating. Returns count of newly inserted."""
    conn = get_connection()
    inserted = 0
    try:
        for event in events:
            cur = _execute(conn, "SELECT 1 FROM events WHERE event_id = ?", (event.event_id,))
            existing = cur.fetchone()
            if DB_TYPE == "postgresql":
                cur.close()
            if existing:
                continue
            _insert_event(conn, event)
            inserted += 1
        _commit_and_close(conn)
        return inserted
    except Exception:
        conn.close()
        raise


def _insert_event(conn, event: Event):
    """Insert a single event into the database."""
    ts = event.timestamp if DB_TYPE == "postgresql" else event.timestamp.isoformat()
    meta = json.dumps(event.metadata)

    if DB_TYPE == "postgresql":
        cur = conn.cursor()
        cur.execute(
            """INSERT INTO events (event_id, merchant_id, timestamp, event_type,
               device_id, session_id, ip_address, country, asn,
               transaction_id, amount, currency, payment_method,
               endpoint, api_key_id, action, resource, metadata)
               VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
            (
                event.event_id, event.merchant_id, ts, event.event_type.value,
                event.device_id, event.session_id, event.ip_address, event.country, event.asn,
                event.transaction_id, event.amount, event.currency, event.payment_method,
                event.endpoint, event.api_key_id, event.action, event.resource, meta,
            ),
        )
        cur.close()
    else:
        conn.execute(
            "INSERT INTO events VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (
                event.event_id, event.merchant_id, ts, event.event_type.value,
                event.device_id, event.session_id, event.ip_address, event.country, event.asn,
                event.transaction_id, event.amount, event.currency, event.payment_method,
                event.endpoint, event.api_key_id, event.action, event.resource, meta,
            ),
        )


def get_merchant_events(
    merchant_id: str,
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
    limit: int = 500,
) -> list[Event]:
    conn = get_connection()
    try:
        query = "SELECT * FROM events WHERE merchant_id = ?"
        params: list = [merchant_id]

        if start_time:
            query += " AND timestamp >= ?"
            params.append(start_time.isoformat() if DB_TYPE != "postgresql" else start_time)
        if end_time:
            query += " AND timestamp <= ?"
            params.append(end_time.isoformat() if DB_TYPE != "postgresql" else end_time)

        query += " ORDER BY timestamp ASC LIMIT ?"
        params.append(limit)

        cur = _execute(conn, query, params)
        rows = _fetchall_as_dicts(cur, EVENT_COLS)
        if DB_TYPE == "postgresql":
            cur.close()
        conn.close()
        return [_dict_to_event(r) for r in rows]
    except Exception:
        conn.close()
        raise


def get_recent_events(merchant_id: str, limit: int = 50) -> list[Event]:
    conn = get_connection()
    try:
        cur = _execute(
            conn,
            "SELECT * FROM events WHERE merchant_id = ? ORDER BY timestamp DESC LIMIT ?",
            (merchant_id, limit),
        )
        rows = _fetchall_as_dicts(cur, EVENT_COLS)
        if DB_TYPE == "postgresql":
            cur.close()
        conn.close()
        return [_dict_to_event(r) for r in rows]
    except Exception:
        conn.close()
        raise


def get_all_events(limit: int = 200) -> list[Event]:
    conn = get_connection()
    try:
        cur = _execute(conn, "SELECT * FROM events ORDER BY timestamp DESC LIMIT ?", (limit,))
        rows = _fetchall_as_dicts(cur, EVENT_COLS)
        if DB_TYPE == "postgresql":
            cur.close()
        conn.close()
        return [_dict_to_event(r) for r in rows]
    except Exception:
        conn.close()
        raise


def _dict_to_event(d: dict) -> Event:
    ts = d["timestamp"]
    if isinstance(ts, str):
        ts = datetime.fromisoformat(ts)
    return Event(
        event_id=d["event_id"],
        merchant_id=d["merchant_id"],
        timestamp=ts,
        event_type=EventType(d["event_type"]),
        device_id=d["device_id"],
        session_id=d["session_id"],
        ip_address=d["ip_address"],
        country=d["country"],
        asn=d["asn"],
        transaction_id=d["transaction_id"],
        amount=d["amount"],
        currency=d["currency"],
        payment_method=d["payment_method"],
        endpoint=d["endpoint"],
        api_key_id=d["api_key_id"],
        action=d["action"],
        resource=d["resource"],
        metadata=_from_json_field(d["metadata"]),
    )


# ──────────────────────────────────────────────
# Risk Signal Repository
# ──────────────────────────────────────────────

def save_signal(signal: RiskSignal):
    conn = get_connection()
    try:
        _insert_signal(conn, signal)
        _commit_and_close(conn)
    except Exception:
        conn.close()
        raise


def save_signals_bulk(signals: list[RiskSignal]):
    conn = get_connection()
    try:
        for s in signals:
            _insert_signal(conn, s)
        _commit_and_close(conn)
    except Exception:
        conn.close()
        raise


def _insert_signal(conn, signal: RiskSignal):
    ts = signal.timestamp if DB_TYPE == "postgresql" else signal.timestamp.isoformat()
    evidence = json.dumps(signal.evidence_event_ids)

    if DB_TYPE == "postgresql":
        cur = conn.cursor()
        cur.execute(
            """INSERT INTO risk_signals (signal_id, merchant_id, timestamp, signal_type, value, severity, source, evidence_event_ids)
               VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
               ON CONFLICT (signal_id) DO UPDATE SET
                 value = EXCLUDED.value, severity = EXCLUDED.severity""",
            (signal.signal_id, signal.merchant_id, ts, signal.signal_type,
             signal.value, signal.severity.value, signal.source, evidence),
        )
        cur.close()
    else:
        conn.execute(
            "INSERT OR REPLACE INTO risk_signals VALUES (?,?,?,?,?,?,?,?)",
            (signal.signal_id, signal.merchant_id, ts, signal.signal_type,
             signal.value, signal.severity.value, signal.source, evidence),
        )


def get_merchant_signals(merchant_id: str, limit: int = 100) -> list[RiskSignal]:
    conn = get_connection()
    try:
        cur = _execute(
            conn,
            "SELECT * FROM risk_signals WHERE merchant_id = ? ORDER BY timestamp DESC LIMIT ?",
            (merchant_id, limit),
        )
        rows = _fetchall_as_dicts(cur, SIGNAL_COLS)
        if DB_TYPE == "postgresql":
            cur.close()
        conn.close()
        return [_dict_to_signal(r) for r in rows]
    except Exception:
        conn.close()
        raise


def _dict_to_signal(d: dict) -> RiskSignal:
    ts = d["timestamp"]
    if isinstance(ts, str):
        ts = datetime.fromisoformat(ts)
    return RiskSignal(
        signal_id=d["signal_id"],
        merchant_id=d["merchant_id"],
        timestamp=ts,
        signal_type=d["signal_type"],
        value=d["value"],
        severity=Severity(d["severity"]),
        source=d["source"],
        evidence_event_ids=_from_json_field(d["evidence_event_ids"]),
    )


# ──────────────────────────────────────────────
# Incident Repository
# ──────────────────────────────────────────────

def save_incident(incident: Incident):
    conn = get_connection()
    try:
        ts = incident.created_at if DB_TYPE == "postgresql" else incident.created_at.isoformat()
        sigs = json.dumps(incident.signal_ids)
        evidence = json.dumps(incident.evidence_event_ids)

        if DB_TYPE == "postgresql":
            cur = conn.cursor()
            cur.execute(
                """INSERT INTO incidents (incident_id, merchant_id, created_at, status, incident_type,
                   risk_score, risk_band, signal_ids, evidence_event_ids, summary)
                   VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                   ON CONFLICT (incident_id) DO UPDATE SET
                     status = EXCLUDED.status, risk_score = EXCLUDED.risk_score,
                     risk_band = EXCLUDED.risk_band, summary = EXCLUDED.summary""",
                (incident.incident_id, incident.merchant_id, ts, incident.status.value,
                 incident.incident_type, incident.risk_score, incident.risk_band.value,
                 sigs, evidence, incident.summary),
            )
            cur.close()
        else:
            conn.execute(
                "INSERT OR REPLACE INTO incidents VALUES (?,?,?,?,?,?,?,?,?,?)",
                (incident.incident_id, incident.merchant_id, ts, incident.status.value,
                 incident.incident_type, incident.risk_score, incident.risk_band.value,
                 sigs, evidence, incident.summary),
            )
        _commit_and_close(conn)
    except Exception:
        conn.close()
        raise


def get_all_incidents(limit: int = 100) -> list[Incident]:
    conn = get_connection()
    try:
        cur = _execute(conn, "SELECT * FROM incidents ORDER BY created_at DESC LIMIT ?", (limit,))
        rows = _fetchall_as_dicts(cur, INCIDENT_COLS)
        if DB_TYPE == "postgresql":
            cur.close()
        conn.close()
        return [_dict_to_incident(r) for r in rows]
    except Exception:
        conn.close()
        raise


def get_incident(incident_id: str) -> Optional[Incident]:
    conn = get_connection()
    try:
        cur = _execute(conn, "SELECT * FROM incidents WHERE incident_id = ?", (incident_id,))
        rows = _fetchall_as_dicts(cur, INCIDENT_COLS)
        if DB_TYPE == "postgresql":
            cur.close()
        conn.close()
        if not rows:
            return None
        return _dict_to_incident(rows[0])
    except Exception:
        conn.close()
        raise


def get_merchant_incidents(merchant_id: str) -> list[Incident]:
    conn = get_connection()
    try:
        cur = _execute(
            conn,
            "SELECT * FROM incidents WHERE merchant_id = ? ORDER BY created_at DESC",
            (merchant_id,),
        )
        rows = _fetchall_as_dicts(cur, INCIDENT_COLS)
        if DB_TYPE == "postgresql":
            cur.close()
        conn.close()
        return [_dict_to_incident(r) for r in rows]
    except Exception:
        conn.close()
        raise


def _dict_to_incident(d: dict) -> Incident:
    ts = d["created_at"]
    if isinstance(ts, str):
        ts = datetime.fromisoformat(ts)
    return Incident(
        incident_id=d["incident_id"],
        merchant_id=d["merchant_id"],
        created_at=ts,
        status=IncidentStatus(d["status"]),
        incident_type=d["incident_type"],
        risk_score=d["risk_score"],
        risk_band=RiskBand(d["risk_band"]),
        signal_ids=_from_json_field(d["signal_ids"]),
        evidence_event_ids=_from_json_field(d["evidence_event_ids"]),
        summary=d["summary"],
    )
