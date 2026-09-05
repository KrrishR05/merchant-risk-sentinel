'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  api,
  Overview,
  MerchantProfile,
  RiskAssessment,
  MerchantEvent,
  Incident,
  AIInvestigationResult,
  InvestigationAuditRecord,
  EvaluationReport,
} from '@/lib/api';

import { AppNavbar } from '@/components/navigation/AppNavbar';
import { AppSidebar } from '@/components/navigation/AppSidebar';
import { LandingPage } from '@/components/landing/LandingPage';
import { OverviewView } from '@/components/dashboard/OverviewView';
import { MerchantWorkspace } from '@/components/merchant/MerchantWorkspace';
import { AIInvestigatorConsole } from '@/components/investigator/AIInvestigatorConsole';
import { IncidentQueueView } from '@/components/incidents/IncidentQueueView';
import { EvaluationView } from '@/components/evaluation/EvaluationView';
import { SystemStatusView } from '@/components/system/SystemStatusView';
import { ScenarioInjectModal } from '@/components/modals/ScenarioInjectModal';

type ViewMode = 'landing' | 'overview' | 'merchant' | 'incidents' | 'evaluation' | 'system';
type InvestigationState = 'NOT_RUN' | 'RUNNING' | 'COMPLETED' | 'FAILED';

export default function App() {
  // Theme Management (Light by default, persistent in localStorage)
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem('risksutra-theme');
      if (savedTheme === 'dark' || savedTheme === 'light') {
        setTheme(savedTheme);
      }
    } catch {
      // localStorage unavailable in some sandbox environments
    }
  }, []);

  const handleToggleTheme = () => {
    setTheme((prev) => {
      const next = prev === 'light' ? 'dark' : 'light';
      try {
        localStorage.setItem('risksutra-theme', next);
      } catch {}
      return next;
    });
  };

  // Primary Navigation
  const [view, setView] = useState<ViewMode>('landing');

  // Core Data State
  const [overview, setOverview] = useState<Overview | null>(null);
  const [selectedMerchantId, setSelectedMerchantId] = useState<string | null>(null);
  const [profile, setProfile] = useState<MerchantProfile | null>(null);
  const [risk, setRisk] = useState<RiskAssessment | null>(null);
  const [events, setEvents] = useState<MerchantEvent[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [activeIncident, setActiveIncident] = useState<Incident | null>(null);
  const activeIncidentRef = useRef<Incident | null>(null);

  // Health & Evaluation Data
  const [health, setHealth] = useState<{ status: string; database: string } | null>(null);
  const [evaluation, setEvaluation] = useState<EvaluationReport | null>(null);

  // Loading & Action State
  const [loading, setLoading] = useState(true);
  const [evalLoading, setEvalLoading] = useState(false);
  const [healthLoading, setHealthLoading] = useState(false);
  const [injectModalOpen, setInjectModalOpen] = useState(false);
  const [injecting, setInjecting] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [feedbackSuccess, setFeedbackSuccess] = useState<string | null>(null);

  // AI Investigator State Machine (PART 2 / NON-NEGOTIABLE LIFECYCLE)
  const [investigationState, setInvestigationState] = useState<InvestigationState>('NOT_RUN');
  const [investigation, setInvestigation] = useState<AIInvestigationResult | null>(null);
  const [audit, setAudit] = useState<InvestigationAuditRecord | null>(null);
  const [investigationError, setInvestigationError] = useState<string | null>(null);

  const [stageProgress, setStageProgress] = useState<{
    index: number;
    label: string;
    status: 'PENDING' | 'RUNNING' | 'COMPLETED';
    detail?: string;
  }[]>([
    { index: 1, label: 'Loading merchant behavioral context', status: 'PENDING' },
    { index: 2, label: 'Reviewing risk signals', status: 'PENDING' },
    { index: 3, label: 'Reconstructing temporal workflow', status: 'PENDING' },
    { index: 4, label: 'Checking entity relationships', status: 'PENDING' },
    { index: 5, label: 'Comparing legitimate explanations', status: 'PENDING' },
    { index: 6, label: 'Searching historical case memory', status: 'PENDING' },
    { index: 7, label: 'Retrieving supporting evidence', status: 'PENDING' },
    { index: 8, label: 'Synthesizing forensic investigation', status: 'PENDING' },
    { index: 9, label: 'Producing assessment & remediation plan', status: 'PENDING' },
    { index: 10, label: 'Persisting investigation & case memory', status: 'PENDING' },
  ]);

  // Load Overview Data
  const loadOverview = useCallback(async () => {
    try {
      setLoading(true);
      const [ov, inc, h, ev] = await Promise.allSettled([
        api.getOverview(),
        api.getIncidents(200),
        api.getHealth(),
        api.getEvaluation(),
      ]);

      if (ov.status === 'fulfilled') setOverview(ov.value);
      if (inc.status === 'fulfilled') setIncidents(inc.value.incidents);
      if (h.status === 'fulfilled') setHealth(h.value);
      if (ev.status === 'fulfilled') setEvaluation(ev.value);
    } catch (e) {
      console.error('Failed to load overview:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  // Load Single Merchant Workspace (STRICT: NEVER AUTO-HYDRATES AI INVESTIGATION)
  const loadMerchant = useCallback(
    async (id: string, targetIncidentId?: string) => {
      try {
        setLoading(true);
        setFeedbackSuccess(null);
        setInvestigationError(null);
        setInvestigation(null);
        setAudit(null);
        setInvestigationState('NOT_RUN');

        const [r, p, ev, incList] = await Promise.all([
          api.getMerchantRisk(id),
          api.getMerchantProfile(id),
          api.getMerchantEvents(id, 40),
          api.getIncidents(200),
        ]);

        setRisk(r);
        setProfile(p);
        setEvents(ev.events);
        setSelectedMerchantId(id);

        const merchantIncidents = incList.incidents
          .filter((i) => i.merchant_id === id)
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        const targetInc = targetIncidentId
          ? merchantIncidents.find((i) => i.incident_id === targetIncidentId) || merchantIncidents[0] || null
          : merchantIncidents[0] || null;

        setActiveIncident(targetInc);
        activeIncidentRef.current = targetInc;

        // STRICT NON-NEGOTIABLE RULE: Normal merchant/incident navigation MUST leave AI Investigator in NOT_RUN!
        setInvestigation(null);
        setAudit(null);
        setInvestigationState('NOT_RUN');
      } catch (e) {
        console.error('Failed to load merchant:', e);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const handleSelectMerchant = (id: string, targetIncidentId?: string) => {
    setView('merchant');
    loadMerchant(id, targetIncidentId);
  };

  const handleSelectIncident = (merchantId: string, incidentId: string) => {
    setView('merchant');
    loadMerchant(merchantId, incidentId);
  };

  // Run AI Investigation Action (ONLY triggers when user clicks button)
  const handleRunInvestigation = async () => {
    const inc = activeIncidentRef.current || activeIncident;
    if (!inc) return;

    setInvestigationState('RUNNING');
    setInvestigationError(null);
    setInvestigation(null);
    setAudit(null);

    // Reset stages
    setStageProgress((prev) => prev.map((s) => ({ ...s, status: 'PENDING' })));

    try {
      // Use SSE streaming for real-time stage progress
      api.streamInvestigation(
        inc.incident_id,
        (evt) => {
          if (typeof evt.stage_index === 'number') {
            setStageProgress((prev) =>
              prev.map((s) => {
                if (s.index < evt.stage_index!) return { ...s, status: 'COMPLETED' };
                if (s.index === evt.stage_index) {
                  return {
                    ...s,
                    status: evt.status === 'DONE' || evt.status === 'COMPLETED' ? 'COMPLETED' : 'RUNNING',
                    detail: evt.detail,
                  };
                }
                return s;
              })
            );
          }
        },
        (data) => {
          setStageProgress((prev) => prev.map((s) => ({ ...s, status: 'COMPLETED' })));
          setInvestigation(data.investigation);
          setAudit(data.audit);
          setInvestigationState('COMPLETED');
        },
        async (streamErr) => {
          console.warn('Stream failed or closed, falling back to POST /investigate:', streamErr);
          try {
            const fallbackData = await api.investigateIncident(inc.incident_id);
            setStageProgress((prev) => prev.map((s) => ({ ...s, status: 'COMPLETED' })));
            setInvestigation(fallbackData.investigation);
            setAudit(fallbackData.audit);
            setInvestigationState('COMPLETED');
          } catch (postErr) {
            setInvestigationError(postErr instanceof Error ? postErr.message : 'Investigation failed');
            setInvestigationState('FAILED');
          }
        }
      );
    } catch (e) {
      setInvestigationError(e instanceof Error ? e.message : 'Failed to launch investigation');
      setInvestigationState('FAILED');
    }
  };

  // Scenario Injection Execution
  const handleInjectScenario = async (merchantId: string, scenarioType: string) => {
    try {
      setInjecting(true);
      const res = await api.injectScenario(merchantId, scenarioType);

      // Refresh overview
      const [ov, incList] = await Promise.all([api.getOverview(), api.getIncidents(200)]);
      setOverview(ov);
      setIncidents(incList.incidents);

      // Navigate to merchant
      const newIncId = res.incident_id || res.incident_created?.incident_id;
      await loadMerchant(merchantId, newIncId);

      // EXCEPTION TO NOT_RUN: Scenario injection automatically starts a fresh investigation
      if (newIncId) {
        setTimeout(() => {
          handleRunInvestigation();
        }, 300);
      }
    } catch (e) {
      console.error('Failed to inject scenario:', e);
    } finally {
      setInjecting(false);
    }
  };

  // Incident Lifecycle Update
  const handleUpdateStatus = async (newStatus: string) => {
    if (!activeIncident) return;
    try {
      setStatusUpdating(true);
      await api.updateIncidentStatus(activeIncident.incident_id, newStatus);
      setActiveIncident({ ...activeIncident, status: newStatus });
      setIncidents((prev) =>
        prev.map((i) => (i.incident_id === activeIncident.incident_id ? { ...i, status: newStatus } : i))
      );
    } catch (e) {
      console.error('Failed to update status:', e);
    } finally {
      setStatusUpdating(false);
    }
  };

  // Analyst Feedback Submission
  const handleSubmitFeedback = async (outcome: string, notes?: string) => {
    if (!activeIncident) return;
    try {
      await api.submitAnalystFeedback(activeIncident.incident_id, outcome, notes);
      setFeedbackSuccess(`Feedback recorded: ${outcome}. Updated vector case memory.`);
    } catch (e) {
      console.error('Failed to submit feedback:', e);
    }
  };

  // Refresh Evaluation
  const handleRefreshEvaluation = async () => {
    try {
      setEvalLoading(true);
      const ev = await api.getEvaluation();
      setEvaluation(ev);
    } catch (e) {
      console.error('Failed to refresh evaluation:', e);
    } finally {
      setEvalLoading(false);
    }
  };

  // Refresh Health
  const handleRefreshHealth = async () => {
    try {
      setHealthLoading(true);
      const h = await api.getHealth();
      setHealth(h);
    } catch (e) {
      console.error('Failed to refresh health:', e);
    } finally {
      setHealthLoading(false);
    }
  };

  return (
    <div className={theme === 'dark' ? 'theme-dark' : 'theme-light'}>
      {/* Global Navigation Top Bar */}
      <AppNavbar
        theme={theme}
        onToggleTheme={handleToggleTheme}
        activeView={view}
        onNavigate={(v) => {
          setView(v);
          if (v === 'overview') loadOverview();
        }}
        onOpenInjectModal={() => setInjectModalOpen(true)}
        dbStatus={health?.database || 'ok'}
      />

      {/* Main Body */}
      {view === 'landing' ? (
        /* Public Homepage (Full-width, Light-First by default) */
        <LandingPage
          onEnterApp={() => {
            setView('overview');
            loadOverview();
          }}
          onGoToEvaluation={() => setView('evaluation')}
          evaluation={evaluation}
        />
      ) : (
        /* Application Shell (Sidebar + Main Workspace) */
        <div style={{ display: 'flex', minHeight: 'calc(100vh - 64px)' }}>
          <AppSidebar
            activeView={view}
            onNavigate={(v) => {
              setView(v);
              if (v === 'overview') loadOverview();
            }}
            merchants={overview?.merchant_risks || []}
            selectedMerchantId={selectedMerchantId}
            onSelectMerchant={(id) => handleSelectMerchant(id)}
            incidentCount={overview?.total_incidents || incidents.length}
          />

          <main style={{ flex: 1, padding: '2rem 2.5rem', background: 'var(--bg-base)', overflowY: 'auto' }}>
            {view === 'overview' && overview && (
              <OverviewView
                overview={overview}
                incidents={incidents}
                onSelectMerchant={(id, incId) => handleSelectMerchant(id, incId)}
                onOpenIncidents={() => setView('incidents')}
                onOpenInjectModal={() => setInjectModalOpen(true)}
              />
            )}

            {view === 'merchant' && profile && risk && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                <MerchantWorkspace
                  merchantId={selectedMerchantId || ''}
                  profile={profile}
                  risk={risk}
                  events={events}
                  incidents={incidents.filter((i) => i.merchant_id === selectedMerchantId)}
                  activeIncident={activeIncident}
                  onSelectIncident={(incId) => {
                    const inc = incidents.find((i) => i.incident_id === incId) || null;
                    setActiveIncident(inc);
                    activeIncidentRef.current = inc;
                    // STRICT: selecting incident resets to NOT_RUN
                    setInvestigation(null);
                    setAudit(null);
                    setInvestigationState('NOT_RUN');
                  }}
                  onBackToOverview={() => setView('overview')}
                  onInjectScenario={(type) => {
                    if (selectedMerchantId) handleInjectScenario(selectedMerchantId, type);
                  }}
                  injecting={injecting}
                />

                {/* Forensic AI Investigator Centerpiece */}
                <AIInvestigatorConsole
                  incident={activeIncident}
                  investigationState={investigationState}
                  investigation={investigation}
                  audit={audit}
                  stageProgress={stageProgress}
                  errorMessage={investigationError}
                  onRunInvestigation={handleRunInvestigation}
                  onUpdateStatus={handleUpdateStatus}
                  onSubmitFeedback={handleSubmitFeedback}
                  statusUpdating={statusUpdating}
                  feedbackSuccess={feedbackSuccess}
                />
              </div>
            )}

            {view === 'incidents' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                <IncidentQueueView
                  incidents={incidents}
                  totalIncidentsCount={overview?.total_incidents || incidents.length}
                  onSelectIncident={(merchantId, incidentId) => handleSelectIncident(merchantId, incidentId)}
                  onBackToOverview={() => setView('overview')}
                />

                {activeIncident && (
                  <AIInvestigatorConsole
                    incident={activeIncident}
                    investigationState={investigationState}
                    investigation={investigation}
                    audit={audit}
                    stageProgress={stageProgress}
                    errorMessage={investigationError}
                    onRunInvestigation={handleRunInvestigation}
                    onUpdateStatus={handleUpdateStatus}
                    onSubmitFeedback={handleSubmitFeedback}
                    statusUpdating={statusUpdating}
                    feedbackSuccess={feedbackSuccess}
                  />
                )}
              </div>
            )}

            {view === 'evaluation' && (
              <EvaluationView
                evaluation={evaluation}
                loading={evalLoading}
                onRefresh={handleRefreshEvaluation}
                onBackToOverview={() => setView('overview')}
              />
            )}

            {view === 'system' && (
              <SystemStatusView
                health={health}
                loading={healthLoading}
                onRefresh={handleRefreshHealth}
                onBackToOverview={() => setView('overview')}
              />
            )}
          </main>
        </div>
      )}

      {/* Controlled Scenario Simulation Modal */}
      <ScenarioInjectModal
        isOpen={injectModalOpen}
        onClose={() => setInjectModalOpen(false)}
        merchants={overview?.merchant_risks || []}
        onInject={handleInjectScenario}
        injecting={injecting}
      />
    </div>
  );
}
