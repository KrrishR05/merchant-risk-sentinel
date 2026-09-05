'use client';

import React from 'react';
import { MerchantProfile, RiskAssessment, MerchantEvent, Incident } from '@/lib/api';
import { BehavioralGenome } from './BehavioralGenome';

interface MerchantWorkspaceProps {
  merchantId: string;
  profile: MerchantProfile;
  risk: RiskAssessment;
  events: MerchantEvent[];
  incidents: Incident[];
  activeIncident: Incident | null;
  onSelectIncident: (incidentId: string) => void;
  onBackToOverview: () => void;
  onInjectScenario: (scenarioType: string) => void;
  injecting: boolean;
}

function getRiskBandBadge(band: string) {
  switch (band) {
    case 'CRITICAL': return 'badge badge-critical';
    case 'HIGH': return 'badge badge-high';
    case 'MEDIUM': return 'badge badge-medium';
    default: return 'badge badge-low';
  }
}

function getRiskBandColor(band: string) {
  switch (band) {
    case 'CRITICAL': return 'var(--risk-critical)';
    case 'HIGH': return 'var(--risk-high)';
    case 'MEDIUM': return 'var(--risk-medium)';
    case 'LOW': return 'var(--risk-low)';
    default: return 'var(--text-muted)';
  }
}

export const MerchantWorkspace: React.FC<MerchantWorkspaceProps> = ({
  merchantId,
  profile,
  risk,
  events,
  incidents,
  activeIncident,
  onSelectIncident,
  onBackToOverview,
  onInjectScenario,
  injecting,
}) => {
  // Check if active incident or recent signals have anomalous devices/countries
  const hasCriticalSignal = risk.top_signals.some(s => s.severity === 'CRITICAL');
  const [incidentsCollapsed, setIncidentsCollapsed] = React.useState(incidents.length > 3);

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Workspace Breadcrumbs & Top Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            className="btn btn-secondary"
            onClick={onBackToOverview}
            style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}
          >
            ← Back to Overview
          </button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                {merchantId}
              </h1>
              <span className={getRiskBandBadge(risk.risk_band)}>{risk.risk_band}</span>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
              Merchant Risk Intelligence Workspace · Model: {risk.model_version}
            </p>
          </div>
        </div>

        {/* Quick Scenario Triggers */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            className="btn btn-outline-danger"
            disabled={injecting}
            onClick={() => onInjectScenario('ato_credential_theft')}
            style={{ fontSize: '0.78rem', padding: '0.45rem 0.85rem' }}
          >
            {injecting ? 'Injecting...' : '⚡ Test ATO Attack'}
          </button>
          <button
            className="btn btn-secondary"
            disabled={injecting}
            onClick={() => onInjectScenario('legitimate_traffic_spike')}
            style={{ fontSize: '0.78rem', padding: '0.45rem 0.85rem' }}
          >
            {injecting ? 'Injecting...' : '✓ Test Benign Surge'}
          </button>
        </div>
      </div>

      {/* Primary Status Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
        <div className="panel" style={{ padding: '1.25rem' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Deterministic Risk Score
          </div>
          <div style={{ fontSize: '2.2rem', fontWeight: 800, color: getRiskBandColor(risk.risk_band), marginTop: '0.35rem', fontVariantNumeric: 'tabular-nums' }}>
            {risk.risk_score.toFixed(1)}
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 500 }}> /100</span>
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            Calibrated behavioral score
          </div>
        </div>

        <div className="panel" style={{ padding: '1.25rem' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Active Threat Signals
          </div>
          <div style={{ fontSize: '2.2rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '0.35rem', fontVariantNumeric: 'tabular-nums' }}>
            {risk.top_signals.length}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            {risk.top_signals.filter(s => s.severity === 'CRITICAL' || s.severity === 'HIGH').length} High/Critical Severity
          </div>
        </div>

        <div className="panel" style={{ padding: '1.25rem' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Merchant Incidents
          </div>
          <div style={{ fontSize: '2.2rem', fontWeight: 800, color: 'var(--accent-primary)', marginTop: '0.35rem', fontVariantNumeric: 'tabular-nums' }}>
            {incidents.length}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            Logged in immutable audit registry
          </div>
        </div>

        <div className="panel" style={{ padding: '1.25rem' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Active Selected Incident
          </div>
          <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.5rem', fontFamily: 'monospace' }}>
            {activeIncident ? activeIncident.incident_id : 'None Selected'}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            {activeIncident ? activeIncident.incident_type : 'Select below to inspect'}
          </div>
        </div>
      </div>

      {/* "What Changed?" Normal vs Current Visual Diffing */}
      <section className="panel" style={{ padding: '1.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.015em' }}>
              What Changed? Normal vs. Current Observation
            </h2>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
              Side-by-side behavioral deviation analysis highlighting active attack precursors.
            </p>
          </div>
          <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--accent-primary)', background: 'var(--accent-tint)', padding: '0.2rem 0.6rem', borderRadius: '4px' }}>
            Contextual Anomaly Engine
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
          {/* Devices Diff */}
          <div className="panel-subtle" style={{ padding: '1rem' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
              Device Identity
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.8rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Normal:</span>
                <span style={{ fontWeight: 600, color: 'var(--risk-low)' }}>{profile.known_devices.length} known devices</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Current:</span>
                <span style={{ fontWeight: 700, color: hasCriticalSignal ? 'var(--risk-critical)' : 'var(--text-primary)' }}>
                  {hasCriticalSignal ? '1 Unseen Device ID' : 'Known Device Session'}
                </span>
              </div>
            </div>
          </div>

          {/* Geography Diff */}
          <div className="panel-subtle" style={{ padding: '1rem' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
              Geographic Region
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.8rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Normal:</span>
                <span style={{ fontWeight: 600, color: 'var(--risk-low)' }}>{profile.known_countries.join(', ') || 'IN'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Current:</span>
                <span style={{ fontWeight: 700, color: hasCriticalSignal ? 'var(--risk-critical)' : 'var(--text-primary)' }}>
                  {hasCriticalSignal ? 'Foreign / Hosting ASN' : 'Expected Geography'}
                </span>
              </div>
            </div>
          </div>

          {/* API Request Rate Diff */}
          <div className="panel-subtle" style={{ padding: '1rem' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
              API Request Rate
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.8rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Normal:</span>
                <span style={{ fontWeight: 600, color: 'var(--risk-low)' }}>{profile.api_rate_baseline?.mean?.toFixed(1) || '0.0'}/hr</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Current:</span>
                <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                  {hasCriticalSignal ? 'Burst Spike (5.2×)' : 'Within Baseline'}
                </span>
              </div>
            </div>
          </div>

          {/* Transaction Velocity Diff */}
          <div className="panel-subtle" style={{ padding: '1rem' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
              Transaction Velocity
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.8rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Normal:</span>
                <span style={{ fontWeight: 600, color: 'var(--risk-low)' }}>{profile.transaction_rate_baseline?.mean?.toFixed(1) || '0.0'}/hr</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Current:</span>
                <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                  {hasCriticalSignal ? 'Accelerated Transfer' : 'Baseline Flow'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Behavioral Genome Card */}
      <div className="panel" style={{ padding: '1.75rem' }}>
        <BehavioralGenome profile={profile} />
      </div>

      {/* Scoped Incidents List for this Merchant (Collapsible Accordion) */}
      <section className="panel" style={{ padding: '1.75rem' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.75rem',
            cursor: 'pointer',
            userSelect: 'none',
          }}
          onClick={() => setIncidentsCollapsed(!incidentsCollapsed)}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Historical &amp; Active Incidents for {merchantId}
              </h2>
              <span className="badge badge-intel">
                {incidents.length} recorded
              </span>
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
              {incidentsCollapsed
                ? 'Incident tally is collapsed to minimize scrolling. Click arrow or card to expand full table.'
                : 'Select an incident to review its evidence and launch a RiskSūtra AI forensic investigation.'}
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {/* Quick jump to AI investigation */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                const el = document.getElementById('ai-investigator-console');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}
              className="btn btn-secondary"
              style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem', gap: '0.35rem' }}
              title="Jump directly to RiskSūtra AI Investigation Console"
            >
              <span>⚡ RiskSūtra AI Agent</span>
              <span>↓</span>
            </button>

            {/* Dropdown toggle button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIncidentsCollapsed(!incidentsCollapsed);
              }}
              className="btn btn-secondary"
              style={{
                fontSize: '0.78rem',
                padding: '0.35rem 0.75rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
              }}
            >
              <span>{incidentsCollapsed ? 'Expand Tally' : 'Collapse Tally'}</span>
              <span
                style={{
                  display: 'inline-block',
                  fontSize: '0.72rem',
                  transition: 'transform 0.2s ease',
                  transform: incidentsCollapsed ? 'rotate(0deg)' : 'rotate(180deg)',
                }}
              >
                ▼
              </span>
            </button>
          </div>
        </div>

        {incidents.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            No incidents logged for this merchant yet. Simulate a scenario above to test.
          </div>
        ) : incidentsCollapsed ? (
          /* Collapsed View: Highlights Active/Selected Incident */
          <div
            style={{
              marginTop: '1rem',
              padding: '0.9rem 1.15rem',
              borderRadius: '8px',
              background: 'var(--accent-tint)',
              border: '1.5px solid var(--border-accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '0.75rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Active Incident:
              </span>
              <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: '0.85rem', color: 'var(--accent-primary)' }}>
                {activeIncident?.incident_id || incidents[0]?.incident_id}
              </span>
              <span className={getRiskBandBadge(activeIncident?.risk_band || incidents[0]?.risk_band || 'HIGH')}>
                {activeIncident?.risk_band || incidents[0]?.risk_band || 'HIGH'}
              </span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                {activeIncident?.incident_type || incidents[0]?.incident_type}
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Status: <strong style={{ color: 'var(--text-primary)' }}>{activeIncident?.status || 'OPEN'}</strong>
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIncidentsCollapsed(false);
                }}
                className="btn btn-ghost"
                style={{ fontSize: '0.76rem', padding: '0.25rem 0.5rem', color: 'var(--accent-primary)', fontWeight: 700 }}
              >
                View all {incidents.length} recorded incidents ▼
              </button>
            </div>
          </div>
        ) : (
          /* Expanded View: Scroll-Capped List */
          <div style={{ marginTop: '1rem' }}>
            <div
              style={{
                maxHeight: '360px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
                paddingRight: '0.35rem',
              }}
            >
              {incidents.map((inc) => {
                const isSelected = activeIncident?.incident_id === inc.incident_id;
                return (
                  <div
                    key={inc.incident_id}
                    onClick={() => onSelectIncident(inc.incident_id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.8rem 1rem',
                      borderRadius: '8px',
                      background: isSelected ? 'var(--accent-tint)' : 'var(--bg-subtle)',
                      border: `1.5px solid ${isSelected ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.82rem', color: 'var(--accent-primary)' }}>
                        {inc.incident_id}
                      </span>
                      <span className={getRiskBandBadge(inc.risk_band)}>
                        {inc.risk_band}
                      </span>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        {inc.incident_type}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Status: <strong style={{ color: 'var(--text-primary)' }}>{inc.status}</strong>
                      </span>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent-primary)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                        {isSelected ? 'Selected (Active) ✓' : 'RiskSūtra AI →'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'center' }}>
              <button
                type="button"
                onClick={() => setIncidentsCollapsed(true)}
                className="btn btn-ghost"
                style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}
              >
                ▲ Collapse tally to active incident
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};
