'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  api, Overview, MerchantProfile, RiskAssessment, MerchantEvent, Incident, ScenarioResult,
  AIInvestigationResult, InvestigationAuditRecord, HistoricalMatch, LearningIntelligence
} from '@/lib/api';
import { RiskSutraLogo } from '@/components/branding/RiskSutraLogo';

// ── Helpers ──
function riskColor(band: string) {
  const map: Record<string, string> = {
    LOW: 'var(--risk-low)',
    MEDIUM: 'var(--risk-medium)',
    HIGH: 'var(--risk-high)',
    CRITICAL: 'var(--risk-critical)'
  };
  return map[band] || 'var(--text-muted)';
}

function badgeClass(band: string) {
  return `badge badge-${band.toLowerCase()}`;
}

function formatTime(ts: string) {
  try {
    return new Date(ts).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
  } catch {
    return ts;
  }
}

const SENSITIVE_EVENTS = new Set(['CONFIG_CHANGE', 'PAYOUT_EVENT', 'ACCOUNT_ACTION', 'AUTH_FAILURE']);

type View = 'overview' | 'merchant' | 'incidents';
type InvestigationState = 'NOT_RUN' | 'RUNNING' | 'COMPLETED' | 'FAILED';

export default function Dashboard() {
  const [view, setView] = useState<View>('overview');
  const [overview, setOverview] = useState<Overview | null>(null);
  const [selectedMerchant, setSelectedMerchant] = useState<string | null>(null);
  const [profile, setProfile] = useState<MerchantProfile | null>(null);
  const [risk, setRisk] = useState<RiskAssessment | null>(null);
  const [events, setEvents] = useState<MerchantEvent[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [activeIncident, setActiveIncident] = useState<Incident | null>(null);
  const activeIncidentRef = useRef<Incident | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scenarioResult, setScenarioResult] = useState<ScenarioResult | null>(null);
  const [injecting, setInjecting] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [feedbackSuccess, setFeedbackSuccess] = useState<string | null>(null);

  // Authoritative AI Investigator State Machine (PART 2)
  const [investigationState, setInvestigationState] = useState<InvestigationState>('NOT_RUN');
  const [investigation, setInvestigation] = useState<AIInvestigationResult | null>(null);
  const [audit, setAudit] = useState<InvestigationAuditRecord | null>(null);
  const [investigationError, setInvestigationError] = useState<string | null>(null);
  const [stageProgress, setStageProgress] = useState<{ index: number; label: string; status: 'PENDING' | 'RUNNING' | 'COMPLETED'; detail?: string }[]>([
    { index: 1, label: 'Loading merchant behavioral context', status: 'PENDING' },
    { index: 2, label: 'Reviewing risk signals', status: 'PENDING' },
    { index: 3, label: 'Reconstructing temporal workflow', status: 'PENDING' },
    { index: 4, label: 'Checking entity relationships', status: 'PENDING' },
    { index: 5, label: 'Comparing legitimate explanations', status: 'PENDING' },
    { index: 6, label: 'Searching historical case memory', status: 'PENDING' },
    { index: 7, label: 'Retrieving supporting evidence', status: 'PENDING' },
    { index: 8, label: 'Synthesizing investigation', status: 'PENDING' },
    { index: 9, label: 'Producing assessment & remediation plan', status: 'PENDING' },
    { index: 10, label: 'Persisting investigation & case memory', status: 'PENDING' },
  ]);

  const loadOverview = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [ov, inc] = await Promise.all([api.getOverview(), api.getIncidents(200)]);
      setOverview(ov);
      setIncidents(inc.incidents);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load overview data');
    } finally {
      setLoading(false);
    }
  }, []);

  // Merchant selection strictly loads deterministic data and NEVER auto-hydrates AI investigations
  const loadMerchant = useCallback(async (id: string, targetIncidentId?: string) => {
    try {
      setLoading(true);
      setError(null);
      setFeedbackSuccess(null);
      setInvestigationError(null);
      setInvestigation(null);
      setAudit(null);
      setInvestigationState('NOT_RUN');

      const [r, p, ev, incList] = await Promise.all([
        api.getMerchantRisk(id),
        api.getMerchantProfile(id),
        api.getMerchantEvents(id, 40),
        api.getIncidents(200),
      ]);

      setRisk(r);
      setProfile(p);
      setEvents(ev.events);
      setSelectedMerchant(id);

      // Filter incidents for this specific merchant
      const merchantIncidents = incList.incidents
        .filter(i => i.merchant_id === id)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      // Target specific incident or default to latest
      const activeInc = targetIncidentId
        ? merchantIncidents.find(i => i.incident_id === targetIncidentId) || (merchantIncidents.length > 0 ? merchantIncidents[0] : null)
        : (merchantIncidents.length > 0 ? merchantIncidents[0] : null);

      setActiveIncident(activeInc);
      activeIncidentRef.current = activeInc;

      // STRICT NON-NEGOTIABLE PRODUCT RULE:
      // Normal merchant/incident navigation MUST ALWAYS keep AI Investigator in NOT_RUN state.
      // An existing completed investigation in the database MUST NEVER automatically hydrate or display.
      // The user must explicitly click "Run AI Investigation" to run and display results.
      setInvestigation(null);
      setAudit(null);
      setInvestigationError(null);
      setInvestigationState('NOT_RUN');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load merchant data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  const selectMerchant = (id: string, targetIncidentId?: string) => {
    setView('merchant');
    loadMerchant(id, targetIncidentId);
  };

  const handleSelectIncidentForMerchant = (targetIncidentId: string) => {
    const target = incidents.find(i => i.incident_id === targetIncidentId);
    if (target) {
      setActiveIncident(target);
      activeIncidentRef.current = target;
      // Reset investigation state machine on incident switch
      setInvestigation(null);
      setAudit(null);
      setInvestigationError(null);
      setInvestigationState('NOT_RUN');
    }
  };

  const goHome = () => {
    setView('overview');
    setScenarioResult(null);
    loadOverview();
  };

  // EXPLICIT SCENARIO INJECTION EXCEPTION:
  // User explicitly initiated simulation -> creates new telemetry and incident, and auto-runs AI
  const injectScenario = async (type: string) => {
    if (!selectedMerchant || injecting) return;
    setInjecting(true);
    setScenarioResult(null);
    try {
      const result = await api.injectScenario(selectedMerchant, type);
      setScenarioResult(result);
      const targetIncId = result.incident_id || (result.incident_created && result.incident_created.incident_id);
      await loadMerchant(selectedMerchant, targetIncId || undefined);
      await loadOverview();

      if (targetIncId) {
        runInvestigation(targetIncId);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Scenario injection failed');
    } finally {
      setInjecting(false);
    }
  };

  // Execution pipeline for user clicking [ Run AI Investigation ]
  const runInvestigation = (incidentId: string) => {
    if (investigationState === 'RUNNING') return;
    setInvestigationState('RUNNING');
    setInvestigationError(null);
    setInvestigation(null);
    setAudit(null);

    const initialStages: { index: number; label: string; status: 'PENDING' | 'RUNNING' | 'COMPLETED'; detail?: string }[] = [
      { index: 1, label: 'Loading merchant behavioral context', status: 'PENDING' },
      { index: 2, label: 'Reviewing risk signals', status: 'PENDING' },
      { index: 3, label: 'Reconstructing temporal workflow', status: 'PENDING' },
      { index: 4, label: 'Checking entity relationships', status: 'PENDING' },
      { index: 5, label: 'Comparing legitimate explanations', status: 'PENDING' },
      { index: 6, label: 'Searching historical case memory', status: 'PENDING' },
      { index: 7, label: 'Retrieving supporting evidence', status: 'PENDING' },
      { index: 8, label: 'Synthesizing investigation', status: 'PENDING' },
      { index: 9, label: 'Producing assessment & remediation plan', status: 'PENDING' },
      { index: 10, label: 'Persisting investigation & case memory', status: 'PENDING' },
    ];
    setStageProgress(initialStages);

    api.streamInvestigation(
      incidentId,
      (event) => {
        // Guard against stale stream callbacks if merchant/incident changed
        if (activeIncidentRef.current?.incident_id !== incidentId) return;
        if (event.stage_index) {
          setStageProgress(prev =>
            prev.map(s => {
              if (s.index === event.stage_index) {
                return {
                  ...s,
                  status: event.status === 'COMPLETED' ? 'COMPLETED' : 'RUNNING',
                  detail: event.detail || s.detail,
                };
              }
              return s;
            })
          );
        }
      },
      (data) => {
        // Guard against stale stream callbacks if merchant/incident changed
        if (activeIncidentRef.current?.incident_id !== incidentId) return;
        setInvestigation(data.investigation);
        setAudit(data.audit);
        setInvestigationState('COMPLETED');
      },
      (err) => {
        if (activeIncidentRef.current?.incident_id !== incidentId) return;
        setInvestigationError(err.message || 'Investigation pipeline failed');
        setInvestigationState('FAILED');
      }
    );
  };

  // PART 26: Incident lifecycle status transitions
  const handleUpdateStatus = async (newStatus: string) => {
    if (!activeIncident || statusUpdating) return;
    setStatusUpdating(true);
    try {
      await api.updateIncidentStatus(activeIncident.incident_id, newStatus);
      setActiveIncident(prev => prev ? { ...prev, status: newStatus } : null);
      setFeedbackSuccess(`Incident status transitioned to ${newStatus}`);
      setTimeout(() => setFeedbackSuccess(null), 4000);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to update incident status');
    } finally {
      setStatusUpdating(false);
    }
  };

  // PART 11 & PART 12: Learning loop analyst feedback submission
  const handleAnalystFeedback = async (outcome: string) => {
    if (!activeIncident) return;
    try {
      await api.submitAnalystFeedback(activeIncident.incident_id, outcome, 'Verified by security analyst');
      setFeedbackSuccess(`Analyst outcome "${outcome.replace(/_/g, ' ')}" recorded. Calibrated case memory for future investigations.`);
      setTimeout(() => setFeedbackSuccess(null), 5000);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to submit analyst feedback');
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="sidebar-brand" style={{ padding: '1.25rem 1.25rem' }}>
          <RiskSutraLogo variant="full" size="md" onClick={goHome} animated={true} />
        </div>
        <nav className="sidebar-nav">
          <a className={`sidebar-link ${view === 'overview' ? 'active' : ''}`} onClick={goHome} style={{ cursor: 'pointer' }}>
            <span>◉</span> Overview
          </a>
          <div style={{ padding: '0.5rem 1.25rem 0.25rem', fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Active Merchants ({overview?.merchant_risks.length || 0})
          </div>
          {overview?.merchant_risks.map((m, idx) => (
            <a
              key={`${m.merchant_id}-${idx}`}
              className={`sidebar-link ${selectedMerchant === m.merchant_id && view === 'merchant' ? 'active' : ''}`}
              onClick={() => selectMerchant(m.merchant_id)}
              style={{ cursor: 'pointer' }}
            >
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: riskColor(m.risk_band), display: 'inline-block', flexShrink: 0 }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.merchant_name}</span>
            </a>
          ))}
          <div style={{ borderTop: '1px solid var(--border-subtle)', margin: '0.75rem 1.25rem' }} />
          <a
            className={`sidebar-link ${view === 'incidents' ? 'active' : ''}`}
            onClick={() => {
              setView('incidents');
              loadOverview();
            }}
            style={{ cursor: 'pointer' }}
          >
            <span>⊞</span> Incidents ({overview?.total_incidents ?? incidents.length})
          </a>
        </nav>
        <div style={{ padding: '0.75rem 1.25rem', borderTop: '1px solid var(--border-subtle)' }}>
          <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>RiskSūtra v0.3.0 · Day 3 Production Edition</div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main style={{ flex: 1, padding: '1.5rem 2rem', overflowY: 'auto' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <RiskSutraLogo variant="compact" size="sm" onClick={goHome} />
            <div style={{ borderLeft: '1px solid var(--border-subtle)', paddingLeft: '1rem' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Security Command Center & AI Investigator
              </div>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Razorpay Buildathon 2026 · AI Risk Manager Track</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.7rem', color: '#10b981', background: 'rgba(16,185,129,0.1)', padding: '0.25rem 0.6rem', borderRadius: '20px', border: '1px solid rgba(16,185,129,0.2)' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }}></span> Live Defense Engine Active
            </span>
          </div>
        </header>

        {error && (
          <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '0.75rem 1rem', marginBottom: '1rem', color: 'var(--risk-high)', fontSize: '0.8rem' }}>
            ⚠ {error}
          </div>
        )}

        {feedbackSuccess && (
          <div style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 8, padding: '0.75rem 1rem', marginBottom: '1rem', color: '#10b981', fontSize: '0.8rem' }}>
            ✓ {feedbackSuccess}
          </div>
        )}

        {view === 'overview' ? (
          <OverviewView overview={overview} incidents={incidents} loading={loading} onSelectMerchant={selectMerchant} />
        ) : view === 'merchant' ? (
          <MerchantView
            merchantId={selectedMerchant!}
            risk={risk}
            profile={profile}
            events={events}
            incidents={incidents}
            activeIncident={activeIncident}
            loading={loading}
            onInject={injectScenario}
            injecting={injecting}
            scenarioResult={scenarioResult}
            onBack={goHome}
            investigation={investigation}
            audit={audit}
            investigationState={investigationState}
            investigationError={investigationError}
            stageProgress={stageProgress}
            onRunInvestigation={runInvestigation}
            onSelectIncident={handleSelectIncidentForMerchant}
            onUpdateStatus={handleUpdateStatus}
            onSubmitFeedback={handleAnalystFeedback}
            statusUpdating={statusUpdating}
          />
        ) : (
          <IncidentsView
            incidents={incidents}
            overview={overview}
            loading={loading}
            onSelectIncident={(merchantId, incidentId) => selectMerchant(merchantId, incidentId)}
            onBack={goHome}
          />
        )}
      </main>
    </div>
  );
}

// ── Overview View ──
function OverviewView({ overview, incidents, loading, onSelectMerchant }: {
  overview: Overview | null; incidents: Incident[]; loading: boolean; onSelectMerchant: (id: string, targetIncidentId?: string) => void;
}) {
  if (loading || !overview) return <LoadingGrid />;
  return (
    <div className="animate-in">
      <h1 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '1.5rem' }}>Risk Overview</h1>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
        <StatCard label="Merchants Monitored" value={overview.total_merchants} />
        <StatCard label="Active Incidents" value={overview.active_incidents} accent={overview.active_incidents > 0 ? 'var(--risk-high)' : undefined} />
        <StatCard label="Total Incidents" value={overview.total_incidents} />
        <StatCard label="Critical/High Band" value={(overview.risk_distribution.HIGH || 0) + (overview.risk_distribution.CRITICAL || 0)}
          accent={(overview.risk_distribution.HIGH || 0) + (overview.risk_distribution.CRITICAL || 0) > 0 ? 'var(--risk-high)' : undefined} />
      </div>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '1rem', color: 'var(--text-secondary)' }}>Merchant Risk Portfolio</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              {['Merchant', 'Type', 'Deterministic Risk Score', 'Risk Band', 'Action'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '0.5rem 0.75rem', color: 'var(--text-muted)', fontWeight: 500, fontSize: '0.7rem', textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {overview.merchant_risks.map((m, idx) => (
              <tr key={`${m.merchant_id}-${idx}`} style={{ borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer' }} onClick={() => onSelectMerchant(m.merchant_id)}>
                <td style={{ padding: '0.6rem 0.75rem', fontWeight: 600 }}>{m.merchant_name}</td>
                <td style={{ padding: '0.6rem 0.75rem', color: 'var(--text-muted)' }}>{m.merchant_type}</td>
                <td style={{ padding: '0.6rem 0.75rem' }}>
                  <span style={{ color: riskColor(m.risk_band), fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{m.risk_score.toFixed(1)}</span>
                </td>
                <td style={{ padding: '0.6rem 0.75rem' }}><span className={badgeClass(m.risk_band)}>{m.risk_band}</span></td>
                <td style={{ padding: '0.6rem 0.75rem', color: '#60a5fa', fontWeight: 600 }}>Inspect →</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {incidents.length > 0 && (
        <div className="card">
          <h2 style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '1rem', color: 'var(--text-secondary)' }}>Recent Risk Incidents</h2>
          {incidents.slice(0, 5).map((inc, idx) => (
            <div
              key={`${inc.incident_id}-${idx}`}
              onClick={() => onSelectMerchant(inc.merchant_id, inc.incident_id)}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.6rem 0.75rem',
                borderBottom: '1px solid var(--border-subtle)',
                cursor: 'pointer',
                borderRadius: 6,
                transition: 'background 0.15s ease'
              }}
            >
              <div>
                <span style={{ fontWeight: 600, fontSize: '0.8rem', color: '#60a5fa' }}>{inc.incident_id}</span>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginLeft: '0.75rem' }}>{inc.merchant_id} · {inc.incident_type}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ color: riskColor(inc.risk_band), fontWeight: 700, fontSize: '0.85rem' }}>{inc.risk_score.toFixed(1)}</span>
                <span className={badgeClass(inc.risk_band)}>{inc.risk_band}</span>
                <span style={{ color: '#60a5fa', fontSize: '0.75rem' }}>Inspect →</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Global Incident Queue View ──
function IncidentsView({
  incidents,
  overview,
  loading,
  onSelectIncident,
  onBack,
}: {
  incidents: Incident[];
  overview: Overview | null;
  loading: boolean;
  onSelectIncident: (merchantId: string, incidentId: string) => void;
  onBack: () => void;
}) {
  const [bandFilter, setBandFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const merchantNames: Record<string, string> = {};
  if (overview?.merchant_risks) {
    overview.merchant_risks.forEach(m => {
      merchantNames[m.merchant_id] = m.merchant_name;
    });
  }

  const filtered = incidents.filter(inc => {
    if (bandFilter !== 'ALL' && inc.risk_band !== bandFilter) return false;
    if (statusFilter !== 'ALL' && inc.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const mName = (merchantNames[inc.merchant_id] || '').toLowerCase();
      const mId = inc.merchant_id.toLowerCase();
      const incId = inc.incident_id.toLowerCase();
      const summary = (inc.summary || '').toLowerCase();
      if (!incId.includes(q) && !mId.includes(q) && !mName.includes(q) && !summary.includes(q)) {
        return false;
      }
    }
    return true;
  });

  const criticalCount = incidents.filter(i => i.risk_band === 'CRITICAL').length;
  const highCount = incidents.filter(i => i.risk_band === 'HIGH').length;
  const containedCount = incidents.filter(i => i.status === 'CONTAINED' || i.status === 'RESOLVED').length;

  if (loading) return <LoadingGrid />;

  return (
    <div className="animate-in">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
        <div>
          <button
            onClick={onBack}
            style={{
              background: 'none',
              border: 'none',
              color: '#60a5fa',
              cursor: 'pointer',
              fontSize: '0.75rem',
              fontWeight: 600,
              padding: 0,
              marginBottom: '0.5rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
            }}
          >
            ← Back to Overview
          </button>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            Global Incident Queue ({overview?.total_incidents ?? incidents.length})
          </h1>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Auditable incident registry of detected Account Takeover events, suspicious temporal workflows, and defensive actions across all merchants.
          </p>
        </div>
      </div>

      {/* KPI Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
        <StatCard label="Total Incidents" value={overview?.total_incidents ?? incidents.length} />
        <StatCard label="Critical Risk" value={criticalCount} accent={criticalCount > 0 ? 'var(--risk-critical)' : undefined} />
        <StatCard label="High Risk" value={highCount} accent={highCount > 0 ? 'var(--risk-high)' : undefined} />
        <StatCard label="Contained / Resolved" value={containedCount} accent={containedCount > 0 ? 'var(--risk-low)' : undefined} />
      </div>

      {/* Filters Bar */}
      <div className="card" style={{ marginBottom: '1.25rem', padding: '1rem 1.25rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Search Box */}
          <div style={{ flex: '1 1 240px', maxWidth: '340px' }}>
            <input
              type="text"
              placeholder="Search by incident ID, merchant..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                background: 'rgba(15, 23, 42, 0.6)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '8px',
                padding: '0.45rem 0.75rem',
                fontSize: '0.75rem',
                color: 'var(--text-primary)',
                outline: 'none',
              }}
            />
          </div>

          {/* Risk Band Filters */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginRight: '0.2rem' }}>Band:</span>
            {['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map(b => (
              <button
                key={b}
                onClick={() => setBandFilter(b)}
                style={{
                  background: bandFilter === b ? (b === 'ALL' ? 'var(--accent-blue)' : riskColor(b)) : 'rgba(30, 41, 59, 0.5)',
                  color: bandFilter === b ? '#fff' : 'var(--text-secondary)',
                  border: '1px solid',
                  borderColor: bandFilter === b ? 'transparent' : 'var(--border-subtle)',
                  borderRadius: '6px',
                  padding: '0.25rem 0.6rem',
                  fontSize: '0.68rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {b}
              </button>
            ))}
          </div>

          {/* Status Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginRight: '0.2rem' }}>Status:</span>
            {['ALL', 'OPEN', 'CONTAINED', 'RECOVERY_REQUIRED', 'RESOLVED'].map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                style={{
                  background: statusFilter === s ? 'rgba(59, 130, 246, 0.2)' : 'rgba(30, 41, 59, 0.5)',
                  color: statusFilter === s ? '#60a5fa' : 'var(--text-secondary)',
                  border: '1px solid',
                  borderColor: statusFilter === s ? '#3b82f6' : 'var(--border-subtle)',
                  borderRadius: '6px',
                  padding: '0.25rem 0.6rem',
                  fontSize: '0.68rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {s.replace(/_/g, ' ')}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Incidents Table */}
      <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: 'rgba(15, 23, 42, 0.5)' }}>
              {['Incident ID', 'Target Merchant', 'Risk Band & Score', 'Status', 'Evidence Events', 'Detected At', 'Action'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '0.7rem 1rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-muted)' }}>
                  No incidents match the active search or filter criteria.
                </td>
              </tr>
            ) : (
              filtered.map((inc, idx) => {
                const mName = merchantNames[inc.merchant_id] || inc.merchant_id;
                return (
                  <tr
                    key={`${inc.incident_id}-${idx}`}
                    style={{
                      borderBottom: '1px solid var(--border-subtle)',
                      transition: 'background 0.15s ease',
                      cursor: 'pointer',
                    }}
                    onClick={() => onSelectIncident(inc.merchant_id, inc.incident_id)}
                  >
                    <td style={{ padding: '0.7rem 1rem', fontFamily: 'monospace', fontWeight: 600, color: 'var(--text-primary)' }}>
                      <div>{inc.incident_id}</div>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{inc.incident_type}</span>
                    </td>
                    <td style={{ padding: '0.7rem 1rem' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{mName}</div>
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{inc.merchant_id}</div>
                    </td>
                    <td style={{ padding: '0.7rem 1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ color: riskColor(inc.risk_band), fontWeight: 700, fontVariantNumeric: 'tabular-nums', fontSize: '0.9rem' }}>
                          {inc.risk_score.toFixed(1)}
                        </span>
                        <span className={badgeClass(inc.risk_band)}>{inc.risk_band}</span>
                      </div>
                    </td>
                    <td style={{ padding: '0.7rem 1rem' }}>
                      <span style={{
                        padding: '0.2rem 0.5rem',
                        borderRadius: '4px',
                        fontSize: '0.68rem',
                        fontWeight: 600,
                        background: inc.status === 'CONTAINED' || inc.status === 'RESOLVED' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                        color: inc.status === 'CONTAINED' || inc.status === 'RESOLVED' ? '#10b981' : '#60a5fa',
                        border: `1px solid ${inc.status === 'CONTAINED' || inc.status === 'RESOLVED' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(59, 130, 246, 0.3)'}`
                      }}>
                        {inc.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td style={{ padding: '0.7rem 1rem', color: 'var(--text-secondary)' }}>
                      {inc.evidence_event_ids?.length || 0} events
                    </td>
                    <td style={{ padding: '0.7rem 1rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', fontSize: '0.72rem' }}>
                      {formatTime(inc.created_at)}
                    </td>
                    <td style={{ padding: '0.7rem 1rem' }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectIncident(inc.merchant_id, inc.incident_id);
                        }}
                        style={{
                          background: 'rgba(59, 130, 246, 0.12)',
                          border: '1px solid rgba(59, 130, 246, 0.3)',
                          color: '#60a5fa',
                          borderRadius: '6px',
                          padding: '0.3rem 0.65rem',
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        Investigate →
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Merchant View with Unified AI Investigator Workspace ──
function MerchantView({
  merchantId, risk, profile, events, incidents, activeIncident, loading, onInject, injecting,
  scenarioResult, onBack, investigation, audit, investigationState, investigationError,
  stageProgress, onRunInvestigation, onSelectIncident, onUpdateStatus, onSubmitFeedback, statusUpdating
}: {
  merchantId: string; risk: RiskAssessment | null; profile: MerchantProfile | null;
  events: MerchantEvent[]; incidents: Incident[]; activeIncident: Incident | null; loading: boolean;
  onInject: (type: string) => void; injecting: boolean; scenarioResult: ScenarioResult | null; onBack: () => void;
  investigation: AIInvestigationResult | null; audit: InvestigationAuditRecord | null;
  investigationState: InvestigationState; investigationError: string | null;
  stageProgress: { index: number; label: string; status: 'PENDING' | 'RUNNING' | 'COMPLETED'; detail?: string }[];
  onRunInvestigation: (incidentId: string) => void;
  onSelectIncident?: (incidentId: string) => void;
  onUpdateStatus: (status: string) => void;
  onSubmitFeedback: (outcome: string) => void;
  statusUpdating: boolean;
}) {
  if (loading || !risk || !profile) return <LoadingGrid />;

  const merchantIncidents = incidents
    .filter(i => i.merchant_id === merchantId)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const merchantIncident = activeIncident || (merchantIncidents.length > 0 ? merchantIncidents[0] : null);

  return (
    <div className="animate-in">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button className="btn btn-ghost" onClick={onBack}>← Back</button>
          <h1 style={{ fontSize: '1.2rem', fontWeight: 700 }}>{merchantId}</h1>
          <span className={badgeClass(risk.risk_band)}>{risk.risk_band}</span>
          {merchantIncidents.length > 1 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'rgba(255,255,255,0.06)', padding: '0.2rem 0.6rem', borderRadius: 6 }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Incident:</span>
              <select
                id="merchant-incident-selector"
                value={merchantIncident?.incident_id || ''}
                onChange={(e) => onSelectIncident && onSelectIncident(e.target.value)}
                style={{
                  background: 'rgba(15, 23, 42, 0.9)',
                  color: '#60a5fa',
                  border: '1px solid rgba(59, 130, 246, 0.4)',
                  borderRadius: 4,
                  padding: '0.2rem 0.5rem',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                {merchantIncidents.map(inc => (
                  <option key={inc.incident_id} value={inc.incident_id}>
                    {inc.incident_id} ({inc.risk_band} {inc.risk_score.toFixed(1)}) · {inc.incident_type}
                  </option>
                ))}
              </select>
            </div>
          ) : merchantIncident ? (
            <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.55rem', borderRadius: 4, background: 'rgba(255,255,255,0.08)', color: 'var(--text-secondary)' }}>
              Active Incident: <strong style={{ color: '#60a5fa' }}>{merchantIncident.incident_id}</strong> (v{merchantIncident.evidence_version || 1})
            </span>
          ) : null}
        </div>
      </div>

      {/* Risk Score + Behavioral Genome row */}
      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.5rem' }}>Deterministic Risk Score</div>
          <div className="risk-score-display" style={{ color: riskColor(risk.risk_band) }}>{risk.risk_score.toFixed(1)}</div>
          <div style={{ marginTop: '0.5rem' }}><span className={badgeClass(risk.risk_band)}>{risk.risk_band}</span></div>
          <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginTop: '0.75rem' }}>Engine: {risk.model_version}</div>
        </div>

        <div className="card">
          <h3 style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>Merchant Behavioral Genome Baseline</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', fontSize: '0.75rem' }}>
            <ProfileStat label="Known Devices" value={profile.known_devices.length} />
            <ProfileStat label="Known Countries" value={profile.known_countries.join(', ') || 'IN'} />
            <ProfileStat label="Known ASNs" value={profile.known_asns.length} />
            <ProfileStat label="Total Baseline Events" value={profile.total_events.toLocaleString()} />
            <ProfileStat label="Sensitive Actions" value={profile.sensitive_action_count} />
            <ProfileStat label="API Rate (avg/hr)" value={profile.api_rate_baseline.mean?.toFixed(1) || '0'} />
          </div>
        </div>
      </div>

      {/* ────────────────────────────────────────────── */}
      {/* RISK SŪTRA PRODUCTION AI INVESTIGATOR WORKSPACE */}
      {/* ────────────────────────────────────────────── */}
      <div className="card" style={{
        marginBottom: '1.5rem',
        border: '1px solid rgba(59,130,246,0.3)',
        background: 'linear-gradient(180deg, rgba(17,24,39,0.95) 0%, rgba(15,23,42,0.9) 100%)',
        minWidth: 0,
        overflowWrap: 'anywhere'
      }}>
        {/* Authoritative Single Header Action Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', paddingBottom: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.08)', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '1.2rem' }}>🤖</span>
            <div>
              <h2 style={{ fontSize: '0.95rem', fontWeight: 700, letterSpacing: '0.05em', color: '#60a5fa' }}>RISK SŪTRA AI INVESTIGATOR</h2>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Evidence-grounded security reasoning, case memory & resolution planning</div>
            </div>
          </div>

          {/* PART 2: EXACTLY ONE RELEVANT ACTION BUTTON (No duplicate controls) */}
          {merchantIncident && (
            <div>
              {investigationState === 'RUNNING' && (
                <button
                  id="btn-ai-investigating"
                  className="btn btn-ghost"
                  disabled
                  style={{ border: '1px solid rgba(59,130,246,0.4)', color: '#60a5fa', fontSize: '0.8rem', opacity: 0.85 }}
                >
                  ⏳ Investigating Pipeline…
                </button>
              )}

              {investigationState === 'COMPLETED' && (
                <button
                  id="btn-rerun-ai-investigation"
                  className="btn btn-ghost"
                  style={{ border: '1px solid rgba(59,130,246,0.4)', color: '#60a5fa', fontSize: '0.8rem', fontWeight: 600 }}
                  onClick={() => onRunInvestigation(merchantIncident.incident_id)}
                >
                  🔄 Re-run AI Investigation
                </button>
              )}

              {investigationState === 'FAILED' && (
                <button
                  id="btn-try-again-ai"
                  className="btn btn-danger"
                  style={{ fontSize: '0.8rem', fontWeight: 600 }}
                  onClick={() => onRunInvestigation(merchantIncident.incident_id)}
                >
                  ⚠️ Try Again
                </button>
              )}

              {investigationState === 'NOT_RUN' && (
                <button
                  id="btn-run-ai-investigation"
                  className="btn btn-primary"
                  style={{ background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)', color: '#ffffff', padding: '0.5rem 1.1rem', fontWeight: 600, fontSize: '0.8rem' }}
                  onClick={() => onRunInvestigation(merchantIncident.incident_id)}
                >
                  🤖 Run AI Investigation
                </button>
              )}
            </div>
          )}
        </div>

        {/* ── STATE 1: RUNNING ── */}
        {investigationState === 'RUNNING' && (
          <div style={{ padding: '1.25rem', background: 'rgba(15,23,42,0.8)', borderRadius: 8, border: '1px solid rgba(59,130,246,0.3)', marginBottom: '1rem' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#60a5fa', marginBottom: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span className="animate-spin" style={{ display: 'inline-block' }}>⚙</span> EXECUTING REAL AGENT INVESTIGATION PIPELINE...
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {stageProgress.map((stage, idx) => (
                <div key={`${stage.index}-${idx}`} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.45rem 0.75rem',
                  background: stage.status === 'RUNNING' ? 'rgba(59,130,246,0.15)' : (stage.status === 'COMPLETED' ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.02)'),
                  borderRadius: 6,
                  border: stage.status === 'RUNNING' ? '1px solid rgba(59,130,246,0.4)' : '1px solid transparent',
                  fontSize: '0.75rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <span style={{
                      width: 20, height: 20, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.65rem', fontWeight: 700,
                      background: stage.status === 'COMPLETED' ? '#10b981' : (stage.status === 'RUNNING' ? '#3b82f6' : 'rgba(255,255,255,0.1)'),
                      color: stage.status === 'PENDING' ? 'var(--text-muted)' : '#ffffff'
                    }}>
                      {stage.status === 'COMPLETED' ? '✓' : stage.index}
                    </span>
                    <span style={{
                      fontWeight: stage.status === 'RUNNING' ? 700 : 500,
                      color: stage.status === 'COMPLETED' ? '#34d399' : (stage.status === 'RUNNING' ? '#60a5fa' : 'var(--text-muted)')
                    }}>
                      {stage.label}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    {stage.status === 'RUNNING' && <span style={{ color: '#60a5fa', fontWeight: 600 }}>Processing…</span>}
                    {stage.status === 'COMPLETED' && <span style={{ color: '#10b981' }}>{stage.detail || 'Completed'}</span>}
                    {stage.status === 'PENDING' && <span style={{ color: 'var(--text-muted)' }}>Pending</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── STATE 2: FAILED ── */}
        {investigationState === 'FAILED' && (
          <div style={{ textAlign: 'center', padding: '2rem 1.5rem', background: 'rgba(239,68,68,0.08)', borderRadius: 8, border: '1px solid rgba(239,68,68,0.3)', marginBottom: '1rem' }}>
            <div style={{ fontSize: '1.8rem', marginBottom: '0.5rem' }}>⚠️</div>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--risk-high)', marginBottom: '0.3rem' }}>
              AI Investigation Failed
            </h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', maxWidth: 480, margin: '0 auto', lineHeight: 1.4, marginBottom: '1rem' }}>
              {investigationError || 'The investigation pipeline encountered an error. Deterministic risk scores and evidence remain intact.'}
            </p>
          </div>
        )}

        {/* ── STATE 3: NOT_RUN ── */}
        {investigationState === 'NOT_RUN' && (
          <div id="ai-investigation-not-run" style={{ textAlign: 'center', padding: '2.5rem 1.5rem', background: 'rgba(0,0,0,0.25)', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🛡️</div>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.3rem' }}>
              Investigation not started.
            </h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', maxWidth: 520, margin: '0 auto', lineHeight: 1.5 }}>
              Deterministic risk assessment indicates <strong>{risk.risk_band}</strong> risk (score: {risk.risk_score.toFixed(1)}).
              Click <strong>&quot;Run AI Investigation&quot;</strong> above to start the forensic analysis pipeline across behavioral genome, temporal graph, historical cases, and resolution planning.
            </p>
          </div>
        )}

        {/* ── STATE 4: COMPLETED (PART 7, 12, 13, 24, 25, 26) ── */}
        {investigationState === 'COMPLETED' && investigation && (
          <div>
            {/* Assessment Header Verdict Banner */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.3)', padding: '0.85rem 1.25rem', borderRadius: 8, marginBottom: '1.25rem', border: '1px solid var(--border-subtle)', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.2rem' }}>ASSESSMENT VERDICT</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{
                    fontSize: '1.1rem', fontWeight: 800, letterSpacing: '0.05em',
                    color: investigation.assessment === 'LIKELY_ATO' ? 'var(--risk-critical)' : (investigation.assessment === 'SUSPICIOUS' ? 'var(--risk-high)' : '#10b981')
                  }}>
                    {investigation.assessment.replace(/_/g, ' ')}
                  </span>
                  <span style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem', borderRadius: 12, background: 'rgba(59,130,246,0.15)', color: '#60a5fa', fontWeight: 600 }}>
                    {(investigation.confidence * 100).toFixed(0)}% Confidence
                  </span>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Deterministic Risk Reference</div>
                <div style={{ fontSize: '1rem', fontWeight: 700, color: riskColor(risk.risk_band) }}>{risk.risk_score.toFixed(1)} ({risk.risk_band})</div>
              </div>
            </div>

            {/* Executive Summary & Narrative (What Happened & Why It Matters) */}
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
                EXECUTIVE SUMMARY & FORENSIC SYNTHESIS
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)', lineHeight: 1.5, background: 'rgba(255,255,255,0.03)', padding: '0.85rem', borderRadius: 6, borderLeft: '3px solid #60a5fa' }}>
                <div style={{ fontWeight: 600, color: '#93c5fd', marginBottom: '0.4rem' }}>
                  {investigation.what_happened || investigation.summary}
                </div>
                <div style={{ color: 'var(--text-secondary)' }}>
                  {investigation.why_it_matters || investigation.why_this_matters}
                </div>
                {investigation.root_cause_hypotheses && investigation.root_cause_hypotheses.length > 0 && (
                  <div style={{ marginTop: '0.6rem', paddingTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)' }}>ROOT-CAUSE HYPOTHESES: </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      {investigation.root_cause_hypotheses.join(' · ')}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Attack Progression Timeline */}
            {investigation.attack_progression.length > 0 && (
              <div style={{ marginBottom: '1.25rem' }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.6rem' }}>ATTACK PROGRESSION PHASES</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {investigation.attack_progression.map((stage, idx) => (
                    <div key={idx} style={{
                      display: 'flex', gap: '0.75rem', background: 'rgba(0,0,0,0.2)', padding: '0.6rem 0.8rem', borderRadius: 6,
                      borderLeft: stage.stage.toLowerCase().includes('benign') || stage.stage.toLowerCase().includes('verified') ? '2px solid #10b981' : '2px solid var(--risk-high)',
                    }}>
                      <div style={{
                        width: 24, height: 24, borderRadius: '50%',
                        background: stage.stage.toLowerCase().includes('benign') ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)',
                        color: stage.stage.toLowerCase().includes('benign') ? '#10b981' : 'var(--risk-high)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.75rem', flexShrink: 0
                      }}>
                        {idx + 1}
                      </div>
                      <div style={{ fontSize: '0.75rem', flex: 1 }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{stage.stage}</div>
                        <div style={{ color: 'var(--text-secondary)', marginTop: '0.2rem', lineHeight: 1.4 }}>{stage.explanation}</div>
                        {stage.event_ids.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.4rem' }}>
                            {stage.event_ids.map((eid, eIdx) => (
                              <span key={`${eid}-${eIdx}`} style={{
                                fontSize: '0.6rem', padding: '0.15rem 0.45rem', background: 'rgba(255,255,255,0.06)', borderRadius: 4, color: '#94a3b8'
                              }}>
                                {eid}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Key Evidence Citations */}
            {investigation.key_evidence.length > 0 && (
              <div style={{ marginBottom: '1.25rem' }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>KEY EVIDENCE CITATIONS</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.5rem' }}>
                  {investigation.key_evidence.map((ev, idx) => (
                    <div key={`${ev.event_id}-${ev.signal}-${idx}`} style={{ background: 'rgba(0,0,0,0.25)', padding: '0.6rem 0.8rem', borderRadius: 6, border: '1px solid var(--border-subtle)', fontSize: '0.75rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                        <span style={{ fontWeight: 700, color: '#38bdf8' }}>{ev.event_id}</span>
                        <span className={badgeClass(ev.severity)}>{ev.severity}</span>
                      </div>
                      <div style={{ fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.2rem' }}>{ev.signal}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{ev.reason}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* PART 12 & PART 25: HISTORICAL INTELLIGENCE & CASE MEMORY */}
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                HISTORICAL INTELLIGENCE & CASE MEMORY
              </div>
              {investigation.learning_intelligence && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <div style={{ background: 'rgba(0,0,0,0.3)', padding: '0.5rem 0.75rem', borderRadius: 6, border: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>Cases Analyzed</div>
                    <div style={{ fontSize: '1rem', fontWeight: 700, color: '#60a5fa' }}>{investigation.learning_intelligence.historical_cases_analyzed}</div>
                  </div>
                  <div style={{ background: 'rgba(0,0,0,0.3)', padding: '0.5rem 0.75rem', borderRadius: 6, border: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>Similar Patterns</div>
                    <div style={{ fontSize: '1rem', fontWeight: 700, color: '#38bdf8' }}>{investigation.learning_intelligence.similar_patterns_found}</div>
                  </div>
                  <div style={{ background: 'rgba(0,0,0,0.3)', padding: '0.5rem 0.75rem', borderRadius: 6, border: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>Confirmed ATO Matches</div>
                    <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--risk-high)' }}>{investigation.learning_intelligence.confirmed_ato_matches}</div>
                  </div>
                  <div style={{ background: 'rgba(0,0,0,0.3)', padding: '0.5rem 0.75rem', borderRadius: 6, border: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>Legitimate Matches</div>
                    <div style={{ fontSize: '1rem', fontWeight: 700, color: '#10b981' }}>{investigation.learning_intelligence.legitimate_matches}</div>
                  </div>
                  <div style={{ background: 'rgba(0,0,0,0.3)', padding: '0.5rem 0.75rem', borderRadius: 6, border: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>Pattern Match Confidence</div>
                    <div style={{ fontSize: '1rem', fontWeight: 700, color: '#a78bfa' }}>{investigation.learning_intelligence.pattern_confidence}%</div>
                  </div>
                </div>
              )}

              {investigation.historical_pattern_summary && (
                <div style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)', padding: '0.75rem', borderRadius: 6, fontSize: '0.75rem', marginBottom: '0.75rem', color: '#bfdbfe', lineHeight: 1.4 }}>
                  <strong style={{ color: '#60a5fa' }}>Memory Influence: </strong> {investigation.historical_pattern_summary}
                </div>
              )}

              {investigation.historical_matches && investigation.historical_matches.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.5rem' }}>
                  {investigation.historical_matches.map((m, idx) => (
                    <div key={`${m.incident_id}-${idx}`} style={{ background: 'rgba(0,0,0,0.25)', padding: '0.65rem 0.85rem', borderRadius: 6, border: '1px solid var(--border-subtle)', fontSize: '0.75rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                        <span style={{ fontWeight: 700, color: '#f8fafc' }}>{m.incident_id}</span>
                        <span style={{
                          padding: '0.15rem 0.5rem', borderRadius: 10, fontSize: '0.65rem', fontWeight: 700,
                          background: m.outcome === 'CONFIRMED_ATO' ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)',
                          color: m.outcome === 'CONFIRMED_ATO' ? 'var(--risk-high)' : '#10b981'
                        }}>
                          {m.outcome.replace(/_/g, ' ')} ({m.similarity_percentage}%)
                        </span>
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                        <strong>Pattern:</strong> {m.pattern}
                      </div>
                      <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>
                        <strong>Resolution:</strong> {m.resolution}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Legitimate Explanations Evaluated */}
            {investigation.legitimate_explanations_considered.length > 0 && (
              <div style={{ marginBottom: '1.25rem' }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>LEGITIMATE EXPLANATIONS CONSIDERED</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {investigation.legitimate_explanations_considered.map((leg, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.2)', padding: '0.6rem 0.8rem', borderRadius: 6, fontSize: '0.75rem' }}>
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{leg.hypothesis}</div>
                        {leg.counter_evidence.length > 0 && (
                          <div style={{ fontSize: '0.65rem', color: 'var(--risk-high)', marginTop: '0.2rem' }}>
                            Counter-evidence: {leg.counter_evidence.join(', ')}
                          </div>
                        )}
                      </div>
                      <span style={{
                        padding: '0.2rem 0.6rem', borderRadius: 12, fontWeight: 700, fontSize: '0.65rem',
                        background: leg.status === 'REJECTED' ? 'rgba(239,68,68,0.15)' : (leg.status === 'SUPPORTED' ? 'rgba(16,185,129,0.15)' : 'rgba(234,179,8,0.15)'),
                        color: leg.status === 'REJECTED' ? 'var(--risk-high)' : (leg.status === 'SUPPORTED' ? '#10b981' : 'var(--risk-medium)')
                      }}>
                        {leg.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* PART 13 & PART 14: RESOLUTION & RECOVERY PLAN */}
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                RESOLUTION & RECOVERY PLAN (DEFENSE-ONLY)
              </div>
              <div style={{ background: 'rgba(16,185,129,0.04)', padding: '0.85rem', borderRadius: 6, border: '1px solid rgba(16,185,129,0.2)', fontSize: '0.75rem' }}>
                {/* Immediate Actions */}
                {investigation.immediate_actions && investigation.immediate_actions.length > 0 && (
                  <div style={{ marginBottom: '0.75rem' }}>
                    <div style={{ fontWeight: 700, color: '#f87171', marginBottom: '0.3rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <span>🔴</span> IMMEDIATE DEFENSIVE ACTIONS (NEXT 0–15 MIN)
                    </div>
                    <ul style={{ margin: 0, paddingLeft: '1.2rem', color: 'var(--text-primary)', lineHeight: 1.4 }}>
                      {investigation.immediate_actions.map((act, i) => <li key={i}>{act}</li>)}
                    </ul>
                  </div>
                )}

                {/* Containment Actions */}
                {investigation.containment_actions && investigation.containment_actions.length > 0 && (
                  <div style={{ marginBottom: '0.75rem' }}>
                    <div style={{ fontWeight: 700, color: '#fbbf24', marginBottom: '0.3rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <span>🟡</span> CONTAINMENT & EVIDENCE PRESERVATION (NEXT 15–60 MIN)
                    </div>
                    <ul style={{ margin: 0, paddingLeft: '1.2rem', color: 'var(--text-primary)', lineHeight: 1.4 }}>
                      {investigation.containment_actions.map((act, i) => <li key={i}>{act}</li>)}
                    </ul>
                  </div>
                )}

                {/* Recovery Actions & Estimated Window */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.75rem', marginTop: '0.6rem', paddingTop: '0.6rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  {investigation.resolution_conditions && (
                    <div>
                      <div style={{ fontWeight: 700, color: '#34d399', marginBottom: '0.3rem' }}>RECOVERY CONDITIONS:</div>
                      <ul style={{ margin: 0, paddingLeft: '1.2rem', color: '#cbd5e1', lineHeight: 1.4 }}>
                        {investigation.resolution_conditions.map((cond, i) => <li key={i}>{cond}</li>)}
                      </ul>
                    </div>
                  )}
                  <div>
                    <div style={{ fontWeight: 700, color: '#60a5fa', marginBottom: '0.3rem' }}>ESTIMATED RESOLUTION WINDOW:</div>
                    <div style={{ color: '#bfdbfe', lineHeight: 1.4 }}>
                      {investigation.estimated_resolution_window || '15–30 min containment, 1–2 hours operational verification'}
                    </div>
                    {investigation.monitoring_requirements && (
                      <div style={{ marginTop: '0.5rem' }}>
                        <div style={{ fontWeight: 700, color: '#94a3b8', marginBottom: '0.2rem' }}>MONITORING REQUIREMENTS:</div>
                        <ul style={{ margin: 0, paddingLeft: '1.2rem', color: '#cbd5e1', fontSize: '0.7rem' }}>
                          {investigation.monitoring_requirements.map((req, i) => <li key={i}>{req}</li>)}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* PART 26: INCIDENT LIFECYCLE & CONTINUOUS LEARNING LOOP */}
            <div style={{ marginBottom: '1.25rem', padding: '0.85rem', background: 'rgba(0,0,0,0.3)', borderRadius: 6, border: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div>
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    INCIDENT LIFECYCLE MANAGEMENT
                  </span>
                  <span style={{ marginLeft: '0.75rem', fontSize: '0.75rem', padding: '0.15rem 0.5rem', borderRadius: 4, background: 'rgba(59,130,246,0.15)', color: '#60a5fa', fontWeight: 600 }}>
                    Status: {merchantIncident ? merchantIncident.status : 'OPEN'}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    className="btn btn-ghost"
                    style={{ fontSize: '0.7rem', border: '1px solid rgba(234,179,8,0.4)', color: '#fbbf24' }}
                    onClick={() => onUpdateStatus('CONTAINED')}
                    disabled={statusUpdating}
                  >
                    Mark as CONTAINED
                  </button>
                  <button
                    className="btn btn-ghost"
                    style={{ fontSize: '0.7rem', border: '1px solid rgba(59,130,246,0.4)', color: '#60a5fa' }}
                    onClick={() => onUpdateStatus('RECOVERING')}
                    disabled={statusUpdating}
                  >
                    Mark as RECOVERING
                  </button>
                  <button
                    className="btn btn-ghost"
                    style={{ fontSize: '0.7rem', border: '1px solid rgba(16,185,129,0.4)', color: '#10b981' }}
                    onClick={() => onUpdateStatus('RESOLVED')}
                    disabled={statusUpdating}
                  >
                    Mark as RESOLVED
                  </button>
                </div>
              </div>

              {/* Learning Loop Analyst Feedback Buttons */}
              <div style={{ paddingTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
                  Calibrate Case Memory (Learning Feedback Loop):
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button
                    className="btn btn-ghost"
                    style={{ fontSize: '0.68rem', background: 'rgba(239,68,68,0.1)', color: '#f87171' }}
                    onClick={() => onSubmitFeedback('CONFIRMED_ATO')}
                  >
                    🚨 Verified Threat (ATO)
                  </button>
                  <button
                    className="btn btn-ghost"
                    style={{ fontSize: '0.68rem', background: 'rgba(16,185,129,0.1)', color: '#34d399' }}
                    onClick={() => onSubmitFeedback('LEGITIMATE_SPIKE')}
                  >
                    📈 Verified Legitimate Campaign
                  </button>
                  <button
                    className="btn btn-ghost"
                    style={{ fontSize: '0.68rem', background: 'rgba(59,130,246,0.1)', color: '#60a5fa' }}
                    onClick={() => onSubmitFeedback('FALSE_POSITIVE')}
                  >
                    🛡️ Verified False Positive
                  </button>
                </div>
              </div>
            </div>

            {/* Audit Trail & Runtime Metadata */}
            {audit && (
              <div style={{ paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.08)', fontSize: '0.65rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div>
                  <span>Run ID: <strong style={{ color: '#60a5fa' }}>{audit.audit_id}</strong></span>
                  <span style={{ marginLeft: '1rem' }}>Provider: <strong style={{ color: '#94a3b8' }}>{audit.provider} ({audit.model_name})</strong></span>
                  <span style={{ marginLeft: '1rem' }}>Tools Called: <strong style={{ color: '#94a3b8' }}>{audit.tools_called.length} ({audit.tools_called.join(', ') || 'None'})</strong></span>
                </div>
                <div>
                  <span>Duration: <strong style={{ color: '#94a3b8' }}>{audit.duration_ms.toFixed(0)} ms</strong></span>
                  <span style={{ marginLeft: '1rem' }}>Investigator: <strong style={{ color: '#94a3b8' }}>{audit.investigator_version}</strong></span>
                  <span style={{ marginLeft: '1rem' }}>Run Time: <strong style={{ color: '#94a3b8' }}>{formatTime(audit.start_time)}</strong></span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Top Signals */}
      {risk.top_signals.length > 0 && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>Active Risk Signals</h3>
          {risk.top_signals.map((sig, idx) => (
            <div key={`${sig.signal_id}-${idx}`} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.5rem 0', borderBottom: '1px solid var(--border-subtle)' }}>
              <span className={badgeClass(sig.severity)} style={{ minWidth: 70, justifyContent: 'center' }}>{sig.severity}</span>
              <span style={{ fontWeight: 600, fontSize: '0.8rem', flex: 1 }}>{sig.signal_type.replace(/_/g, ' ')}</span>
              <div style={{ width: 120 }}>
                <div className="signal-bar"><div className="signal-bar-fill" style={{ width: `${sig.value * 100}%`, background: riskColor(sig.severity) }} /></div>
              </div>
              <span style={{ fontWeight: 700, fontSize: '0.8rem', fontVariantNumeric: 'tabular-nums', color: riskColor(sig.severity), minWidth: 40, textAlign: 'right' }}>{(sig.value * 100).toFixed(0)}%</span>
            </div>
          ))}
        </div>
      )}

      {/* Scenario Injection (Explicit User Action) */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>Scenario Injection (Explicit Security Evaluation)</h3>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button id="btn-inject-ato" className="btn btn-danger" onClick={() => onInject('ato_credential_theft')} disabled={injecting}>
            {injecting ? '⏳ Injecting…' : '⚡ Inject ATO Attack Scenario'}
          </button>
          <button id="btn-inject-legitimate" className="btn btn-ghost" onClick={() => onInject('legitimate_spike')} disabled={injecting}>
            📈 Inject Legitimate Campaign Spike
          </button>
        </div>
        {scenarioResult && (
          <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'var(--bg-primary)', borderRadius: 8, fontSize: '0.75rem' }}>
            <div style={{ fontWeight: 600, marginBottom: '0.5rem', color: scenarioResult.incident_created ? 'var(--risk-high)' : 'var(--risk-low)' }}>
              {scenarioResult.incident_created ? '🚨 NEW INCIDENT TELEMETRY INJECTED & SENT TO AI INVESTIGATOR' : '✓ Legitimate spike scenario injected (Baseline Evaluated)'}
            </div>
            <div style={{ color: 'var(--text-secondary)' }}>
              Events: {scenarioResult.events_injected} · Scenario: {scenarioResult.scenario.scenario_type}
              {scenarioResult.risk_assessment && <> · Risk Score: <span style={{ color: riskColor(scenarioResult.risk_assessment.risk_band), fontWeight: 700 }}>{scenarioResult.risk_assessment.risk_score.toFixed(1)}</span></>}
            </div>
          </div>
        )}
      </div>

      {/* Recent Events */}
      <div className="card">
        <h3 style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>Recent Merchant Telemetry Events</h3>
        <div style={{ maxHeight: 300, overflowY: 'auto' }}>
          {events.map((ev, idx) => (
            <div key={`${ev.event_id}-${idx}`} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.4rem 0', borderBottom: '1px solid var(--border-subtle)', fontSize: '0.75rem' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.65rem', minWidth: 130, fontVariantNumeric: 'tabular-nums' }}>{formatTime(ev.timestamp)}</span>
              <span className={`event-type-pill ${SENSITIVE_EVENTS.has(ev.event_type) ? 'sensitive' : ''}`}>{ev.event_type}</span>
              {ev.device_id && <span style={{ color: 'var(--text-muted)', fontSize: '0.65rem' }}>📱 {ev.device_id.slice(0, 12)}</span>}
              {ev.country && <span style={{ color: 'var(--text-muted)', fontSize: '0.65rem' }}>🌐 {ev.country}</span>}
              {ev.amount != null && <span style={{ color: 'var(--accent-cyan)', fontWeight: 600 }}>₹{ev.amount.toLocaleString()}</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Small Presentation Components ──
function StatCard({ label, value, accent }: { label: string; value: number | string; accent?: string }) {
  return (
    <div className="card">
      <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.4rem' }}>{label}</div>
      <div className="stat-value" style={accent ? { background: 'none', WebkitTextFillColor: accent, color: accent } : {}}>{value}</div>
    </div>
  );
}

function ProfileStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.2rem' }}>{label}</div>
      <div style={{ fontWeight: 600 }}>{value}</div>
    </div>
  );
}

function LoadingGrid() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', marginTop: '2rem' }}>
      {[1, 2, 3, 4].map(i => <div key={i} className="loading-shimmer" style={{ height: 120 }} />)}
    </div>
  );
}
