'use client';

import React from 'react';
import { MerchantRisk } from '@/lib/api';

interface AppSidebarProps {
  activeView: string;
  onNavigate: (view: any) => void;
  merchants: MerchantRisk[];
  selectedMerchantId: string | null;
  onSelectMerchant: (merchantId: string) => void;
  incidentCount: number;
}

function getRiskDotColor(band: string) {
  switch (band) {
    case 'CRITICAL': return 'var(--risk-critical)';
    case 'HIGH': return 'var(--risk-high)';
    case 'MEDIUM': return 'var(--risk-medium)';
    case 'LOW': return 'var(--risk-low)';
    default: return 'var(--text-muted)';
  }
}

export const AppSidebar: React.FC<AppSidebarProps> = ({
  activeView,
  onNavigate,
  merchants,
  selectedMerchantId,
  onSelectMerchant,
  incidentCount,
}) => {
  return (
    <aside
      style={{
        width: '240px',
        background: 'var(--bg-surface)',
        borderRight: '1px solid var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        flexShrink: 0,
        height: 'calc(100vh - 64px)',
        position: 'sticky',
        top: '64px',
        overflowY: 'auto',
      }}
    >
      <div style={{ padding: '1.25rem 0.75rem' }}>
        {/* Primary Views Section */}
        <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '0 0.75rem 0.5rem' }}>
          Platform Navigation
        </div>

        <button
          onClick={() => onNavigate('overview')}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: '0.65rem',
            padding: '0.55rem 0.75rem',
            borderRadius: '8px',
            border: 'none',
            background: activeView === 'overview' ? 'var(--accent-tint)' : 'transparent',
            color: activeView === 'overview' ? 'var(--accent-primary)' : 'var(--text-primary)',
            fontWeight: activeView === 'overview' ? 700 : 500,
            fontSize: '0.84rem',
            cursor: 'pointer',
            textAlign: 'left',
            transition: 'all 0.15s ease',
            marginBottom: '0.25rem',
          }}
        >
          <span>◈</span> Command Center
        </button>

        <button
          onClick={() => onNavigate('incidents')}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.55rem 0.75rem',
            borderRadius: '8px',
            border: 'none',
            background: activeView === 'incidents' ? 'var(--accent-tint)' : 'transparent',
            color: activeView === 'incidents' ? 'var(--accent-primary)' : 'var(--text-primary)',
            fontWeight: activeView === 'incidents' ? 700 : 500,
            fontSize: '0.84rem',
            cursor: 'pointer',
            textAlign: 'left',
            transition: 'all 0.15s ease',
            marginBottom: '0.25rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <span>⊞</span> Incident Queue
          </div>
          <span
            style={{
              background: 'var(--bg-subtle)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '9999px',
              padding: '0.1rem 0.45rem',
              fontSize: '0.7rem',
              fontWeight: 600,
              color: 'var(--text-secondary)',
            }}
          >
            {incidentCount}
          </span>
        </button>

        <button
          onClick={() => onNavigate('evaluation')}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: '0.65rem',
            padding: '0.55rem 0.75rem',
            borderRadius: '8px',
            border: 'none',
            background: activeView === 'evaluation' ? 'var(--accent-tint)' : 'transparent',
            color: activeView === 'evaluation' ? 'var(--accent-primary)' : 'var(--text-primary)',
            fontWeight: activeView === 'evaluation' ? 700 : 500,
            fontSize: '0.84rem',
            cursor: 'pointer',
            textAlign: 'left',
            transition: 'all 0.15s ease',
            marginBottom: '0.25rem',
          }}
        >
          <span>🎯</span> Track 02 Evaluation
        </button>

        {/* Monitored Merchants Section */}
        <div style={{ borderTop: '1px solid var(--border-subtle)', margin: '1rem 0.5rem 0.75rem' }} />

        <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '0 0.75rem 0.5rem' }}>
          Monitored Merchants ({merchants.length})
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
          {merchants.map((m) => {
            const isSelected = activeView === 'merchant' && selectedMerchantId === m.merchant_id;
            return (
              <button
                key={m.merchant_id}
                onClick={() => onSelectMerchant(m.merchant_id)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.5rem 0.75rem',
                  borderRadius: '8px',
                  border: 'none',
                  background: isSelected ? 'var(--accent-tint)' : 'transparent',
                  color: isSelected ? 'var(--accent-primary)' : 'var(--text-secondary)',
                  fontWeight: isSelected ? 700 : 500,
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
                  <span
                    style={{
                      width: '7px',
                      height: '7px',
                      borderRadius: '50%',
                      background: getRiskDotColor(m.risk_band),
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {m.merchant_name}
                  </span>
                </div>
                <span
                  style={{
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    color: getRiskDotColor(m.risk_band),
                    fontVariantNumeric: 'tabular-nums',
                    marginLeft: '0.35rem',
                  }}
                >
                  {m.risk_score.toFixed(1)}
                </span>
              </button>
            );
          })}
        </div>

        {/* System Status Section */}
        <div style={{ borderTop: '1px solid var(--border-subtle)', margin: '1rem 0.5rem 0.75rem' }} />

        <button
          onClick={() => onNavigate('system')}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: '0.65rem',
            padding: '0.55rem 0.75rem',
            borderRadius: '8px',
            border: 'none',
            background: activeView === 'system' ? 'var(--accent-tint)' : 'transparent',
            color: activeView === 'system' ? 'var(--accent-primary)' : 'var(--text-primary)',
            fontWeight: activeView === 'system' ? 700 : 500,
            fontSize: '0.84rem',
            cursor: 'pointer',
            textAlign: 'left',
            transition: 'all 0.15s ease',
          }}
        >
          <span>⚙</span> System Architecture
        </button>
      </div>

      {/* Footer System Version */}
      <div
        style={{
          padding: '0.85rem 1.25rem',
          borderTop: '1px solid var(--border-subtle)',
          fontSize: '0.68rem',
          color: 'var(--text-muted)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.2rem',
        }}
      >
        <div style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>RiskSūtra v0.4.0</div>
        <div>Razorpay Track 02 AI Risk Manager</div>
      </div>
    </aside>
  );
};
