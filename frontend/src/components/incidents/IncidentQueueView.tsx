'use client';

import React, { useState, useMemo } from 'react';
import { Incident } from '@/lib/api';

interface IncidentQueueViewProps {
  incidents: Incident[];
  totalIncidentsCount: number;
  onSelectIncident: (merchantId: string, incidentId: string) => void;
  onBackToOverview: () => void;
}

function formatTime(ts: string) {
  try {
    return new Date(ts).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  } catch {
    return ts;
  }
}

function getRiskBadge(band: string) {
  switch (band) {
    case 'CRITICAL': return 'badge badge-critical';
    case 'HIGH': return 'badge badge-high';
    case 'MEDIUM': return 'badge badge-medium';
    default: return 'badge badge-low';
  }
}

function getRiskScoreColor(band: string) {
  switch (band) {
    case 'CRITICAL': return 'var(--risk-critical)';
    case 'HIGH': return 'var(--risk-high)';
    case 'MEDIUM': return 'var(--risk-medium)';
    default: return 'var(--risk-low)';
  }
}

export const IncidentQueueView: React.FC<IncidentQueueViewProps> = ({
  incidents,
  totalIncidentsCount,
  onSelectIncident,
  onBackToOverview,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const filteredIncidents = useMemo(() => {
    return incidents.filter((inc) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        inc.incident_id.toLowerCase().includes(q) ||
        inc.merchant_id.toLowerCase().includes(q) ||
        inc.incident_type.toLowerCase().includes(q);

      const matchesSeverity = severityFilter === 'ALL' || inc.risk_band === severityFilter;
      const matchesStatus = statusFilter === 'ALL' || inc.status === statusFilter;

      return matchesSearch && matchesSeverity && matchesStatus;
    });
  }, [incidents, searchQuery, severityFilter, statusFilter]);

  const criticalCount = incidents.filter(i => i.risk_band === 'CRITICAL').length;
  const highCount = incidents.filter(i => i.risk_band === 'HIGH').length;
  const resolvedCount = incidents.filter(i => i.status === 'RESOLVED' || i.status === 'CONTAINED').length;

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      {/* Header & Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <button
            className="btn btn-secondary"
            onClick={onBackToOverview}
            style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem', marginBottom: '0.5rem' }}
          >
            ← Back to Overview
          </button>
          <h1 style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.025em' }}>
            Global Incident Queue ({totalIncidentsCount})
          </h1>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
            Auditable incident registry of detected merchant threat events. Select any incident to launch the RiskSūtra AI forensic investigator.
          </p>
        </div>
      </div>

      {/* KPI Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
        <div className="panel" style={{ padding: '1rem 1.25rem' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Total Incidents
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '0.25rem', fontVariantNumeric: 'tabular-nums' }}>
            {totalIncidentsCount}
          </div>
        </div>

        <div className="panel" style={{ padding: '1rem 1.25rem' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Critical Risk
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--risk-critical)', marginTop: '0.25rem', fontVariantNumeric: 'tabular-nums' }}>
            {criticalCount}
          </div>
        </div>

        <div className="panel" style={{ padding: '1rem 1.25rem' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            High Risk
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--risk-high)', marginTop: '0.25rem', fontVariantNumeric: 'tabular-nums' }}>
            {highCount}
          </div>
        </div>

        <div className="panel" style={{ padding: '1rem 1.25rem' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Contained / Resolved
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--risk-low)', marginTop: '0.25rem', fontVariantNumeric: 'tabular-nums' }}>
            {resolvedCount}
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="panel" style={{ padding: '1rem 1.25rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Search Box */}
          <div style={{ flex: '1 1 260px', maxWidth: '380px' }}>
            <input
              type="text"
              placeholder="Search by incident ID, merchant, attack type..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '0.55rem 0.85rem',
                borderRadius: '8px',
                border: '1px solid var(--border-muted)',
                background: 'var(--bg-surface)',
                color: 'var(--text-primary)',
                fontSize: '0.82rem',
                outline: 'none',
              }}
            />
          </div>

          {/* Severity & Status Dropdowns */}
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              style={{
                padding: '0.5rem 0.75rem',
                borderRadius: '8px',
                border: '1px solid var(--border-muted)',
                background: 'var(--bg-surface)',
                color: 'var(--text-primary)',
                fontSize: '0.8rem',
              }}
            >
              <option value="ALL">All Risk Bands</option>
              <option value="CRITICAL">Critical Only</option>
              <option value="HIGH">High Only</option>
              <option value="MEDIUM">Medium Only</option>
              <option value="LOW">Low Only</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{
                padding: '0.5rem 0.75rem',
                borderRadius: '8px',
                border: '1px solid var(--border-muted)',
                background: 'var(--bg-surface)',
                color: 'var(--text-primary)',
                fontSize: '0.8rem',
              }}
            >
              <option value="ALL">All Statuses</option>
              <option value="OPEN">Open</option>
              <option value="CONTAINED">Contained</option>
              <option value="RECOVERING">Recovering</option>
              <option value="RESOLVED">Resolved</option>
            </select>
          </div>
        </div>
      </div>

      {/* Incidents Table */}
      <div className="panel" style={{ overflow: 'hidden', padding: 0 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border-subtle)' }}>
              <th style={{ padding: '0.75rem 1rem', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Incident ID</th>
              <th style={{ padding: '0.75rem 1rem', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Merchant</th>
              <th style={{ padding: '0.75rem 1rem', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Incident Type</th>
              <th style={{ padding: '0.75rem 1rem', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Score</th>
              <th style={{ padding: '0.75rem 1rem', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Band</th>
              <th style={{ padding: '0.75rem 1rem', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Status</th>
              <th style={{ padding: '0.75rem 1rem', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Detected At</th>
              <th style={{ padding: '0.75rem 1rem', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'right' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredIncidents.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  No incidents match the selected search or filter criteria.
                </td>
              </tr>
            ) : (
              filteredIncidents.map((inc, idx) => (
                <tr
                  key={`${inc.incident_id}-${idx}`}
                  style={{
                    borderBottom: '1px solid var(--border-subtle)',
                    cursor: 'pointer',
                    transition: 'background 0.12s ease',
                  }}
                  onClick={() => onSelectIncident(inc.merchant_id, inc.incident_id)}
                >
                  <td style={{ padding: '0.75rem 1rem', fontFamily: 'monospace', fontWeight: 700, fontSize: '0.8rem', color: 'var(--accent-primary)' }}>
                    {inc.incident_id}
                  </td>
                  <td style={{ padding: '0.75rem 1rem', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {inc.merchant_id}
                  </td>
                  <td style={{ padding: '0.75rem 1rem', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    {inc.incident_type}
                  </td>
                  <td style={{ padding: '0.75rem 1rem', fontSize: '0.82rem', fontWeight: 800, color: getRiskScoreColor(inc.risk_band), fontVariantNumeric: 'tabular-nums' }}>
                    {inc.risk_score.toFixed(1)}
                  </td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <span className={getRiskBadge(inc.risk_band)}>{inc.risk_band}</span>
                  </td>
                  <td style={{ padding: '0.75rem 1rem', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {inc.status}
                  </td>
                  <td style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {formatTime(inc.created_at)}
                  </td>
                  <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--accent-primary)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                      <span>RiskSūtra AI</span> →
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
