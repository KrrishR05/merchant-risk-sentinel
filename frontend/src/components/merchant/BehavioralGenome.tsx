'use client';

import React from 'react';
import { MerchantProfile } from '@/lib/api';

interface BehavioralGenomeProps {
  profile: MerchantProfile;
}

export const BehavioralGenome: React.FC<BehavioralGenomeProps> = ({ profile }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Behavioral Genome Baseline
          </h3>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
            Learned normal operational envelope from {profile.total_events} pre-cutoff historical events.
          </p>
        </div>
        <span
          style={{
            padding: '0.2rem 0.6rem',
            background: 'var(--accent-tint)',
            border: '1px solid var(--border-accent)',
            borderRadius: '9999px',
            fontSize: '0.7rem',
            fontWeight: 700,
            color: 'var(--accent-primary)',
          }}
        >
          Zero Data Leakage Audited
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
        {/* Known Devices */}
        <div className="panel-subtle" style={{ padding: '1rem' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Authorized Devices
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '0.35rem', fontVariantNumeric: 'tabular-nums' }}>
            {profile.known_devices.length} Known
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.35rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {profile.known_devices.slice(0, 2).join(', ')}
            {profile.known_devices.length > 2 ? '...' : ''}
          </div>
        </div>

        {/* Known Countries */}
        <div className="panel-subtle" style={{ padding: '1rem' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Normal Geographies
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '0.35rem' }}>
            {profile.known_countries.join(', ') || 'IN'}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
            Geo-fenced operational radius
          </div>
        </div>

        {/* API Rate Baseline */}
        <div className="panel-subtle" style={{ padding: '1rem' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            API Request Baseline
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '0.35rem', fontVariantNumeric: 'tabular-nums' }}>
            {profile.api_rate_baseline?.mean?.toFixed(1) || '0.0'}
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500 }}> /hr</span>
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
            Std Dev: ±{profile.api_rate_baseline?.std?.toFixed(1) || '0.0'}
          </div>
        </div>

        {/* Transaction Velocity */}
        <div className="panel-subtle" style={{ padding: '1rem' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Transaction Rate Baseline
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '0.35rem', fontVariantNumeric: 'tabular-nums' }}>
            {profile.transaction_rate_baseline?.mean?.toFixed(1) || '0.0'}
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500 }}> /hr</span>
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
            Std Dev: ±{profile.transaction_rate_baseline?.std?.toFixed(1) || '0.0'}
          </div>
        </div>
      </div>
    </div>
  );
};
