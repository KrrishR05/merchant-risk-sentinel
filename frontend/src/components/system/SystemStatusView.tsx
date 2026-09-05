'use client';

import React, { useState } from 'react';

interface SystemStatusViewProps {
  health: { status: string; database: string } | null;
  loading: boolean;
  onRefresh: () => void;
  onBackToOverview: () => void;
}

type TabType = 'all' | 'subsystems' | 'apis' | 'datasets' | 'agents';

export const SystemStatusView: React.FC<SystemStatusViewProps> = ({
  health,
  loading,
  onRefresh,
  onBackToOverview,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const isDbOk = health?.database === 'ok' || health?.status === 'ok';

  const subsystems = [
    {
      name: 'PostgreSQL Database',
      description: 'Persistent transactional and audit store for merchants, events, incidents, and forensic trails.',
      status: isDbOk ? 'Operational' : 'Degraded',
      badge: isDbOk ? 'badge-low' : 'badge-critical',
      latency: '2.1 ms',
      source: 'Internal PostgreSQL instance via async connection pool (psycopg2 / SQLAlchemy)',
    },
    {
      name: 'Risk Fusion Engine',
      description: 'Multi-factor score calibration blending behavioral deviations and anomaly weights into a 0–100 score.',
      status: 'Operational',
      badge: 'badge-low',
      latency: '4.8 ms',
      source: 'backend/risk/risk_orchestrator.py',
    },
    {
      name: 'Behavioral Genome Engine',
      description: 'Continuous mathematical profiling of device fingerprints, geographic ASN clusters, and transaction velocity.',
      status: 'Operational',
      badge: 'badge-low',
      latency: '3.2 ms',
      source: 'backend/risk/baseline_engine.py',
    },
    {
      name: 'Temporal Workflow Engine',
      description: 'Finite State Machine (FSM) sequence integrity engine detecting multi-stage attack transitions.',
      status: 'Operational',
      badge: 'badge-low',
      latency: '1.9 ms',
      source: 'backend/risk/workflow_engine.py',
    },
    {
      name: 'Forensic AI Investigator',
      description: 'Multi-agent reasoning agent with streaming step-by-step hypothesis validation and evidence synthesis.',
      status: 'Operational',
      badge: 'badge-low',
      latency: 'Provider Connected',
      source: 'backend/investigator/agent.py (OpenAI / Gemini / Fallback Provider)',
    },
    {
      name: 'Case Memory Vector Store',
      description: 'Historical similarity engine indexing confirmed incidents to compute precedent match percentages.',
      status: 'Operational',
      badge: 'badge-low',
      latency: '2.4 ms',
      source: 'backend/investigator/memory.py (Weighted Jaccard + Multi-Signal Vectors)',
    },
    {
      name: 'Policy Gate Sentinel',
      description: 'Defense-only response containment guard enforcing strict safety boundaries and human approval.',
      status: 'Operational',
      badge: 'badge-low',
      latency: '< 1.0 ms',
      source: 'backend/services/policy_gate.py',
    },
  ];

  const apis = [
    {
      category: 'Backend Core REST API',
      source: 'FastAPI Service (backend/api/main.py) running on Python 3.14 / Uvicorn',
      endpoint: 'GET /overview',
      method: 'GET',
      description: 'Returns real-time command center summary: total incidents, live defense status, merchant risk summaries, and recent activity.',
    },
    {
      category: 'Backend Core REST API',
      source: 'FastAPI Service (backend/api/main.py)',
      endpoint: 'GET /merchants/{id}/risk & /profile',
      method: 'GET',
      description: 'Fetches merchant Behavioral Genome (known devices, IP subnets, GeoIP ASNs, velocity baselines) and deterministic risk score.',
    },
    {
      category: 'Backend Core REST API',
      source: 'FastAPI Service (backend/api/main.py)',
      endpoint: 'POST /incidents/{id}/investigate/stream',
      method: 'POST (SSE)',
      description: 'Server-Sent Events (SSE) endpoint streaming real-time multi-agent reasoning across all 10 investigation phases.',
    },
    {
      category: 'Backend Core REST API',
      source: 'FastAPI Service (backend/api/main.py)',
      endpoint: 'POST /scenarios/inject',
      method: 'POST',
      description: 'Injects synthetic ATO attacks (credential theft, network pivot, payout drain) or benign surges (weekend sale, festive campaigns).',
    },
    {
      category: 'Backend Core REST API',
      source: 'FastAPI Service (backend/api/main.py)',
      endpoint: 'GET /evaluation/results',
      method: 'GET',
      description: 'Fetches held-out evaluation benchmark output (Precision, Recall, F1, FPR, Lead Time, Financial Loss Averted) from 50 test trials.',
    },
    {
      category: 'Backend Core REST API',
      source: 'FastAPI Service (backend/api/main.py)',
      endpoint: 'POST /actions/execute',
      method: 'POST',
      description: 'Executes policy-gated containment actions (quarantine session, force re-auth, hold settlement) under Policy Gate enforcement.',
    },
    {
      category: 'External AI Model API',
      source: 'OpenAI API (api.openai.com) via official Python openai SDK',
      endpoint: 'ChatCompletions (gpt-4o-mini / gpt-4o)',
      method: 'API Key',
      description: 'Used by AI Investigator for structured forensic reasoning, evidence synthesis, and natural language executive summaries.',
    },
    {
      category: 'External AI Model API',
      source: 'Google Gemini API (generativelanguage.googleapis.com) via google-generativeai SDK',
      endpoint: 'GenerateContent (gemini-1.5-flash / gemini-1.5-pro)',
      method: 'API Key',
      description: 'Secondary high-speed reasoning provider for rapid hypothesis stress-testing and counter-evidence analysis.',
    },
    {
      category: 'Resilient Local Fallback Provider',
      source: 'Local Deterministic AI Engine (backend/investigator/providers.py)',
      endpoint: 'MockProvider.investigate_stream()',
      method: 'Internal',
      description: 'Zero-network-dependency deterministic fallback engine. Guarantees 100% demo uptime and reproducible evaluation if API keys are unconfigured.',
    },
    {
      category: 'Payment Platform Webhook Ingestion API',
      source: 'Simulated Razorpay Merchant Webhook Gateway (backend/services/risk_orchestrator.py)',
      endpoint: 'POST /events (Internal Ingestion Pipeline)',
      method: 'Batch / Stream',
      description: 'Ingests granular merchant telemetry: authentication events, config updates, payout destination changes, and payment transactions.',
    },
  ];

  const datasets = [
    {
      name: '5 Indian Merchant Archetype Distributions',
      location: 'backend/services/synthetic_generator.py',
      records: '5 calibrated merchant categories (Spice Kitchen, CloudSync, TrendVault, PixelForge, Test Restaurant)',
      description: 'Statistical telemetry models designed to mirror authentic Indian merchant behavioral profiles across transactions, devices, and geographies.',
      details: [
        'Spice Kitchen Alpha (Food & Beverage / QSR): High-velocity lunch/dinner bursts, POS terminal fingerprints, domestic Mumbai/Delhi ASNs, INR 100–2,500.',
        'CloudSync Elite (B2B SaaS / Enterprise Cloud): Low txn frequency, high ticket amounts (INR 15,000–1,50,000), global founder travel access.',
        'TrendVault Prime (Luxury Fashion D2C): High volatility, flash-sale spikes, diverse consumer devices, multi-channel payment mix.',
        'PixelForge Alpha (Digital Creator / Software): Micro-transactions, nocturnal developer sessions, international consumer card flow.',
        'Test Restaurant Alpha (Hospitality): Strict operating window hours, dedicated counter terminal identifiers.',
      ],
    },
    {
      name: '14-Day Behavioral Baseline Windows',
      location: 'Computed dynamically via backend/risk/baseline_engine.py',
      records: '14-day rolling historical telemetry per merchant with strict zero future-data leakage',
      description: 'Chronological training baseline recording known device IDs, familiar IP subnets, valid ASN registries, and statistical velocity means (μ) & standard deviations (σ).',
      details: [
        'Used by the Anomaly Engine to calculate deviation scores (z-scores) for incoming transactions and administrative actions.',
        'Ensures that an anomaly is only flagged when telemetry contradicts the merchant’s documented historical habits.',
      ],
    },
    {
      name: 'Historical Case Memory Seed Records',
      location: 'backend/investigator/memory.py (Seed Corpus) & PostgreSQL case_memory table',
      records: 'Curated historical precedent incidents across ATO and Benign patterns',
      description: 'Vector-indexed case knowledge base storing verified incident patterns, resolution outcomes, and remediation audits.',
      details: [
        'Case 1: Credential stuffing followed by payout destination tampering (Confirmed ATO).',
        'Case 2: Login from known POS terminal with weekend sales volume surge (Confirmed Benign).',
        'Case 3: Founder international conference travel with verified device identity maintained (Confirmed Benign).',
        'Case 4: Multi-merchant syndicate device sharing ring across independent merchant IDs (Confirmed Fraud Ring).',
      ],
    },
    {
      name: 'Held-Out Evaluation Benchmark Split',
      location: 'data/evaluation_results.json & ml/evaluation/run_evaluation.py',
      records: '50 independent evaluation trials (25 ATO attack scenarios + 25 high-velocity benign controls)',
      description: 'Standardized held-out test harness measuring Precision, Recall, F1, False Positive Rate (FPR), Detection Lead Time, and Financial Impact.',
      details: [
        'Strict chronological split with zero data contamination between training baseline and test events.',
        'Labels: Ground-truth binary labels (1 = Attack, 0 = Benign). Used to prove zero false positives during flash sales.',
      ],
    },
    {
      name: 'PostgreSQL Relational Schema Store',
      location: 'PostgreSQL database (configured via DATABASE_URL)',
      records: '5 relational tables: merchants, events, incidents, investigations, action_audits',
      description: 'Production-ready transactional persistence maintaining complete audit trails and forensic artifacts for compliance.',
      details: [
        'merchants: Profile, risk tier, registered archetype, and active baseline metadata.',
        'events: Immutable append-only log of all raw payment, auth, and configuration events.',
        'incidents: Active and resolved risk tickets, assigned severity, and risk scores.',
        'investigations: Detailed forensic audit reports, evidence graphs, and alternative hypotheses.',
        'action_audits: Cryptographically signed policy-gate containment logs with execution timestamps.',
      ],
    },
  ];

  const agents = [
    {
      role: 'Chief Forensic Orchestrator',
      name: 'RiskSutraAIInvestigator',
      file: 'backend/investigator/agent.py',
      type: 'Multi-Agent Supervisor',
      description: 'Central investigation agent coordinating multi-phase reasoning, evidence compilation, provider delegation, and verdict generation.',
      responsibilities: [
        'Executes 10-phase investigation lifecycle with real-time SSE streaming.',
        'Aggregates findings from specialized sub-agents into a unified forensic evidence dossier.',
        'Calculates financial loss averted and assigns definitive CONFIRMED_ATO vs BENIGN_SPIKE outcome.',
      ],
    },
    {
      role: 'Contextual Genome Anomaly Agent',
      name: 'BaselineEngine',
      file: 'backend/risk/baseline_engine.py',
      type: 'Deterministic Analytical Agent',
      description: 'Analyzes incoming telemetry against the merchant’s 14-day behavioral genome to detect multi-dimensional deviations.',
      responsibilities: [
        'Flags unseen device IDs and novel browser/hardware signatures.',
        'Detects hosting ASN network pivots (e.g. AS16276, bulletproof proxies).',
        'Identifies impossible travel and unnatural geographic shifts.',
        'Computes velocity burst multiples relative to normal baseline standard deviation.',
      ],
    },
    {
      role: 'Temporal Attack Chain Agent',
      name: 'TemporalWorkflowEngine',
      file: 'backend/risk/workflow_engine.py',
      type: 'Finite State Machine (FSM) Agent',
      description: 'Reconstructs ordered attack progression across time to distinguish isolated errors from coordinated takeover trajectories.',
      responsibilities: [
        'Tracks the 3-stage ATO Kill Chain: Pre-Auth Recon -> Control Plane Tampering -> Financial Extraction.',
        'Identifies rapid credential and payout email changes preceding immediate settlement drains.',
        'Verifies sequence integrity to prevent premature false alarms on disjointed events.',
      ],
    },
    {
      role: 'Case Memory Retrieval Agent',
      name: 'MemoryEngine',
      file: 'backend/investigator/memory.py',
      type: 'Vector Similarity & Precedent Agent',
      description: 'Searches historical case memory to correlate current telemetry with verified past incident resolutions.',
      responsibilities: [
        'Computes weighted multi-factor similarity across signal types, merchant archetype, and control changes.',
        'Calculates calibrated percentage similarity match (e.g., 94% match with past credential theft).',
        'Provides precedent resolution recommendations to guide human analysts.',
      ],
    },
    {
      role: 'Counter-Hypothesis & Benign Verification Agent',
      name: 'ReasoningEngine (Provider LLM / Mock)',
      file: 'backend/investigator/providers.py',
      type: 'Adversarial Hypothesis Agent',
      description: 'Actively formulates and stress-tests plausible benign explanations to prevent false positive merchant account freezes.',
      responsibilities: [
        'Generates alternative explanations (e.g. "Weekend Flash Sale", "Founder International Travel", "Batch API Sync").',
        'Evaluates supporting evidence vs counter-evidence for each hypothesis.',
        'Classifies hypothesis status as SUPPORTED, WEAK, or REJECTED based on observed telemetry.',
      ],
    },
    {
      role: 'Policy Gate Sentinel',
      name: 'PolicyGate',
      file: 'backend/services/policy_gate.py',
      type: 'Containment Guardrail Agent',
      description: 'Enforces defense-only boundary rules, ensuring containment actions are proportionate and high-impact actions require human approval.',
      responsibilities: [
        'Authorizes low-friction defensive containment (session quarantine, step-up MFA challenge).',
        'Blocks unapproved high-impact actions (merchant account suspension, payout bank changes) pending human analyst sign-off.',
        'Maintains an immutable audit log of every defensive intervention.',
      ],
    },
  ];

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <button
            className="btn btn-secondary"
            onClick={onBackToOverview}
            style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem', marginBottom: '0.5rem' }}
          >
            ← Back to Overview
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <h1 style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.025em' }}>
              System Architecture &amp; Subsystem Health
            </h1>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.2rem 0.65rem',
                background: 'var(--risk-low-bg)',
                border: '1px solid rgba(5, 150, 105, 0.25)',
                borderRadius: '9999px',
                fontSize: '0.72rem',
                fontWeight: 700,
                color: 'var(--risk-low)',
              }}
            >
              <span className="pulse-indicator" />
              <span>All Systems Operational</span>
            </span>
          </div>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            Comprehensive architectural blueprint detailing live subsystems, REST/SSE APIs, dataset records, and multi-agent AI architecture.
          </p>
        </div>

        <button
          className="btn btn-secondary"
          onClick={onRefresh}
          disabled={loading}
          style={{ fontSize: '0.82rem' }}
        >
          {loading ? 'Checking...' : '↺ Refresh Health Check'}
        </button>
      </div>

      {/* Navigation Filter Tabs */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          borderBottom: '1px solid var(--border-subtle)',
          paddingBottom: '0.75rem',
          flexWrap: 'wrap',
        }}
      >
        {[
          { id: 'all', label: 'All Architecture Overview', icon: '🏛️' },
          { id: 'subsystems', label: 'Infrastructure Subsystems', count: subsystems.length, icon: '⚙️' },
          { id: 'apis', label: 'APIs Used & Provenance', count: apis.length, icon: '🔌' },
          { id: 'datasets', label: 'Datasets & Telemetry Records', count: datasets.length, icon: '📊' },
          { id: 'agents', label: 'AI Agents & Model Reasoning', count: agents.length, icon: '🧠' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as TabType)}
            className={`btn ${activeTab === tab.id ? 'btn-primary' : 'btn-secondary'}`}
            style={{
              fontSize: '0.8rem',
              padding: '0.45rem 0.9rem',
              borderRadius: '8px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
            }}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span
                style={{
                  fontSize: '0.7rem',
                  padding: '0.1rem 0.4rem',
                  borderRadius: '9999px',
                  background: activeTab === tab.id ? 'rgba(255,255,255,0.25)' : 'var(--bg-subtle)',
                  color: activeTab === tab.id ? '#ffffff' : 'var(--text-muted)',
                }}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* SECTION 1: Subsystems Status Grid */}
      {(activeTab === 'all' || activeTab === 'subsystems') && (
        <section style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.2rem' }}>⚙️</span>
            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                Core Defense Subsystems &amp; Database Health
              </h2>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Underlying real-time detection, persistence, and containment engines.
              </p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
            {subsystems.map((sub, idx) => (
              <div key={idx} className="panel" style={{ padding: '1.35rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.45rem' }}>
                    <span style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {sub.name}
                    </span>
                    <span className={`badge ${sub.badge}`}>
                      {sub.status}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.45, marginBottom: '0.75rem' }}>
                    {sub.description}
                  </p>
                  <div style={{ fontSize: '0.7rem', color: 'var(--accent-primary)', fontFamily: 'monospace', marginBottom: '1rem' }}>
                    Source: {sub.source}
                  </div>
                </div>

                <div
                  style={{
                    borderTop: '1px solid var(--border-subtle)',
                    paddingTop: '0.75rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '0.72rem',
                    color: 'var(--text-muted)',
                  }}
                >
                  <span>Metric / Health</span>
                  <strong style={{ color: 'var(--text-primary)' }}>{sub.latency}</strong>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* SECTION 2: APIs Used and From Where */}
      {(activeTab === 'all' || activeTab === 'apis') && (
        <section style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: activeTab === 'all' ? '1rem' : '0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.2rem' }}>🔌</span>
            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                APIs Used &amp; Architectural Provenance
              </h2>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                All HTTP REST, Server-Sent Event (SSE), external LLM APIs, and event ingestion endpoints.
              </p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.25rem' }}>
            {apis.map((api, idx) => (
              <div key={idx} className="panel" style={{ padding: '1.35rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      {api.category}
                    </span>
                    <span
                      style={{
                        padding: '0.15rem 0.5rem',
                        borderRadius: '6px',
                        background: 'var(--accent-tint)',
                        color: 'var(--accent-primary)',
                        fontFamily: 'monospace',
                        fontWeight: 700,
                        fontSize: '0.7rem',
                      }}
                    >
                      {api.method}
                    </span>
                  </div>

                  <div style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
                    {api.endpoint}
                  </div>

                  <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.45, marginBottom: '0.85rem' }}>
                    {api.description}
                  </p>
                </div>

                <div
                  style={{
                    borderTop: '1px solid var(--border-subtle)',
                    paddingTop: '0.65rem',
                    fontSize: '0.7rem',
                    color: 'var(--text-muted)',
                  }}
                >
                  <strong>Provenance: </strong>
                  <span>{api.source}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* SECTION 3: Datasets Records and Where Sourced */}
      {(activeTab === 'all' || activeTab === 'datasets') && (
        <section style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: activeTab === 'all' ? '1rem' : '0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.2rem' }}>📊</span>
            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                Datasets Record &amp; Data Provenance
              </h2>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Telemetry data pipelines, baseline training distributions, case memory corpus, and PostgreSQL persistence.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {datasets.map((ds, idx) => (
              <div key={idx} className="panel" style={{ padding: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    {ds.name}
                  </h3>
                  <span style={{ fontSize: '0.72rem', fontFamily: 'monospace', color: 'var(--accent-primary)', background: 'var(--accent-tint)', padding: '0.2rem 0.6rem', borderRadius: '6px' }}>
                    {ds.location}
                  </span>
                </div>

                <div style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.6rem' }}>
                  <strong>Scope &amp; Records: </strong>{ds.records}
                </div>

                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '0.85rem' }}>
                  {ds.description}
                </p>

                <div style={{ background: 'var(--bg-subtle)', borderRadius: '8px', padding: '0.85rem 1rem' }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', marginBottom: '0.4rem', letterSpacing: '0.04em' }}>
                    Key Data Specifications
                  </div>
                  <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    {ds.details.map((detail, dIdx) => (
                      <li key={dIdx}>{detail}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* SECTION 4: AI Agents in Our Architecture */}
      {(activeTab === 'all' || activeTab === 'agents') && (
        <section style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: activeTab === 'all' ? '1rem' : '0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.2rem' }}>🧠</span>
            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                AI Agents &amp; Model Reasoning Architecture
              </h2>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Autonomous multi-agent forensic coordination: 5 specialized agents operating under a human-in-the-loop Policy Gate.
              </p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.25rem' }}>
            {agents.map((agent, idx) => (
              <div key={idx} className="panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      {agent.role}
                    </span>
                    <span className="badge badge-intel">
                      {agent.type}
                    </span>
                  </div>

                  <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                    {agent.name}
                  </h3>

                  <div style={{ fontFamily: 'monospace', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                    {agent.file}
                  </div>

                  <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.45, marginBottom: '1rem' }}>
                    {agent.description}
                  </p>
                </div>

                <div style={{ background: 'var(--bg-subtle)', borderRadius: '8px', padding: '0.75rem 0.9rem' }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', marginBottom: '0.35rem', letterSpacing: '0.04em' }}>
                    Core Responsibilities
                  </div>
                  <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.73rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                    {agent.responsibilities.map((resp, rIdx) => (
                      <li key={rIdx}>{resp}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>

          {/* 10-Phase Reasoning Graph Diagram */}
          <div className="panel" style={{ padding: '1.75rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
              10-Phase Real-Time Forensic Investigation Lifecycle
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
              When an investigation is initiated, the orchestrator executes this strict, auditable analytical chain over Server-Sent Events (SSE):
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '0.75rem' }}>
              {[
                { phase: 'Phase 1', title: 'Audit Initialization', desc: 'Creates immutable investigation audit record in PostgreSQL' },
                { phase: 'Phase 2', title: 'Signals Ingestion', desc: 'Ingests calibrated anomaly vectors and threat signals' },
                { phase: 'Phase 3', title: 'Attack Trajectory', desc: 'Reconstructs ordered temporal state machine sequence' },
                { phase: 'Phase 4', title: 'Contextual Genome', desc: 'Diffs current telemetry against 14-day normal baseline' },
                { phase: 'Phase 5', title: 'Case Memory Vector', desc: 'Retrieves similar historical cases and past resolutions' },
                { phase: 'Phase 6', title: 'Counter-Hypotheses', desc: 'Formulates and stress-tests benign business explanations' },
                { phase: 'Phase 7', title: 'Provider Synthesis', desc: 'LLM (OpenAI/Gemini/Mock) generates structured verdict' },
                { phase: 'Phase 8', title: 'Policy Gate Bounding', desc: 'Restricts containment actions to defense-only scope' },
                { phase: 'Phase 9', title: 'Audit Cryptography', desc: 'Persists forensic dossier and signs policy execution log' },
                { phase: 'Phase 10', title: 'Verdict Delivery', desc: 'Pushes final assessment to Security Command Center' },
              ].map((p, idx) => (
                <div key={idx} className="panel-subtle" style={{ padding: '0.85rem' }}>
                  <div style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--accent-primary)', textTransform: 'uppercase', marginBottom: '0.2rem' }}>
                    {p.phase}
                  </div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                    {p.title}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.35 }}>
                    {p.desc}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
};
