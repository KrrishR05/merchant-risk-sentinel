'use client';

import { useState, useEffect, useCallback } from 'react';
import { api, Overview, MerchantProfile, RiskAssessment, MerchantEvent, Incident, ScenarioResult } from '@/lib/api';
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
      const [r, p, ev] = await Promise.all([
        api.getMerchantRisk(id), api.getMerchantProfile(id), api.getMerchantEvents(id, 30),
      ]);
      setRisk(r); setProfile(p); setEvents(ev.events); setSelectedMerchant(id);
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
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Injection failed'); }
    finally { setInjecting(false); }
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
            <span>⊞</span> Incidents
          </a>
          <a className="sidebar-link" style={{ cursor: 'pointer', opacity: 0.5 }}>
            <span>◈</span> Analytics
          </a>
        </nav>
        <div style={{ padding: '0.75rem 1.25rem', borderTop: '1px solid var(--border-subtle)' }}>
          <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>v0.1.0 · Day 1 Build</div>
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, padding: '1.5rem 2rem', overflowY: 'auto' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <RiskSutraLogo variant="compact" size="sm" onClick={goHome} />
            <div style={{ borderLeft: '1px solid var(--border-subtle)', paddingLeft: '1rem' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Security Command Center
              </div>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Razorpay Buildathon 2026 · Account Takeover Sentinel</div>
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
            loading={loading} onInject={injectScenario} injecting={injecting}
            scenarioResult={scenarioResult} onBack={goHome}
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

// ── Merchant Detail ──
function MerchantView({ merchantId, risk, profile, events, loading, onInject, injecting, scenarioResult, onBack }: {
  merchantId: string; risk: RiskAssessment | null; profile: MerchantProfile | null;
  events: MerchantEvent[]; loading: boolean;
  onInject: (type: string) => void; injecting: boolean; scenarioResult: ScenarioResult | null; onBack: () => void;
}) {
  if (loading || !risk || !profile) return <LoadingGrid />;
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
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.5rem' }}>ATO Risk Score</div>
          <div className="risk-score-display" style={{ color: riskColor(risk.risk_band) }}>{risk.risk_score.toFixed(1)}</div>
          <div style={{ marginTop: '0.5rem' }}><span className={badgeClass(risk.risk_band)}>{risk.risk_band}</span></div>
          <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginTop: '0.75rem' }}>{risk.model_version}</div>
        </div>
        {/* Behavioral Genome */}
        <div className="card">
          <h3 style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>Behavioral Genome</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', fontSize: '0.75rem' }}>
            <ProfileStat label="Known Devices" value={profile.known_devices.length} />
            <ProfileStat label="Known Countries" value={profile.known_countries.join(', ')} />
            <ProfileStat label="Known ASNs" value={profile.known_asns.length} />
            <ProfileStat label="Total Events" value={profile.total_events.toLocaleString()} />
            <ProfileStat label="Sensitive Actions" value={profile.sensitive_action_count} />
            <ProfileStat label="API Rate (avg/hr)" value={profile.api_rate_baseline.mean?.toFixed(1) || '0'} />
          </div>
        </div>
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
        <h3 style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>Scenario Injection (Demo)</h3>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn btn-danger" onClick={() => onInject('ato_credential_theft')} disabled={injecting}>
            {injecting ? '⏳ Injecting…' : '⚡ Inject ATO Attack'}
          </button>
          <button className="btn btn-ghost" onClick={() => onInject('legitimate_spike')} disabled={injecting}>
            📈 Inject Legitimate Spike
          </button>
        </div>
        {scenarioResult && (
          <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'var(--bg-primary)', borderRadius: 8, fontSize: '0.75rem' }}>
            <div style={{ fontWeight: 600, marginBottom: '0.5rem', color: scenarioResult.incident_created ? 'var(--risk-high)' : 'var(--risk-low)' }}>
              {scenarioResult.incident_created ? '🚨 INCIDENT CREATED' : '✓ Scenario injected (no incident)'}
            </div>
            <div style={{ color: 'var(--text-secondary)' }}>
              Events: {scenarioResult.events_injected} · Type: {scenarioResult.scenario.scenario_type}
              {scenarioResult.risk_assessment && <> · Score: <span style={{ color: riskColor(scenarioResult.risk_assessment.risk_band), fontWeight: 700 }}>{scenarioResult.risk_assessment.risk_score.toFixed(1)}</span></>}
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
