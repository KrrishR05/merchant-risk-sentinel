'use client';

import React from 'react';
import { AttackStage } from '@/lib/api';

interface AttackChainFlowProps {
  progression: AttackStage[];
}

export const AttackChainFlow: React.FC<AttackChainFlowProps> = ({ progression }) => {
  if (!progression || progression.length === 0) {
    return (
      <div style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.8rem', fontStyle: 'italic' }}>
        No temporal attack progression stages reconstructed.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h4 style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)' }}>
          Temporal Attack Chain Reconstruction
        </h4>
        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
          Chronologically ordered event sequence
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', position: 'relative' }}>
        {progression.map((stage, idx) => (
          <div
            key={idx}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '1rem',
              background: 'var(--bg-subtle)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '8px',
              padding: '0.75rem 1rem',
              position: 'relative',
            }}
          >
            <div
              style={{
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                background: 'var(--accent-tint)',
                border: '1px solid var(--border-accent)',
                color: 'var(--accent-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.72rem',
                fontWeight: 800,
                flexShrink: 0,
                marginTop: '0.1rem',
              }}
            >
              {idx + 1}
            </div>

            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {stage.stage}
                </span>
                {stage.event_ids && stage.event_ids.length > 0 && (
                  <span style={{ fontSize: '0.7rem', fontFamily: 'monospace', color: 'var(--accent-primary)' }}>
                    {stage.event_ids.join(', ')}
                  </span>
                )}
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                {stage.explanation}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
