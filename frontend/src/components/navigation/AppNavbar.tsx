'use client';

import React from 'react';
import { RiskSutraLogo } from '../branding/RiskSutraLogo';

interface AppNavbarProps {
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  activeView: string;
  onNavigate: (view: any) => void;
  onOpenInjectModal: () => void;
  dbStatus?: string;
}

export const AppNavbar: React.FC<AppNavbarProps> = ({
  theme,
  onToggleTheme,
  activeView,
  onNavigate,
  onOpenInjectModal,
  dbStatus = 'ok',
}) => {
  return (
    <header
      style={{
        height: '64px',
        background: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 1.75rem',
        position: 'sticky',
        top: 0,
        zIndex: 50,
        backdropFilter: 'blur(12px)',
        boxShadow: 'var(--shadow-xs)',
      }}
    >
      {/* Brand Identity */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
        <RiskSutraLogo
          variant="compact"
          size="sm"
          onClick={() => onNavigate('landing')}
        />
        <div style={{ width: '1px', height: '24px', background: 'var(--border-subtle)' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span
            style={{
              fontSize: '0.78rem',
              fontWeight: 600,
              color: 'var(--text-secondary)',
              letterSpacing: '-0.01em',
            }}
          >
            {activeView === 'landing' && 'Product Overview'}
            {activeView === 'overview' && 'Security Command Center'}
            {activeView === 'merchant' && 'Merchant Risk Workspace'}
            {activeView === 'incidents' && 'Global Incident Registry'}
            {activeView === 'evaluation' && 'Track 02 Model Evaluation'}
            {activeView === 'system' && 'Architecture & System Status'}
          </span>
        </div>
      </div>

      {/* Center / Navigation Links for quick access */}
      <nav style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
        <button
          className="btn btn-ghost"
          onClick={() => onNavigate('landing')}
          style={{
            fontSize: '0.8rem',
            padding: '0.4rem 0.75rem',
            color: activeView === 'landing' ? 'var(--accent-primary)' : 'var(--text-secondary)',
            fontWeight: activeView === 'landing' ? 700 : 500,
          }}
        >
          Product
        </button>
        <button
          className="btn btn-ghost"
          onClick={() => onNavigate('overview')}
          style={{
            fontSize: '0.8rem',
            padding: '0.4rem 0.75rem',
            color: activeView === 'overview' ? 'var(--accent-primary)' : 'var(--text-secondary)',
            fontWeight: activeView === 'overview' ? 700 : 500,
          }}
        >
          Command Center
        </button>
        <button
          className="btn btn-ghost"
          onClick={() => onNavigate('incidents')}
          style={{
            fontSize: '0.8rem',
            padding: '0.4rem 0.75rem',
            color: activeView === 'incidents' ? 'var(--accent-primary)' : 'var(--text-secondary)',
            fontWeight: activeView === 'incidents' ? 700 : 500,
          }}
        >
          Incidents
        </button>
        <button
          className="btn btn-ghost"
          onClick={() => onNavigate('evaluation')}
          style={{
            fontSize: '0.8rem',
            padding: '0.4rem 0.75rem',
            color: activeView === 'evaluation' ? 'var(--accent-primary)' : 'var(--text-secondary)',
            fontWeight: activeView === 'evaluation' ? 700 : 500,
          }}
        >
          Evaluation
        </button>
        <button
          className="btn btn-ghost"
          onClick={() => onNavigate('system')}
          style={{
            fontSize: '0.8rem',
            padding: '0.4rem 0.75rem',
            color: activeView === 'system' ? 'var(--accent-primary)' : 'var(--text-secondary)',
            fontWeight: activeView === 'system' ? 700 : 500,
          }}
        >
          System
        </button>
      </nav>

      {/* Right Controls: Live Status, Inject Action, Theme Toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        {/* Live Defense Engine Status */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.3rem 0.65rem',
            background: 'var(--risk-low-bg)',
            border: '1px solid rgba(5, 150, 105, 0.2)',
            borderRadius: '9999px',
            fontSize: '0.72rem',
            fontWeight: 600,
            color: 'var(--risk-low)',
          }}
        >
          <span className="pulse-indicator" />
          <span>Live Defense Active</span>
        </div>

        {/* PostgreSQL Database Indicator */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            fontSize: '0.72rem',
            color: 'var(--text-muted)',
            fontWeight: 500,
          }}
          title="PostgreSQL Production Database Connected"
        >
          <span
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: dbStatus === 'ok' ? 'var(--risk-low)' : 'var(--risk-critical)',
            }}
          />
          <span>PostgreSQL</span>
        </div>

        {/* Inject Scenario CTA */}
        <button
          className="btn btn-secondary"
          onClick={onOpenInjectModal}
          style={{
            fontSize: '0.76rem',
            padding: '0.35rem 0.75rem',
            gap: '0.35rem',
            borderColor: 'var(--border-muted)',
          }}
        >
          <span>⚡</span> Inject Scenario
        </button>

        {/* Theme Toggle (Sun/Moon) */}
        <button
          className="btn btn-secondary"
          onClick={onToggleTheme}
          aria-label={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} mode`}
          title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} mode`}
          style={{
            width: '36px',
            height: '36px',
            padding: 0,
            borderRadius: '8px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1rem',
          }}
        >
          {theme === 'light' ? '🌙' : '☀️'}
        </button>
      </div>
    </header>
  );
};
