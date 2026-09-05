'use client';

import React from 'react';
import { MerchantRisk } from '@/lib/api';

interface MerchantRiskCardProps {
  merchant: MerchantRisk;
  onInspect: (merchantId: string) => void;
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

function getRiskBadgeClass(band: string) {
  switch (band) {
    case 'CRITICAL': return 'badge badge-critical';
    case 'HIGH': return 'badge badge-high';
    case 'MEDIUM': return 'badge badge-medium';
    default: return 'badge badge-low';
  }
}

function getArchetypeDetails(type: string) {
  switch (type.toUpperCase()) {
    case 'RESTAURANT':
      return { label: 'Restaurant & Dining', icon: '🍽️', baseline: 'Peak evening hours, local POS traffic, rare API changes' };
    case 'SAAS':
      return { label: 'B2B Cloud & SaaS', icon: '☁️', baseline: 'High weekday API throughput, multi-region auth, frequent token rot' };
    case 'FASHION':
      return { label: 'E-Commerce Fashion', icon: '🛍️', baseline: 'High card volume, weekend campaign surges, low config volatility' };
    case 'DIGITAL_SERVICES':
      return { label: 'Digital Services & Media', icon: '⚡', baseline: 'Micro-transactions, subscription renewals, automated billing' };
    default:
      return { label: type, icon: '🏢', baseline: 'Standard commercial transaction baseline' };
  }
}

export const MerchantRiskCard: React.FC<MerchantRiskCardProps> = ({ merchant, onInspect }) => {
  const archetype = getArchetypeDetails(merchant.merchant_type);
  const scoreColor = getRiskBandColor(merchant.risk_band);

  return (
    <div
      className="panel"
      style={{
        padding: '1.5rem',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        position: 'relative',
        cursor: 'pointer',
      }}
      onClick={() => onInspect(merchant.merchant_id)}
    >
      <div>
        {/* Header Row: Archetype & Risk Badge */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>
            <span>{archetype.icon}</span>
            <span>{archetype.label}</span>
          </div>
          <span className={getRiskBadgeClass(merchant.risk_band)}>
            {merchant.risk_band}
          </span>
        </div>

        {/* Merchant Name */}
        <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.35rem', letterSpacing: '-0.015em' }}>
          {merchant.merchant_name}
        </h3>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace', marginBottom: '1.25rem' }}>
          ID: {merchant.merchant_id}
        </div>

        {/* Score Display */}
        <div
          style={{
            background: 'var(--bg-subtle)',
            borderRadius: '10px',
            padding: '0.85rem 1rem',
            marginBottom: '1rem',
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
            Deterministic Risk Score
          </span>
          <span
            style={{
              fontSize: '1.65rem',
              fontWeight: 800,
              color: scoreColor,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {merchant.risk_score.toFixed(1)}
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500 }}>/100</span>
          </span>
        </div>

        {/* Behavioral Profile Context */}
        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.45, marginBottom: '1rem' }}>
          <span style={{ fontWeight: 600 }}>Normal Pattern: </span>
          {archetype.baseline}
        </div>
      </div>

      {/* Action Footer */}
      <div
        style={{
          borderTop: '1px solid var(--border-subtle)',
          paddingTop: '0.85rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          Behavioral Genome Active
        </span>
        <button
          className="btn btn-ghost"
          style={{
            padding: '0.25rem 0.65rem',
            fontSize: '0.78rem',
            color: 'var(--accent-primary)',
            fontWeight: 700,
          }}
          onClick={(e) => {
            e.stopPropagation();
            onInspect(merchant.merchant_id);
          }}
        >
          Inspect Workspace →
        </button>
      </div>
    </div>
  );
};
