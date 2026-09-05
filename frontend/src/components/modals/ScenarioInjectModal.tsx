'use client';

import React, { useState } from 'react';
import { MerchantRisk } from '@/lib/api';

interface ScenarioInjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  merchants: MerchantRisk[];
  onInject: (merchantId: string, scenarioType: string) => Promise<void>;
  injecting: boolean;
}

export const ScenarioInjectModal: React.FC<ScenarioInjectModalProps> = ({
  isOpen,
  onClose,
  merchants,
  onInject,
  injecting,
}) => {
  const [selectedMerchant, setSelectedMerchant] = useState<string>(
    merchants[0]?.merchant_id || 'MER_restaurant_001'
  );
  const [scenarioCategory, setScenarioCategory] = useState<'ATO' | 'BENIGN'>('ATO');
  const [scenarioType, setScenarioType] = useState<string>('ato_credential_theft');

  if (!isOpen) return null;

  const handleRun = async () => {
    await onInject(selectedMerchant, scenarioType);
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        padding: '1.5rem',
      }}
      onClick={onClose}
    >
      <div
        className="panel"
        style={{
          width: '100%',
          maxWidth: '540px',
          padding: '2rem',
          boxShadow: 'var(--shadow-lg)',
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <span style={{ fontSize: '1.25rem' }}>⚡</span>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              Simulate Evaluation Scenario
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: '1.25rem',
              color: 'var(--text-muted)',
              cursor: 'pointer',
            }}
          >
            ✕
          </button>
        </div>

        {/* Form Body */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Target Merchant */}
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
              Select Target Merchant
            </label>
            <select
              value={selectedMerchant}
              onChange={(e) => setSelectedMerchant(e.target.value)}
              style={{
                width: '100%',
                padding: '0.6rem 0.85rem',
                borderRadius: '8px',
                border: '1px solid var(--border-muted)',
                background: 'var(--bg-surface)',
                color: 'var(--text-primary)',
                fontSize: '0.85rem',
              }}
            >
              {merchants.map((m) => (
                <option key={m.merchant_id} value={m.merchant_id}>
                  {m.merchant_name} ({m.merchant_type} · ID: {m.merchant_id})
                </option>
              ))}
            </select>
          </div>

          {/* Scenario Class Selector */}
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
              Scenario Classification
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <button
                type="button"
                className={`btn ${scenarioCategory === 'ATO' ? 'btn-danger' : 'btn-secondary'}`}
                onClick={() => {
                  setScenarioCategory('ATO');
                  setScenarioType('ato_credential_theft');
                }}
                style={{ fontSize: '0.8rem', padding: '0.5rem' }}
              >
                ⚠ Attack Scenario (ATO)
              </button>
              <button
                type="button"
                className={`btn ${scenarioCategory === 'BENIGN' ? 'btn-success' : 'btn-secondary'}`}
                onClick={() => {
                  setScenarioCategory('BENIGN');
                  setScenarioType('legitimate_traffic_spike');
                }}
                style={{ fontSize: '0.8rem', padding: '0.5rem' }}
              >
                ✓ Benign Traffic Spike
              </button>
            </div>
          </div>

          {/* Specific Scenario Type */}
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
              Scenario Type
            </label>
            <select
              value={scenarioType}
              onChange={(e) => setScenarioType(e.target.value)}
              style={{
                width: '100%',
                padding: '0.6rem 0.85rem',
                borderRadius: '8px',
                border: '1px solid var(--border-muted)',
                background: 'var(--bg-surface)',
                color: 'var(--text-primary)',
                fontSize: '0.85rem',
              }}
            >
              {scenarioCategory === 'ATO' ? (
                <>
                  <option value="ato_credential_theft">ATO: Credential Theft &amp; Payout Drain</option>
                  <option value="ato_case_b_network_pivot">ATO: Foreign Hosting ASN Network Pivot</option>
                  <option value="ato_case_c_geo_spike">ATO: Unnatural Geographic Jump</option>
                  <option value="ato_case_d_payout_drain">ATO: High-Velocity Rapid Settlement Drain</option>
                </>
              ) : (
                <>
                  <option value="legitimate_traffic_spike">Benign: Weekend Sales Surge</option>
                  <option value="benign_festive_spike">Benign: Diwali Festive Campaign</option>
                  <option value="benign_api_integration">Benign: Batch Inventory Integration Sync</option>
                </>
              )}
            </select>
          </div>

          {/* Context Note */}
          <div
            style={{
              padding: '0.75rem 1rem',
              background: 'var(--bg-subtle)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '8px',
              fontSize: '0.75rem',
              color: 'var(--text-secondary)',
              lineHeight: 1.45,
            }}
          >
            <strong>Note: </strong>
            Simulating an evaluation scenario injects fresh telemetry, re-scores the merchant risk, creates an auditable incident, and automatically launches the RiskSūtra AI forensic agent to demonstrate end-to-end defense.
          </div>
        </div>

        {/* Modal Actions */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.75rem' }}>
          <button className="btn btn-secondary" onClick={onClose} disabled={injecting}>
            Cancel
          </button>
          <button
            className={`btn ${scenarioCategory === 'ATO' ? 'btn-danger' : 'btn-success'}`}
            onClick={handleRun}
            disabled={injecting}
          >
            {injecting ? 'Injecting Telemetry...' : 'Execute Scenario Simulation'}
          </button>
        </div>
      </div>
    </div>
  );
};
