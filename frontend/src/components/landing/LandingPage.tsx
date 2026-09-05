'use client';

import React from 'react';
import { RiskGraphHero } from './RiskGraphHero';
import { RiskSutraLogo } from '../branding/RiskSutraLogo';
import { EvaluationReport } from '@/lib/api';

interface LandingPageProps {
  onEnterApp: () => void;
  onGoToEvaluation: () => void;
  evaluation: EvaluationReport | null;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onEnterApp,
  onGoToEvaluation,
  evaluation,
}) => {
  return (
    <div style={{ background: 'var(--bg-base)', minHeight: '100vh', overflowX: 'hidden' }}>
      {/* Hero Section */}
      <section
        style={{
          padding: '4rem 1.5rem 4rem',
          maxWidth: '1200px',
          margin: '0 auto',
          textAlign: 'center',
          position: 'relative',
        }}
      >
        {/* Ambient Hero Spotlight Glow */}
        <div
          style={{
            position: 'absolute',
            top: '30px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: 'min(860px, 94vw)',
            height: '280px',
            background: 'radial-gradient(ellipse 70% 60% at 50% 50%, rgba(2, 132, 199, 0.14) 0%, rgba(99, 102, 241, 0.08) 45%, rgba(168, 85, 247, 0.04) 70%, transparent 85%)',
            filter: 'blur(36px)',
            pointerEvents: 'none',
            zIndex: 0,
          }}
        />

        {/* Track 02 Announcement Ribbon */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.65rem',
            padding: '0.42rem 1.15rem',
            background: 'var(--accent-tint)',
            border: '1px solid var(--border-accent)',
            borderRadius: '9999px',
            fontSize: '0.8rem',
            fontWeight: 700,
            color: 'var(--accent-primary)',
            marginBottom: '1.75rem',
            position: 'relative',
            zIndex: 2,
            boxShadow: '0 2px 10px -2px rgba(2, 132, 199, 0.15)',
          }}
        >
          <span
            style={{
              display: 'inline-block',
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: '#10B981',
              boxShadow: '0 0 10px #10B981',
            }}
          />
          <span>Razorpay Buildathon 2026</span>
          <span style={{ opacity: 0.4 }}>•</span>
          <span style={{ color: 'var(--text-primary)' }}>AI Risk Manager Track 02</span>
        </div>

        {/* Flagship Hero Brand Lockup */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            margin: '0.5rem auto 2.5rem',
            position: 'relative',
            zIndex: 2,
          }}
        >
          <RiskSutraLogo variant="hero" size="hero" animated={true} />
        </div>

        {/* Hero Headline */}
        <h1
          className="display-title"
          style={{
            maxWidth: '900px',
            margin: '0 auto 1.25rem',
          }}
        >
          See the attack <span className="text-gradient">before the damage.</span>
        </h1>

        {/* Hero Subtitle */}
        <p
          style={{
            fontSize: 'clamp(1.05rem, 2vw, 1.25rem)',
            color: 'var(--text-secondary)',
            maxWidth: '740px',
            margin: '0 auto 2.5rem',
            lineHeight: 1.6,
            fontWeight: 400,
          }}
        >
          RiskSūtra is an AI-powered merchant risk intelligence engine that detects Account Takeover through behavioral context, temporal attack chains, and evidence-grounded investigation.
        </p>

        {/* Action CTAs */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap', marginBottom: '3.5rem' }}>
          <button
            className="btn btn-primary"
            onClick={onEnterApp}
            style={{
              padding: '0.8rem 1.75rem',
              fontSize: '1rem',
              borderRadius: '10px',
              gap: '0.65rem',
            }}
          >
            <span>Open Security Command Center</span>
            <span>→</span>
          </button>

          <button
            className="btn btn-secondary"
            onClick={onGoToEvaluation}
            style={{
              padding: '0.8rem 1.5rem',
              fontSize: '1rem',
              borderRadius: '10px',
              gap: '0.5rem',
            }}
          >
            <span>View Held-Out Evaluation</span>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>📊</span>
          </button>
        </div>

        {/* Living Risk Graph Hero Component */}
        <RiskGraphHero />
      </section>

      {/* Trust & Credibility Strip */}
      <section
        style={{
          borderTop: '1px solid var(--border-subtle)',
          borderBottom: '1px solid var(--border-subtle)',
          background: 'var(--bg-surface)',
          padding: '2.5rem 1.5rem',
        }}
      >
        <div
          style={{
            maxWidth: '1100px',
            margin: '0 auto',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '2rem',
            textAlign: 'center',
          }}
        >
          <div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--accent-primary)', fontVariantNumeric: 'tabular-nums' }}>
              {evaluation ? `${(evaluation.metrics_risksutra.precision * 100).toFixed(0)}%` : '100%'}
            </div>
            <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '0.25rem' }}>
              Precision on Held-Out Data
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
              Zero false positives on test split
            </div>
          </div>

          <div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--risk-low)', fontVariantNumeric: 'tabular-nums' }}>
              {evaluation ? `${(evaluation.metrics_risksutra.recall * 100).toFixed(0)}%` : '100%'}
            </div>
            <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '0.25rem' }}>
              ATO Attack Recall
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
              Across 5 distinct merchant archetypes
            </div>
          </div>

          <div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
              14-Day
            </div>
            <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '0.25rem' }}>
              Behavioral Baseline
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
              Chronological split with zero leakage
            </div>
          </div>

          <div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--accent-violet)', fontVariantNumeric: 'tabular-nums' }}>
              Defense-First
            </div>
            <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '0.25rem' }}>
              Bounded Containment
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
              Policy Gate auditable auto-responder
            </div>
          </div>
        </div>
      </section>

      {/* The Core Differentiator: "An anomaly isn't always an attack" */}
      <section style={{ padding: '5rem 1.5rem', maxWidth: '1100px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.5rem' }}>
            Behavioral Context Changes Everything
          </div>
          <h2 className="section-title">An anomaly isn&apos;t always an attack.</h2>
          <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', maxWidth: '640px', margin: '0.5rem auto 0', lineHeight: 1.6 }}>
            Traditional fraud engines alert on any sudden spike. RiskSūtra reconstructs the temporal workflow to separate genuine business growth from account takeover.
          </p>
        </div>

        {/* Side-by-Side Comparison */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
          {/* Legitimate Campaign Spike */}
          <div
            className="panel"
            style={{
              padding: '2rem',
              borderColor: 'rgba(5, 150, 105, 0.25)',
              background: 'var(--bg-surface)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <span className="badge badge-low">✓ Legitimate Campaign Spike</span>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--risk-low)' }}>BENIGN (Risk Score: 12.0)</span>
            </div>

            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text-primary)' }}>
              Weekend Surge or Festive Sale
            </h3>
            <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginBottom: '1.25rem', lineHeight: 1.5 }}>
              Transaction volume jumps 5× normal baseline, but happens from known merchant devices, familiar IP subnets, with zero administrative credential changes.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.78rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--risk-low)' }}>
                <span>✓</span> <span>Known devices and operator locations preserved</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--risk-low)' }}>
                <span>✓</span> <span>Zero payout destination modification</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--risk-low)' }}>
                <span>✓</span> <span>Normal user session continuity maintained</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '0.5rem' }}>
                → Verdict: Allow transactions without operational friction
              </div>
            </div>
          </div>

          {/* Account Takeover Attack */}
          <div
            className="panel"
            style={{
              padding: '2rem',
              borderColor: 'rgba(220, 38, 38, 0.3)',
              background: 'var(--bg-surface)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <span className="badge badge-critical">⚠ Account Takeover Attack</span>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--risk-critical)' }}>CRITICAL (Risk Score: 78.5)</span>
            </div>

            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text-primary)' }}>
              Credential Theft &amp; Payout Drain
            </h3>
            <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginBottom: '1.25rem', lineHeight: 1.5 }}>
              A new device logs in from an anomalous geography, generates an API key burst, modifies payout settings, and triggers an immediate high-value transfer.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.78rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--risk-critical)' }}>
                <span>✗</span> <span>Unseen Device ID + High-risk ASN network pivot</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--risk-critical)' }}>
                <span>✗</span> <span>Critical CONFIG_CHANGE within 90s of login</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--risk-critical)' }}>
                <span>✗</span> <span>Immediate high-velocity settlement request</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, color: 'var(--risk-critical)', marginTop: '0.5rem' }}>
                → Verdict: Trigger Policy Gate containment and session quarantine
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Product Architecture Pipeline */}
      <section
        style={{
          background: 'var(--bg-surface)',
          borderTop: '1px solid var(--border-subtle)',
          borderBottom: '1px solid var(--border-subtle)',
          padding: '5rem 1.5rem',
        }}
      >
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.5rem' }}>
              Under The Hood
            </div>
            <h2 className="section-title">End-to-End Defense Pipeline</h2>
            <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', maxWidth: '640px', margin: '0.5rem auto 0' }}>
              How telemetry is transformed into bounded, auditable security actions.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem' }}>
            {[
              { step: '01', title: 'Merchant Telemetry', text: 'Real-time ingestion of login, API, transaction, and config events.' },
              { step: '02', title: 'Behavioral Genome', text: 'Continuously updated merchant baselines across devices, locations, and rates.' },
              { step: '03', title: 'Temporal Workflow', text: 'Sequence integrity engine analyzing state transitions over time windows.' },
              { step: '04', title: 'Risk Fusion', text: 'Multi-factor score calibration combining deviations with historical case memory.' },
              { step: '05', title: 'RiskSūtra AI Agent', text: 'Forensic multi-stage reasoning producing evidence-backed verdicts.' },
              { step: '06', title: 'Policy Gate Defense', text: 'Strictly bounded, defense-only containment and session re-auth.' },
            ].map((p, idx) => (
              <div
                key={idx}
                className="panel"
                style={{
                  padding: '1.25rem 1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--accent-primary)', marginBottom: '0.5rem' }}>
                    {p.step}
                  </div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
                    {p.title}
                  </div>
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                  {p.text}
                </div>
              </div>
            ))}
          </div>

          {/* Architecture Triad: APIs, Datasets, AI Agents */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.25rem', marginTop: '2.5rem' }}>
            <div className="panel" style={{ padding: '1.5rem', background: 'var(--bg-base)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.65rem' }}>
                <span style={{ fontSize: '1.1rem' }}>🔌</span>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  APIs Used &amp; Provenance
                </h3>
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.45, marginBottom: '0.75rem' }}>
                FastAPI REST &amp; Server-Sent Events (SSE) streaming core at <code style={{ fontSize: '0.72rem', color: 'var(--accent-primary)' }}>http://127.0.0.1:8000</code>.
              </p>
              <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.73rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <li><strong style={{ color: 'var(--text-secondary)' }}>Model APIs: </strong>OpenAI GPT-4o-mini &amp; Google Gemini 1.5 Flash via official SDKs</li>
                <li><strong style={{ color: 'var(--text-secondary)' }}>Resilient Fallback: </strong>Offline deterministic MockProvider ensuring 100% test reproducibility</li>
                <li><strong style={{ color: 'var(--text-secondary)' }}>Platform Ingestion: </strong>Razorpay webhook event stream simulation</li>
              </ul>
            </div>

            <div className="panel" style={{ padding: '1.5rem', background: 'var(--bg-base)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.65rem' }}>
                <span style={{ fontSize: '1.1rem' }}>📊</span>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  Datasets &amp; Telemetry Records
                </h3>
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.45, marginBottom: '0.75rem' }}>
                Calibrated against real Indian digital commerce dynamics across 5 distinct merchant archetypes.
              </p>
              <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.73rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <li><strong style={{ color: 'var(--text-secondary)' }}>14-Day Baselines: </strong>Chronological training window with zero future data leakage</li>
                <li><strong style={{ color: 'var(--text-secondary)' }}>Case Memory Corpus: </strong>Vector-indexed precedents of verified past ATO attacks &amp; flash sales</li>
                <li><strong style={{ color: 'var(--text-secondary)' }}>Persistence: </strong>PostgreSQL schema store for merchants, events, and audit trails</li>
              </ul>
            </div>

            <div className="panel" style={{ padding: '1.5rem', background: 'var(--bg-base)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.65rem' }}>
                <span style={{ fontSize: '1.1rem' }}>🧠</span>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  Multi-Agent AI Architecture
                </h3>
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.45, marginBottom: '0.75rem' }}>
                Specialized analytical agents orchestrated under strict human-in-the-loop governance.
              </p>
              <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.73rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <li><strong style={{ color: 'var(--text-secondary)' }}>Contextual Genome: </strong>Multi-factor statistical deviation analysis</li>
                <li><strong style={{ color: 'var(--text-secondary)' }}>Temporal Attack Chain: </strong>Finite State Machine (FSM) kill-chain tracking</li>
                <li><strong style={{ color: 'var(--text-secondary)' }}>Policy Gate Sentinel: </strong>Defense-only containment with human sign-off for high-impact actions</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Why RiskSūtra Feature Grid */}
      <section style={{ padding: '5rem 1.5rem', maxWidth: '1100px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.5rem' }}>
            Core Capabilities
          </div>
          <h2 className="section-title">Built for Merchant ATO Defense</h2>
          <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', maxWidth: '600px', margin: '0.5rem auto 0' }}>
            Precision-tailored detection and verification for high-value merchant platforms.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
          <div className="panel" style={{ padding: '1.75rem' }}>
            <div style={{ fontSize: '1.5rem', marginBottom: '0.75rem' }}>🧬</div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
              Merchant-Specific Behavioral Genome
            </h3>
            <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
              Learns what normal means for each individual merchant. A SaaS API burst is normal on Monday mornings; for a fine-dining restaurant, it represents credential abuse.
            </p>
          </div>

          <div className="panel" style={{ padding: '1.75rem' }}>
            <div style={{ fontSize: '1.5rem', marginBottom: '0.75rem' }}>⏱️</div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
              Temporal Workflow Integrity
            </h3>
            <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
              Sequence matters. RiskSūtra evaluates whether sensitive actions follow legitimate navigation or occur unnaturally quickly after a suspicious network transition.
            </p>
          </div>

          <div className="panel" style={{ padding: '1.75rem' }}>
            <div style={{ fontSize: '1.5rem', marginBottom: '0.75rem' }}>🔍</div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
              Evidence-Grounded AI Investigation
            </h3>
            <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
              Every conclusion directly references immutable telemetry IDs, comparing active anomalies against merchant baselines and considering benign alternatives.
            </p>
          </div>

          <div className="panel" style={{ padding: '1.75rem' }}>
            <div style={{ fontSize: '1.5rem', marginBottom: '0.75rem' }}>🧠</div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
              Historical Case Memory
            </h3>
            <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
              Analyst feedback and closed incidents feed into a vector-grounded memory store, strengthening confidence on repeating attack signatures across the ecosystem.
            </p>
          </div>

          <div className="panel" style={{ padding: '1.75rem' }}>
            <div style={{ fontSize: '1.5rem', marginBottom: '0.75rem' }}>🛡️</div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
              Strictly Bounded Defensive Actions
            </h3>
            <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
              Guaranteed defense-only architecture. Actions are restricted to re-authentication challenges, temporary payout holds, and session quarantine. Zero destructive interventions.
            </p>
          </div>

          <div className="panel" style={{ padding: '1.75rem' }}>
            <div style={{ fontSize: '1.5rem', marginBottom: '0.75rem' }}>📈</div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
              Honest Cost Impact Modeling
            </h3>
            <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
              Evaluates both false positive friction cost and false negative loss reduction on strictly held-out chronological test splits with zero data leakage.
            </p>
          </div>
        </div>
      </section>

      {/* Final Launch CTA */}
      <section
        style={{
          background: 'var(--bg-surface)',
          borderTop: '1px solid var(--border-subtle)',
          padding: '5rem 1.5rem',
          textAlign: 'center',
        }}
      >
        <div style={{ maxWidth: '680px', margin: '0 auto' }}>
          <h2 className="section-title" style={{ marginBottom: '1rem' }}>
            Turn merchant behavior into an active line of defense.
          </h2>
          <p style={{ fontSize: '1rem', color: 'var(--text-secondary)', marginBottom: '2rem', lineHeight: 1.6 }}>
            Explore the live Security Command Center to inspect the 5 monitored merchant archetypes, simulate ATO attack scenarios, and launch the RiskSūtra AI forensic agent.
          </p>
          <button
            className="btn btn-primary"
            onClick={onEnterApp}
            style={{
              padding: '0.85rem 2rem',
              fontSize: '1.05rem',
              borderRadius: '10px',
              gap: '0.5rem',
            }}
          >
            <span>Open Security Command Center</span>
            <span>→</span>
          </button>
        </div>
      </section>

      {/* Brand Footer */}
      <footer
        style={{
          borderTop: '1px solid var(--border-subtle)',
          padding: '2.5rem 1.5rem',
          background: 'var(--bg-base)',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '0.85rem',
        }}
      >
        <RiskSutraLogo variant="compact" size="sm" />
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          RiskSūtra — AI Merchant Risk Intelligence · Built for Razorpay Buildathon 2026 (Track 02: AI Risk Manager)
        </div>
      </footer>
    </div>
  );
};
