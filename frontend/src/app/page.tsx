'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  api, Overview, MerchantProfile, RiskAssessment, MerchantEvent, Incident, ScenarioResult,
  AIInvestigationResult, InvestigationAuditRecord
} from '@/lib/api';
import { RiskSutraLogo } from '@/components/branding/RiskSutraLogo';

// ── Helpers ──
function riskColor(band: string) {
  const map: Record<string, string> = { LOW: 'var(--risk-low)', MEDIUM: 'var(--risk-medium)', HIGH: 'var(--risk-high)', CRITICAL: 'var(--risk-critical)' };
  return map[band] || 'var(--text-muted)';
}
function badgeClass(band: string) {
  return `badge badge-${band.toLowerCase()}`;
}
function formatTime(ts: string) {
  return new Date(ts).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
const SENSITIVE_EVENTS = new Set(['CONFIG_CHANGE', 'PAYOUT_EVENT', 'ACCOUNT_ACTION', 'AUTH_FAILURE']);

type View = 'overview' | 'merchant';

export default function Dashboard() {
  const [view, setView] = useState<View>('overview');
  const [overview, setOverview] = useState<Overview | null>(null);
  const [selectedMerchant, setSelectedMerchant] = useState<string | null>(null);
  const [profile, setProfile] = useState<MerchantProfile | null>(null);
  const [risk, setRisk] = useState<RiskAssessment | null>(null);
  const [events, setEvents] = useState<MerchantEvent[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scenarioResult, setScenarioResult] = useState<ScenarioResult | null>(null);
  const [injecting, setInjecting] = useState(false);

  // AI Investigator State
  const [investigation, setInvestigation] = useState<AIInvestigationResult | null>(null);
  const [audit, setAudit] = useState<InvestigationAuditRecord | null>(null);
  const [investigating, setInvestigating] = useState(false);
  const [stageProgress, setStageProgress] = useState<{ index: number; label: string; status: 'PENDING' | 'RUNNING' | 'COMPLETED'; detail?: string }[]>([
    { index: 1, label: 'Loading merchant behavioral context', status: 'PENDING' },
    { index: 2, label: 'Reviewing risk signals', status: 'PENDING' },
    { index: 3, label: 'Reconstructing temporal workflow', status: 'PENDING' },
    { index: 4, label: 'Checking entity relationships', status: 'PENDING' },
    { index: 5, label: 'Comparing legitimate explanations', status: 'PENDING' },
    { index: 6, label: 'Retrieving supporting evidence', status: 'PENDING' },
    { index: 7, label: 'Synthesizing investigation', status: 'PENDING' },
    { index: 8, label: 'Producing assessment', status: 'PENDING' },
    { index: 9, label: 'Persisting investigation', status: 'PENDING' },
    { index: 10, label: 'Investigation complete', status: 'PENDING' },
  ]);

  const loadOverview = useCallback(async () => {
    try {
      setLoading(true); setError(null);
      const [ov, inc] = await Promise.all([api.getOverview(), api.getIncidents()]);
      setOverview(ov); setIncidents(inc.incidents);
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed to load'); }
    finally { setLoading(false); }
  }, []);

  const loadMerchant = useCallback(async (id: string) => {
    try {
      setLoading(true); setError(null);
      setInvestigation(null); setAudit(null);
      const [r, p, ev, incList] = await Promise.all([
        api.getMerchantRisk(id), api.getMerchantProfile(id), api.getMerchantEvents(id, 30), api.getIncidents(50)
      ]);
      setRisk(r); setProfile(p); setEvents(ev.events); setSelectedMerchant(id);

      // Find newest active incident for merchant
      const merchantIncidents = incList.incidents.filter(i => i.merchant_id === id);
      const activeInc = merchantIncidents.length > 0 ? merchantIncidents[0] : null;

      if (activeInc) {
        try {
          const invData = await api.getInvestigation(activeInc.incident_id);
          // Strict verification: investigation must belong to active incident and merchant
          if (invData && invData.incident_id === activeInc.incident_id) {
            setInvestigation(invData);
            const auditData = await api.getInvestigationAudit(activeInc.incident_id);
            setAudit(auditData);
          } else {
            setInvestigation(null);
            setAudit(null);
          }
        } catch (e) {
          // Status NOT_RUN: stays empty until user manually clicks Run AI Investigation
          setInvestigation(null);
          setAudit(null);
        }
      } else {
        setInvestigation(null);
        setAudit(null);
      }
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed to load merchant'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadOverview(); }, [loadOverview]);

  const selectMerchant = (id: string) => { setView('merchant'); loadMerchant(id); };
  const goHome = () => { setView('overview'); setScenarioResult(null); loadOverview(); };

  const injectScenario = async (type: string) => {
    if (!selectedMerchant || injecting) return;
    setInjecting(true); setScenarioResult(null);
    try {
      const result = await api.injectScenario(selectedMerchant, type);
      setScenarioResult(result);
      await loadMerchant(selectedMerchant);
      await loadOverview();

      // AUTOMATICALLY RUN AI INVESTIGATION FOR SCENARIO INJECTION
      const targetIncId = result.incident_id || (result.incident_created && result.incident_created.incident_id);
      if (targetIncId) {
        runInvestigation(targetIncId);
      }
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Injection failed'); }
    finally { setInjecting(false); }
  };

  const runInvestigation = (incidentId: string) => {
    if (investigating) return;
    setInvestigating(true);
    setInvestigation(null);
    setAudit(null);
    const initialStages: { index: number; label: string; status: 'PENDING' | 'RUNNING' | 'COMPLETED'; detail?: string }[] = [
      { index: 1, label: 'Loading merchant behavioral context', status: 'PENDING' },
      { index: 2, label: 'Reviewing risk signals', status: 'PENDING' },
      { index: 3, label: 'Reconstructing temporal workflow', status: 'PENDING' },
      { index: 4, label: 'Checking entity relationships', status: 'PENDING' },
      { index: 5, label: 'Comparing legitimate explanations', status: 'PENDING' },
      { index: 6, label: 'Retrieving supporting evidence', status: 'PENDING' },
      { index: 7, label: 'Synthesizing investigation', status: 'PENDING' },
      { index: 8, label: 'Producing assessment', status: 'PENDING' },
      { index: 9, label: 'Persisting investigation', status: 'PENDING' },
      { index: 10, label: 'Investigation complete', status: 'PENDING' },
    ];
    setStageProgress(initialStages);

    api.streamInvestigation(
      incidentId,
      (event) => {
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
        setInvestigation(data.investigation);
        setAudit(data.audit);
        setInvestigating(false);
      },
      (err) => {
        setError(err.message || 'Investigation failed');
        setInvestigating(false);
      }
    );
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-brand" style={{ padding: '1.25rem 1.25rem' }}>
          <RiskSutraLogo variant="full" size="md" onClick={goHome} animated={true} />
        </div>
        <nav className="sidebar-nav">
          <a className={`sidebar-link ${view === 'overview' ? 'active' : ''}`} onClick={goHome} style={{ cursor: 'pointer' }}>
            <span>◉</span> Overview
          </a>
          {overview?.merchant_risks.map(m => (
            <a key={m.merchant_id} className={`sidebar-link ${selectedMerchant === m.merchant_id && view === 'merchant' ? 'active' : ''}`}
              onClick={() => selectMerchant(m.merchant_id)} style={{ cursor: 'pointer' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: riskColor(m.risk_band), display: 'inline-block', flexShrink: 0 }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.merchant_name}</span>
            </a>
          ))}
          <div style={{ borderTop: '1px solid var(--border-subtle)', margin: '0.75rem 1.25rem' }} />
          <a className="sidebar-link" style={{ cursor: 'pointer', opacity: 0.5 }}>
            <span>⊞</span> Incidents ({incidents.length})
          </a>
          <a className="sidebar-link" style={{ cursor: 'pointer', opacity: 0.5 }}>
            <span>🤖</span> AI Investigator
          </a>
        </nav>
        <div style={{ padding: '0.75rem 1.25rem', borderTop: '1px solid var(--border-subtle)' }}>
          <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>RiskSūtra v0.3.0 · Day 3 Edition</div>
        </div>
      </aside>

      {/* Main */}
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
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }}></span> Live Protection Active
            </span>
          </div>
        </header>

        {error && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '0.75rem 1rem', marginBottom: '1rem', color: 'var(--risk-high)', fontSize: '0.8rem' }}>⚠ {error}</div>}

        {view === 'overview' ? (
          <OverviewView overview={overview} incidents={incidents} loading={loading} onSelectMerchant={selectMerchant} />
        ) : (
          <MerchantView
            merchantId={selectedMerchant!} risk={risk} profile={profile} events={events}
            incidents={incidents} loading={loading} onInject={injectScenario} injecting={injecting}
            scenarioResult={scenarioResult} onBack={goHome}
            investigation={investigation} audit={audit} investigating={investigating}
            stageProgress={stageProgress} onRunInvestigation={runInvestigation}
          />
        )}
      </main>
    </div>
  );
}

// ── Overview ──
function OverviewView({ overview, incidents, loading, onSelectMerchant }: {
  overview: Overview | null; incidents: Incident[]; loading: boolean; onSelectMerchant: (id: string) => void;
}) {
  if (loading || !overview) return <LoadingGrid />;
  return (
    <div className="animate-in">
      <h1 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '1.5rem' }}>Risk Overview</h1>
      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
        <StatCard label="Merchants" value={overview.total_merchants} />
        <StatCard label="Active Incidents" value={overview.active_incidents} accent={overview.active_incidents > 0 ? 'var(--risk-high)' : undefined} />
        <StatCard label="Total Incidents" value={overview.total_incidents} />
        <StatCard label="High/Critical" value={(overview.risk_distribution.HIGH || 0) + (overview.risk_distribution.CRITICAL || 0)}
          accent={(overview.risk_distribution.HIGH || 0) + (overview.risk_distribution.CRITICAL || 0) > 0 ? 'var(--risk-high)' : undefined} />
      </div>
      {/* Merchant Risk Table */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '1rem', color: 'var(--text-secondary)' }}>Merchant Risk Portfolio</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
          <thead><tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
            {['Merchant', 'Type', 'Risk Score', 'Band', ''].map(h => (
              <th key={h} style={{ textAlign: 'left', padding: '0.5rem 0.75rem', color: 'var(--text-muted)', fontWeight: 500, fontSize: '0.7rem', textTransform: 'uppercase' }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {overview.merchant_risks.map(m => (
              <tr key={m.merchant_id} style={{ borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer' }} onClick={() => onSelectMerchant(m.merchant_id)}>
                <td style={{ padding: '0.6rem 0.75rem', fontWeight: 500 }}>{m.merchant_name}</td>
                <td style={{ padding: '0.6rem 0.75rem', color: 'var(--text-muted)' }}>{m.merchant_type}</td>
                <td style={{ padding: '0.6rem 0.75rem' }}>
                  <span style={{ color: riskColor(m.risk_band), fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{m.risk_score.toFixed(1)}</span>
                </td>
                <td style={{ padding: '0.6rem 0.75rem' }}><span className={badgeClass(m.risk_band)}>{m.risk_band}</span></td>
                <td style={{ padding: '0.6rem 0.75rem', color: 'var(--text-muted)' }}>→</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Incidents */}
      {incidents.length > 0 && (
        <div className="card">
          <h2 style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '1rem', color: 'var(--text-secondary)' }}>Recent Incidents</h2>
          {incidents.slice(0, 5).map(inc => (
            <div key={inc.incident_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid var(--border-subtle)' }}>
              <div>
                <span style={{ fontWeight: 600, fontSize: '0.8rem' }}>{inc.incident_id.slice(0, 16)}</span>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginLeft: '0.75rem' }}>{inc.merchant_id}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ color: riskColor(inc.risk_band), fontWeight: 700, fontSize: '0.85rem' }}>{inc.risk_score.toFixed(1)}</span>
                <span className={badgeClass(inc.risk_band)}>{inc.risk_band}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Merchant Detail & AI Investigator Workspace ──
function MerchantView({
  merchantId, risk, profile, events, incidents, loading, onInject, injecting, scenarioResult, onBack,
  investigation, audit, investigating, stageProgress, onRunInvestigation
}: {
  merchantId: string; risk: RiskAssessment | null; profile: MerchantProfile | null;
  events: MerchantEvent[]; incidents: Incident[]; loading: boolean;
  onInject: (type: string) => void; injecting: boolean; scenarioResult: ScenarioResult | null; onBack: () => void;
  investigation: AIInvestigationResult | null; audit: InvestigationAuditRecord | null;
  investigating: boolean;
  stageProgress: { index: number; label: string; status: 'PENDING' | 'RUNNING' | 'COMPLETED'; detail?: string }[];
  onRunInvestigation: (incidentId: string) => void;
}) {
  if (loading || !risk || !profile) return <LoadingGrid />;

  const merchantIncident = incidents.find(i => i.merchant_id === merchantId);

  return (
    <div className="animate-in">
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
        <button className="btn btn-ghost" onClick={onBack}>← Back</button>
        <h1 style={{ fontSize: '1.2rem', fontWeight: 700 }}>{merchantId}</h1>
        <span className={badgeClass(risk.risk_band)}>{risk.risk_band}</span>
      </div>

      {/* Risk + Profile row */}
      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
        {/* Risk Score Card */}
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.5rem' }}>Deterministic Risk Score</div>
          <div className="risk-score-display" style={{ color: riskColor(risk.risk_band) }}>{risk.risk_score.toFixed(1)}</div>
          <div style={{ marginTop: '0.5rem' }}><span className={badgeClass(risk.risk_band)}>{risk.risk_band}</span></div>
          <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginTop: '0.75rem' }}>{risk.model_version}</div>
        </div>
        {/* Behavioral Genome */}
        <div className="card">
          <h3 style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>Behavioral Genome Baseline</h3>
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
      {/* RISK SŪTRA AI INVESTIGATOR WORKSPACE */}
      {/* ────────────────────────────────────────────── */}

      <div className="card" style={{ marginBottom: '1.5rem', border: '1px solid rgba(59,130,246,0.3)', background: 'linear-gradient(180deg, rgba(17,24,39,0.95) 0%, rgba(15,23,42,0.9) 100%)', minWidth: 0, overflowWrap: 'anywhere' }}>
        {/* Authoritative Single Header Action Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', paddingBottom: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.08)', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '1.1rem' }}>🤖</span>
            <div>
              <h2 style={{ fontSize: '0.95rem', fontWeight: 700, letterSpacing: '0.05em', color: '#60a5fa' }}>RISK SŪTRA AI INVESTIGATOR</h2>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Evidence-grounded attack synthesis & defensive assessment engine</div>
            </div>
          </div>

          {/* EXACTLY ONE AUTHORITATIVE ACTION BUTTON ACCORDING TO STATE MACHINE */}
          {merchantIncident && (
            <div>
              {investigating ? (
                <button
                  className="btn btn-ghost"
                  disabled
                  style={{ border: '1px solid rgba(59,130,246,0.4)', color: '#60a5fa', fontSize: '0.75rem', opacity: 0.8 }}
                >
                  ⏳ Investigating…
                </button>
              ) : investigation ? (
                <button
                  className="btn btn-ghost"
                  style={{ border: '1px solid rgba(59,130,246,0.4)', color: '#60a5fa', fontSize: '0.75rem', fontWeight: 600 }}
                  onClick={() => onRunInvestigation(merchantIncident.incident_id)}
                >
                  🔄 Re-run AI Investigation
                </button>
              ) : (
                <button
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

        {/* State 1: RUNNING — Live Real-Time Stage Progress Indicator */}
        {investigating && (
          <div style={{ padding: '1.25rem', background: 'rgba(15,23,42,0.8)', borderRadius: 8, border: '1px solid rgba(59,130,246,0.3)', marginBottom: '1rem' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#60a5fa', marginBottom: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span className="animate-spin" style={{ display: 'inline-block' }}>⚙</span> EXECUTING REAL AGENT INVESTIGATION PIPELINE...
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {stageProgress.map(stage => (
                <div key={stage.index} style={{
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
                    {stage.status === 'RUNNING' && <span style={{ color: '#60a5fa', fontWeight: 600 }}>Processing...</span>}
                    {stage.status === 'COMPLETED' && <span style={{ color: '#10b981' }}>{stage.detail || 'Completed'}</span>}
                    {stage.status === 'PENDING' && <span style={{ color: 'var(--text-muted)' }}>Pending</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* State 2: NOT_RUN — Clean Callout (NO duplicate buttons) */}
        {!investigation && !investigating && (
          <div style={{ textAlign: 'center', padding: '2rem 1.5rem', background: 'rgba(0,0,0,0.25)', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: '1.8rem', marginBottom: '0.5rem' }}>🔍</div>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.3rem' }}>
              Incident Detected (Deterministic Risk Score: {risk.risk_score.toFixed(1)})
            </h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', maxWidth: 480, margin: '0 auto', lineHeight: 1.4 }}>
              AI Investigation has not been run yet for this incident. Click <strong>"Run AI Investigation"</strong> in the top header to execute real-time, evidence-grounded agent analysis.
            </p>
          </div>
        )}

        {/* State 3: COMPLETED — Render Full Investigation Output */}
        {investigation && !investigating && (
          <div>
            {/* Assessment Header Row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.3)', padding: '0.85rem 1rem', borderRadius: 8, marginBottom: '1.25rem', border: '1px solid var(--border-subtle)' }}>
              <div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.2rem' }}>ASSESSMENT VERDICT</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{
                    fontSize: '1rem', fontWeight: 800, letterSpacing: '0.05em',
                    color: investigation.assessment === 'LIKELY_ATO' ? 'var(--risk-critical)' : (investigation.assessment === 'SUSPICIOUS' ? 'var(--risk-high)' : '#10b981')
                  }}>
                    {investigation.assessment.replace('_', ' ')}
                  </span>
                  <span style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem', borderRadius: 12, background: 'rgba(59,130,246,0.15)', color: '#60a5fa', fontWeight: 600 }}>
                    {(investigation.confidence * 100).toFixed(0)}% Confidence
                  </span>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Deterministic Risk Score</div>
                <div style={{ fontSize: '1rem', fontWeight: 700, color: riskColor(risk.risk_band) }}>{risk.risk_score.toFixed(1)}</div>
              </div>
            </div>

            {/* Why This Matters Narrative */}
            <div style={{ marginBottom: '1.25rem', minWidth: 0, overflowWrap: 'anywhere' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.4rem' }}>WHY THIS MATTERS</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)', lineHeight: 1.5, background: 'rgba(255,255,255,0.03)', padding: '0.75rem', borderRadius: 6, borderLeft: '3px solid #60a5fa', wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                {investigation.summary} {investigation.why_this_matters}
              </div>
            </div>

            {/* Attack Progression Timeline — Safe flex wrapping and break-word for long event IDs */}
            {investigation.attack_progression.length > 0 && (
              <div style={{ marginBottom: '1.25rem', minWidth: 0, overflowWrap: 'anywhere' }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.6rem' }}>ATTACK PROGRESSION</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', minWidth: 0 }}>
                  {investigation.attack_progression.map((stage, idx) => (
                    <div key={idx} style={{
                      display: 'flex', gap: '0.75rem', background: 'rgba(0,0,0,0.2)', padding: '0.6rem 0.8rem', borderRadius: 6, borderLeft: '2px solid var(--risk-high)',
                      minWidth: 0, overflowWrap: 'anywhere', wordBreak: 'break-word'
                    }}>
                      <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'rgba(239,68,68,0.2)', color: 'var(--risk-high)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.75rem', flexShrink: 0 }}>
                        {idx + 1}
                      </div>
                      <div style={{ fontSize: '0.75rem', flex: 1, minWidth: 0, overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{stage.stage}</div>
                        <div style={{ color: 'var(--text-secondary)', marginTop: '0.2rem', lineHeight: 1.4, wordBreak: 'break-word' }}>{stage.explanation}</div>
                        {stage.event_ids.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.4rem', minWidth: 0, maxWidth: '100%' }}>
                            {stage.event_ids.map((eid, eIdx) => (
                              <span key={`${eid}-${eIdx}`} style={{
                                fontSize: '0.6rem', padding: '0.15rem 0.45rem', background: 'rgba(255,255,255,0.06)', borderRadius: 4, color: '#94a3b8',
                                wordBreak: 'break-all', overflowWrap: 'anywhere', whiteSpace: 'normal', maxWidth: '100%'
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

            {/* Key Evidence Grid */}
            {investigation.key_evidence.length > 0 && (
              <div style={{ marginBottom: '1.25rem', minWidth: 0 }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>KEY EVIDENCE CITATIONS</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.5rem', minWidth: 0 }}>
                  {investigation.key_evidence.map((ev, idx) => (
                    <div key={`${ev.event_id}-${ev.signal}-${idx}`} style={{ background: 'rgba(0,0,0,0.25)', padding: '0.6rem 0.8rem', borderRadius: 6, border: '1px solid var(--border-subtle)', fontSize: '0.75rem', minWidth: 0, overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem', flexWrap: 'wrap', gap: '0.2rem' }}>
                        <span style={{ fontWeight: 700, color: '#38bdf8', wordBreak: 'break-all' }}>{ev.event_id}</span>
                        <span className={badgeClass(ev.severity)}>{ev.severity}</span>
                      </div>
                      <div style={{ fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.2rem' }}>{ev.signal}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{ev.reason}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Legitimate Explanations Considered */}
            {investigation.legitimate_explanations_considered.length > 0 && (
              <div style={{ marginBottom: '1.25rem', minWidth: 0 }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>LEGITIMATE EXPLANATIONS CONSIDERED</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', minWidth: 0 }}>
                  {investigation.legitimate_explanations_considered.map((leg, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.2)', padding: '0.6rem 0.8rem', borderRadius: 6, fontSize: '0.75rem', minWidth: 0, overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
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

            {/* Defensive Next Steps */}
            {investigation.recommended_defensive_actions.length > 0 && (
              <div style={{ marginBottom: '1.25rem', minWidth: 0 }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>RECOMMENDED DEFENSIVE ACTIONS</div>
                <div style={{ background: 'rgba(16,185,129,0.05)', padding: '0.75rem', borderRadius: 6, border: '1px solid rgba(16,185,129,0.2)', minWidth: 0 }}>
                  <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.75rem', color: 'var(--text-primary)' }}>
                    {investigation.recommended_defensive_actions.map((rec, i) => (
                      <li key={i} style={{ marginBottom: '0.3rem' }}>{rec}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* Audit Trail Drawer */}
            {audit && (
              <div style={{ paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.08)', fontSize: '0.65rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', minWidth: 0 }}>
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
          {risk.top_signals.map(sig => (
            <div key={sig.signal_id} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.5rem 0', borderBottom: '1px solid var(--border-subtle)' }}>
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

      {/* Scenario Injection */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>Scenario Injection (Demo & Validation)</h3>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn btn-danger" onClick={() => onInject('ato_credential_theft')} disabled={injecting}>
            {injecting ? '⏳ Injecting…' : '⚡ Inject ATO Attack Scenario'}
          </button>
          <button className="btn btn-ghost" onClick={() => onInject('legitimate_spike')} disabled={injecting}>
            📈 Inject Legitimate Campaign Spike
          </button>
        </div>
        {scenarioResult && (
          <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'var(--bg-primary)', borderRadius: 8, fontSize: '0.75rem' }}>
            <div style={{ fontWeight: 600, marginBottom: '0.5rem', color: scenarioResult.incident_created ? 'var(--risk-high)' : 'var(--risk-low)' }}>
              {scenarioResult.incident_created ? '🚨 INCIDENT CREATED & SENT TO AI INVESTIGATOR' : '✓ Legitimate spike scenario injected (No ATO incident created)'}
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
        <h3 style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>Recent Events</h3>
        <div style={{ maxHeight: 300, overflowY: 'auto' }}>
          {events.map(ev => (
            <div key={ev.event_id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.4rem 0', borderBottom: '1px solid var(--border-subtle)', fontSize: '0.75rem' }}>
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

// ── Small Components ──
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
