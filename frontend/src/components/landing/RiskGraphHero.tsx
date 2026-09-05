'use client';

import React, { useState, useEffect } from 'react';

export const RiskGraphHero: React.FC = () => {
  const [activeStep, setActiveStep] = useState(0);

  // Cycle through intelligence workflow stages
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % 5);
    }, 2400);
    return () => clearInterval(timer);
  }, []);

  const stages = [
    { label: 'Merchant Telemetry', desc: 'New Device + New ASN observed', status: 'INCOMING' },
    { label: 'Behavioral Genome', desc: 'Comparing against 14-day learned baseline', status: 'EVALUATING' },
    { label: 'Temporal Attack Chain', desc: 'Credential theft → Session burst detected', status: 'RISK_DETECTED' },
    { label: 'RiskSūtra AI Agent', desc: 'Forensic evidence-grounded synthesis (94% confidence)', status: 'INVESTIGATING' },
    { label: 'Bounded Defense', desc: 'Policy Gate containment action triggered', status: 'CONTAINED' },
  ];

  return (
    <div
      style={{
        width: '100%',
        maxWidth: '860px',
        margin: '0 auto',
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        borderRadius: '16px',
        padding: '1.75rem',
        boxShadow: 'var(--shadow-lg)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Subtle top indicator bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--border-subtle)',
          paddingBottom: '1rem',
          marginBottom: '1.5rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <span className="pulse-indicator" />
          <span style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
            Living Intelligence Flow · Merchant ATO Defense
          </span>
        </div>
        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 500 }}>
          Phase {activeStep + 1} of 5: <span style={{ color: 'var(--accent-primary)', fontWeight: 700 }}>{stages[activeStep].status}</span>
        </div>
      </div>

      {/* Interactive Visual Graph Flow */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.75rem', position: 'relative' }}>
        {stages.map((stage, idx) => {
          const isActive = idx === activeStep;
          const isPast = idx < activeStep;

          let badgeBorder = 'var(--border-subtle)';
          let badgeBg = 'var(--bg-subtle)';
          let badgeColor = 'var(--text-secondary)';

          if (isActive) {
            badgeBorder = 'var(--accent-primary)';
            badgeBg = 'var(--accent-tint)';
            badgeColor = 'var(--accent-primary)';
          } else if (isPast) {
            badgeBorder = 'rgba(5, 150, 105, 0.3)';
            badgeBg = 'var(--risk-low-bg)';
            badgeColor = 'var(--risk-low)';
          }

          return (
            <div
              key={idx}
              style={{
                background: badgeBg,
                border: `1.5px solid ${badgeBorder}`,
                borderRadius: '10px',
                padding: '1rem 0.85rem',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                minHeight: '120px',
                transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                transform: isActive ? 'translateY(-3px)' : 'none',
                boxShadow: isActive ? 'var(--shadow-md)' : 'none',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.68rem', fontWeight: 700, color: badgeColor, fontVariantNumeric: 'tabular-nums' }}>
                    0{idx + 1}
                  </span>
                  {isActive && (
                    <span
                      style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        background: 'var(--accent-primary)',
                      }}
                    />
                  )}
                  {isPast && <span style={{ fontSize: '0.68rem', color: 'var(--risk-low)' }}>✓</span>}
                </div>
                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.35rem', lineHeight: 1.25 }}>
                  {stage.label}
                </div>
              </div>

              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', lineHeight: 1.35 }}>
                {stage.desc}
              </div>
            </div>
          );
        })}
      </div>

      {/* Flow Connection Lines Animation */}
      <div style={{ marginTop: '1.25rem', padding: '0.75rem 1rem', background: 'var(--bg-subtle)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
            Active Signal Stream:
          </span>
          <span style={{ fontSize: '0.72rem', color: 'var(--accent-primary)', fontWeight: 600, background: 'var(--accent-tint)', padding: '0.15rem 0.5rem', borderRadius: '4px' }}>
            EVT_49257 (AUTH_FAILURE → IP_BURST → CONFIG_CHANGE)
          </span>
        </div>
        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
          Strictly bounded, defense-only execution
        </div>
      </div>
    </div>
  );
};
