'use client';

import React from 'react';
import { Overview, Incident } from '@/lib/api';
import { MerchantRiskCard } from './MerchantRiskCard';

interface OverviewViewProps {
  overview: Overview;
  incidents: Incident[];
  onSelectMerchant: (merchantId: string, targetIncidentId?: string) => void;
  onOpenIncidents: () => void;
  onOpenInjectModal: () => void;
}

function formatTime(ts: string) {
  try {
    return new Date(ts).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  } catch {
    return ts;
  }
}

const SENSITIVE_TYPES = new Set(['CONFIG_CHANGE', 'PAYOUT_EVENT', 'AUTH_FAILURE', 'ACCOUNT_ACTION']);

export const OverviewView: React.FC<OverviewViewProps> = ({
  overview,
  incidents,
  onSelectMerchant,
  onOpenIncidents,
  onOpenInjectModal,
}) => {
  const criticalHighCount =
    (overview.risk_distribution.HIGH || 0) + (overview.risk_distribution.CRITICAL || 0);

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Command Center Greeting & Actions */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
          borderBottom: '1px solid var(--border-subtle)',
          paddingBottom: '1.25rem',
        }}
      >
        <div>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.35rem' }}>
            Security Command Center
          </div>
          <h1 style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.025em' }}>
            Merchant Risk Landscape
          </h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            Continuous behavior-grounded ATO detection monitoring 5 distinct merchant archetypes.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            className="btn btn-secondary"
            onClick={onOpenIncidents}
            style={{ fontSize: '0.82rem' }}
          >
            <span>⊞</span> View Incident Queue ({overview.total_incidents})
          </button>
          <button
            className="btn btn-primary"
            onClick={onOpenInjectModal}
            style={{ fontSize: '0.82rem' }}
          >
            <span>⚡</span> Simulate Scenario
          </button>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
        <div className="panel" style={{ padding: '1.25rem' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Merchants Monitored
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '0.5rem', fontVariantNumeric: 'tabular-nums' }}>
            {overview.total_merchants}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
            5 Distinct business archetypes
          </div>
        </div>

        <div className="panel" style={{ padding: '1.25rem' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Active Threat Incidents
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--risk-high)', marginTop: '0.5rem', fontVariantNumeric: 'tabular-nums' }}>
            {overview.active_incidents}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
            Under active policy monitoring
          </div>
        </div>

        <div className="panel" style={{ padding: '1.25rem' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Total Audit Records
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--accent-primary)', marginTop: '0.5rem', fontVariantNumeric: 'tabular-nums' }}>
            {overview.total_incidents}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
            Immutable incident log entries
          </div>
        </div>

        <div className="panel" style={{ padding: '1.25rem' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Critical / High Risk Band
          </div>
          <div
            style={{
              fontSize: '2rem',
              fontWeight: 800,
              color: criticalHighCount > 0 ? 'var(--risk-critical)' : 'var(--risk-low)',
              marginTop: '0.5rem',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {criticalHighCount}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
            Merchants with elevated anomaly scores
          </div>
        </div>
      </div>

      {/* Independent Merchant Risk Landscape Cards */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Monitored Merchant Archetypes
            </h2>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              Independent behavioral baselines calibrated across 14-day chronological windows.
            </p>
          </div>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            Click any merchant to open forensic workspace
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
          {overview.merchant_risks.map((m) => (
            <MerchantRiskCard
              key={m.merchant_id}
              merchant={m}
              onInspect={(id: string) => onSelectMerchant(id)}
            />
          ))}
        </div>
      </section>

      {/* Live Security Activity Stream */}
      <section className="panel" style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span className="pulse-indicator" />
            <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Live Security Telemetry Stream
            </h2>
          </div>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            Real-time audit log from monitored endpoints
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {overview.recent_events.slice(0, 8).map((evt, idx) => {
            const isSensitive = SENSITIVE_TYPES.has(evt.event_type);
            return (
              <div
                key={`${evt.event_id}-${idx}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.65rem 0.85rem',
                  borderRadius: '8px',
                  background: isSensitive ? 'var(--risk-critical-bg)' : 'var(--bg-subtle)',
                  border: `1px solid ${isSensitive ? 'rgba(220, 38, 38, 0.2)' : 'var(--border-subtle)'}`,
                  fontSize: '0.8rem',
                  transition: 'background 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', minWidth: 0 }}>
                  <span style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: 'var(--text-muted)', width: '65px' }}>
                    {formatTime(evt.timestamp)}
                  </span>
                  <span
                    style={{
                      padding: '0.15rem 0.5rem',
                      borderRadius: '4px',
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      background: isSensitive ? 'var(--risk-critical)' : 'var(--accent-tint)',
                      color: isSensitive ? '#ffffff' : 'var(--accent-primary)',
                      textTransform: 'uppercase',
                    }}
                  >
                    {evt.event_type}
                  </span>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {evt.merchant_id}
                  </span>
                  {evt.endpoint && (
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                      {evt.endpoint}
                    </span>
                  )}
                </div>

                <button
                  className="btn btn-ghost"
                  onClick={() => onSelectMerchant(evt.merchant_id)}
                  style={{
                    padding: '0.2rem 0.5rem',
                    fontSize: '0.72rem',
                    color: 'var(--accent-primary)',
                    fontWeight: 600,
                  }}
                >
                  Inspect →
                </button>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};
