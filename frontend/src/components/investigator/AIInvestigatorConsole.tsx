'use client';

import React, { useState } from 'react';
import {
  AIInvestigationResult,
  InvestigationAuditRecord,
  Incident,
} from '@/lib/api';
import { AttackChainFlow } from './AttackChainFlow';
import { EvidenceCard } from './EvidenceCard';

interface StageProgressItem {
  index: number;
  label: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED';
  detail?: string;
}

interface AIInvestigatorConsoleProps {
  incident: Incident | null;
  investigationState: 'NOT_RUN' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  investigation: AIInvestigationResult | null;
  audit: InvestigationAuditRecord | null;
  stageProgress: StageProgressItem[];
  errorMessage: string | null;
  onRunInvestigation: () => void;
  onUpdateStatus: (newStatus: string) => void;
  onSubmitFeedback: (outcome: string, notes?: string) => void;
  statusUpdating: boolean;
  feedbackSuccess: string | null;
}

function getAssessmentBadge(assessment: string) {
  switch (assessment?.toUpperCase()) {
    case 'LIKELY_ATO':
      return {
        badge: 'badge badge-critical',
        label: 'Likely Account Takeover (ATO)',
        color: 'var(--risk-critical)',
        bg: 'var(--risk-critical-bg)',
      };
    case 'SUSPICIOUS':
      return {
        badge: 'badge badge-high',
        label: 'Suspicious / Elevated Risk',
        color: 'var(--risk-high)',
        bg: 'var(--risk-high-bg)',
      };
    case 'LIKELY_BENIGN':
      return {
        badge: 'badge badge-low',
        label: 'Likely Benign Activity',
        color: 'var(--risk-low)',
        bg: 'var(--risk-low-bg)',
      };
    default:
      return {
        badge: 'badge badge-medium',
        label: 'Inconclusive / Needs Review',
        color: 'var(--risk-medium)',
        bg: 'var(--risk-medium-bg)',
      };
  }
}

export const AIInvestigatorConsole: React.FC<AIInvestigatorConsoleProps> = ({
  incident,
  investigationState,
  investigation,
  audit,
  stageProgress,
  errorMessage,
  onRunInvestigation,
  onUpdateStatus,
  onSubmitFeedback,
  statusUpdating,
  feedbackSuccess,
}) => {
  const [feedbackNotes, setFeedbackNotes] = useState('');

  if (!incident) {
    return (
      <div
        className="panel"
        style={{
          padding: '3rem 2rem',
          textAlign: 'center',
          color: 'var(--text-muted)',
        }}
      >
        <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>🔍</div>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
          No Incident Selected
        </h3>
        <p style={{ fontSize: '0.85rem', maxWidth: '440px', margin: '0 auto' }}>
          Select an incident from the merchant workspace or global incident queue to conduct an evidence-grounded AI forensic investigation.
        </p>
      </div>
    );
  }

  return (
    <div id="ai-investigator-console" className="panel" style={{ padding: '2rem', position: 'relative' }}>
      {/* Console Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--border-subtle)',
          paddingBottom: '1.25rem',
          marginBottom: '1.75rem',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '8px',
              background: 'var(--accent-tint)',
              border: '1px solid var(--border-accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.25rem',
            }}
          >
            ⚖️
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                RiskSūtra AI Investigator
              </h2>
              <span className="badge badge-intel">RiskSūtra AI Agent</span>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
              Target: <strong style={{ color: 'var(--text-secondary)' }}>{incident.incident_id}</strong> ({incident.incident_type}) · Merchant: {incident.merchant_id}
            </p>
          </div>
        </div>

        {/* State Tag & Action */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {investigationState === 'NOT_RUN' && (
            <button
              className="btn btn-primary"
              onClick={onRunInvestigation}
              style={{
                fontSize: '0.85rem',
                padding: '0.6rem 1.35rem',
                boxShadow: 'var(--shadow-glow)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontWeight: 700,
              }}
            >
              <span>⚡</span> Run RiskSūtra AI Agent
            </button>
          )}

          {investigationState === 'RUNNING' && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.45rem 0.85rem',
                background: 'var(--accent-tint)',
                border: '1px solid var(--border-accent)',
                borderRadius: '8px',
                fontSize: '0.78rem',
                fontWeight: 700,
                color: 'var(--accent-primary)',
              }}
            >
              <span className="pulse-indicator" />
              <span>RiskSūtra AI Agent Investigating...</span>
            </div>
          )}

          {investigationState === 'COMPLETED' && (
            <button
              className="btn btn-secondary"
              onClick={onRunInvestigation}
              style={{ fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}
            >
              <span>↺</span> Re-Run RiskSūtra AI Agent
            </button>
          )}
        </div>
      </div>

      {/* ── STATE 1: NOT_RUN ── */}
      {investigationState === 'NOT_RUN' && (
        <div
          style={{
            padding: '3.25rem 2rem',
            textAlign: 'center',
            background: 'var(--bg-subtle)',
            borderRadius: '12px',
            border: '1px dashed var(--border-muted)',
            position: 'relative',
          }}
        >
          <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🧠</div>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
            RiskSūtra AI Agent Ready to Investigate
          </h3>
          <p
            style={{
              fontSize: '0.86rem',
              color: 'var(--text-secondary)',
              maxWidth: '580px',
              margin: '0 auto 1.75rem',
              lineHeight: 1.6,
            }}
          >
            Launch the <strong>RiskSūtra AI Agent</strong> to evaluate behavioral deviations against merchant baselines, reconstruct the temporal attack chain, query vector case memory, stress-test benign hypotheses, and produce policy-gated containment actions.
          </p>

          <button
            className="btn btn-primary"
            onClick={onRunInvestigation}
            style={{
              fontSize: '1rem',
              padding: '0.85rem 2.25rem',
              borderRadius: '10px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.65rem',
              fontWeight: 800,
              boxShadow: '0 4px 16px rgba(2, 132, 199, 0.35)',
            }}
          >
            <span>⚡</span> Launch RiskSūtra AI Agent
          </button>
        </div>
      )}

      {/* ── STATE 2: RUNNING (10 Authentic Stages) ── */}
      {investigationState === 'RUNNING' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              RiskSūtra AI Pipeline (10 Forensic Reasoning Phases)
            </span>
            <span style={{ fontSize: '0.72rem', color: 'var(--accent-primary)', fontWeight: 600 }}>
              RiskSūtra AI Agent Streaming Reasoning
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {stageProgress.map((stg) => {
              const isDone = stg.status === 'COMPLETED';
              const isRunning = stg.status === 'RUNNING';

              let borderColor = 'var(--border-subtle)';
              let bg = 'var(--bg-subtle)';
              let textColor = 'var(--text-muted)';

              if (isRunning) {
                borderColor = 'var(--accent-primary)';
                bg = 'var(--accent-tint)';
                textColor = 'var(--accent-primary)';
              } else if (isDone) {
                borderColor = 'rgba(5, 150, 105, 0.25)';
                bg = 'var(--risk-low-bg)';
                textColor = 'var(--risk-low)';
              }

              return (
                <div
                  key={stg.index}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.65rem 1rem',
                    borderRadius: '8px',
                    background: bg,
                    border: `1px solid ${borderColor}`,
                    fontSize: '0.8rem',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ fontWeight: 800, fontSize: '0.72rem', color: textColor, fontVariantNumeric: 'tabular-nums', width: '22px' }}>
                      {stg.index < 10 ? `0${stg.index}` : stg.index}
                    </span>
                    <span style={{ fontWeight: isRunning || isDone ? 700 : 500, color: isRunning ? 'var(--accent-primary)' : isDone ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                      {stg.label}
                    </span>
                  </div>

                  <div>
                    {isRunning && (
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--accent-primary)' }}>
                        Thinking...
                      </span>
                    )}
                    {isDone && (
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--risk-low)' }}>
                        ✓ Done
                      </span>
                    )}
                    {!isRunning && !isDone && (
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        Queued
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── STATE 3: FAILED ── */}
      {investigationState === 'FAILED' && (
        <div
          style={{
            padding: '2.5rem 1.5rem',
            textAlign: 'center',
            background: 'var(--risk-critical-bg)',
            border: '1px solid rgba(220, 38, 38, 0.25)',
            borderRadius: '12px',
          }}
        >
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⚠️</div>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--risk-critical)', marginBottom: '0.5rem' }}>
            RiskSūtra AI Agent Investigation Interrupted
          </h3>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', maxWidth: '480px', margin: '0 auto 1.5rem' }}>
            {errorMessage || 'An error occurred during forensic synthesis. Please try again.'}
          </p>
          <button className="btn btn-danger" onClick={onRunInvestigation} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}>
            <span>⚡</span> Retry RiskSūtra AI Agent
          </button>
        </div>
      )}

      {/* ── STATE 4: COMPLETED VERDICT & EVIDENCE ── */}
      {investigationState === 'COMPLETED' && investigation && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {/* Executive Verdict Banner */}
          {(() => {
            const info = getAssessmentBadge(investigation.assessment);
            return (
              <div
                style={{
                  background: info.bg,
                  border: `1.5px solid ${info.color}`,
                  borderRadius: '12px',
                  padding: '1.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '1rem',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.35rem' }}>
                    <span className={info.badge}>{info.label}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Run ID: {investigation.run_id || 'v1-verified'}
                    </span>
                  </div>
                  <h3 style={{ fontSize: '1.4rem', fontWeight: 800, color: info.color }}>
                    {investigation.assessment.replace('_', ' ')}
                  </h3>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '0.25rem', maxWidth: '700px', lineHeight: 1.5 }}>
                    {investigation.executive_summary || investigation.summary}
                  </p>
                </div>

                <div
                  style={{
                    textAlign: 'right',
                    padding: '0.75rem 1.25rem',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '10px',
                  }}
                >
                  <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    Confidence Score
                  </div>
                  <div style={{ fontSize: '2rem', fontWeight: 800, color: info.color, fontVariantNumeric: 'tabular-nums' }}>
                    {(investigation.confidence * 100).toFixed(0)}%
                  </div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                    Evidence-calibrated
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Temporal Attack Chain */}
          <AttackChainFlow progression={investigation.attack_progression} />

          {/* Key Evidence Items */}
          {investigation.key_evidence && investigation.key_evidence.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h4 style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Key Telemetry Evidence ({investigation.key_evidence.length})
                </h4>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  Click any item to inspect forensic reasoning
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {investigation.key_evidence.map((ev, idx) => (
                  <EvidenceCard key={`${ev.event_id}-${idx}`} item={ev} />
                ))}
              </div>
            </div>
          )}

          {/* Alternative Explanations Considered */}
          {investigation.legitimate_explanations_considered && investigation.legitimate_explanations_considered.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <h4 style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Alternative Benign Explanations Considered
              </h4>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.75rem' }}>
                {investigation.legitimate_explanations_considered.map((alt, idx) => {
                  const isRejected = alt.status === 'REJECTED';
                  const isSupported = alt.status === 'SUPPORTED';
                  return (
                    <div
                      key={idx}
                      className="panel-subtle"
                      style={{
                        padding: '1rem',
                        borderLeft: `4px solid ${isRejected ? 'var(--risk-critical)' : isSupported ? 'var(--risk-low)' : 'var(--risk-medium)'}`,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                          {alt.hypothesis}
                        </span>
                        <span
                          style={{
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            padding: '0.15rem 0.45rem',
                            borderRadius: '4px',
                            background: isRejected ? 'var(--risk-critical-bg)' : isSupported ? 'var(--risk-low-bg)' : 'var(--risk-medium-bg)',
                            color: isRejected ? 'var(--risk-critical)' : isSupported ? 'var(--risk-low)' : 'var(--risk-medium)',
                          }}
                        >
                          {alt.status}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                        {alt.counter_evidence?.length > 0
                          ? `Contradiction: ${alt.counter_evidence[0]}`
                          : alt.supporting_evidence?.length > 0
                          ? `Evidence: ${alt.supporting_evidence[0]}`
                          : 'Evaluated against baseline.'}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Historical Case Memory Matches */}
          {investigation.historical_matches && investigation.historical_matches.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h4 style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Similar Historical Incidents Retrieved
                </h4>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  Vector similarity from Case Memory
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.75rem' }}>
                {investigation.historical_matches.map((m, idx) => {
                  const matchPct = m.similarity_percentage > 1
                    ? m.similarity_percentage
                    : m.similarity_percentage * 100;
                  const patternDisplay = m.pattern && m.pattern !== 'NONE' && m.pattern.trim() !== ''
                    ? m.pattern
                    : 'Behavioral Baseline Deviation';

                  return (
                    <div key={idx} className="panel-subtle" style={{ padding: '0.85rem 1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                        <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.78rem', color: 'var(--accent-primary)' }}>
                          {m.incident_id}
                        </span>
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--accent-primary)' }}>
                          {matchPct.toFixed(0)}% match
                        </span>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        <strong>Pattern: </strong>{patternDisplay}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                        Resolved: {m.resolution}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Defensive Response & Containment */}
          {investigation.recommended_defensive_actions && investigation.recommended_defensive_actions.length > 0 && (
            <div
              style={{
                background: 'var(--bg-subtle)',
                border: '1px solid var(--border-accent)',
                borderRadius: '10px',
                padding: '1.25rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <span style={{ fontSize: '1.1rem' }}>🛡️</span>
                <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Bounded Defensive Response (Policy Gate)
                </h4>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '1rem' }}>
                {investigation.recommended_defensive_actions.map((act, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    <span style={{ color: 'var(--accent-primary)', fontWeight: 700 }}>•</span>
                    <span>{act}</span>
                  </div>
                ))}
              </div>

              {investigation.resolution_conditions && investigation.resolution_conditions.length > 0 && (
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.75rem' }}>
                  <strong style={{ color: 'var(--text-secondary)' }}>Safe Recovery Conditions: </strong>
                  {investigation.resolution_conditions.join('; ')}
                </div>
              )}
            </div>
          )}

          {/* Incident Lifecycle Action Buttons */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderTop: '1px solid var(--border-subtle)',
              paddingTop: '1.25rem',
              flexWrap: 'wrap',
              gap: '1rem',
            }}
          >
            <div>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                Current Incident Status: <strong style={{ color: 'var(--text-primary)' }}>{incident.status}</strong>
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <button
                className="btn btn-outline-danger"
                disabled={statusUpdating || incident.status === 'CONTAINED'}
                onClick={() => onUpdateStatus('CONTAINED')}
                style={{ fontSize: '0.78rem' }}
              >
                Mark Contained
              </button>
              <button
                className="btn btn-secondary"
                disabled={statusUpdating || incident.status === 'RECOVERING'}
                onClick={() => onUpdateStatus('RECOVERING')}
                style={{ fontSize: '0.78rem' }}
              >
                Mark Recovering
              </button>
              <button
                className="btn btn-success"
                disabled={statusUpdating || incident.status === 'RESOLVED'}
                onClick={() => onUpdateStatus('RESOLVED')}
                style={{ fontSize: '0.78rem' }}
              >
                Mark Resolved ✓
              </button>
            </div>
          </div>

          {/* Analyst Feedback Form */}
          <div
            style={{
              background: 'var(--bg-subtle)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '10px',
              padding: '1.25rem',
            }}
          >
            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
              Analyst Ground-Truth Feedback Loop
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.85rem' }}>
              Submit verified outcome to strengthen vector case memory and calibration accuracy.
            </p>

            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <button
                className="btn btn-danger"
                style={{ fontSize: '0.76rem', padding: '0.4rem 0.8rem' }}
                onClick={() => onSubmitFeedback('CONFIRMED_ATO', feedbackNotes)}
              >
                Confirm ATO Attack
              </button>
              <button
                className="btn btn-success"
                style={{ fontSize: '0.76rem', padding: '0.4rem 0.8rem' }}
                onClick={() => onSubmitFeedback('BENIGN_SPIKE', feedbackNotes)}
              >
                Confirm Benign Spike
              </button>
              <button
                className="btn btn-secondary"
                style={{ fontSize: '0.76rem', padding: '0.4rem 0.8rem' }}
                onClick={() => onSubmitFeedback('FALSE_POSITIVE', feedbackNotes)}
              >
                Mark False Positive
              </button>
            </div>

            {feedbackSuccess && (
              <div style={{ marginTop: '0.75rem', fontSize: '0.75rem', color: 'var(--risk-low)', fontWeight: 600 }}>
                ✓ {feedbackSuccess}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
