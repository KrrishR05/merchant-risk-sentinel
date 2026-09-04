/**
 * RiskSūtra — API Client
 * Typed API client for the FastAPI backend.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface Merchant {
  merchant_id: string;
  merchant_name: string;
  merchant_type: string;
  country: string;
  created_at: string;
  profile_metadata: Record<string, unknown>;
}

export interface MerchantEvent {
  event_id: string;
  merchant_id: string;
  timestamp: string;
  event_type: string;
  device_id: string | null;
  session_id: string | null;
  ip_address: string | null;
  country: string | null;
  asn: string | null;
  transaction_id: string | null;
  amount: number | null;
  currency: string | null;
  payment_method: string | null;
  endpoint: string | null;
  api_key_id: string | null;
  action: string | null;
  resource: string | null;
  metadata: Record<string, unknown>;
}

export interface RiskSignal {
  signal_id: string;
  merchant_id: string;
  timestamp: string;
  signal_type: string;
  value: number;
  severity: string;
  source: string;
  evidence_event_ids: string[];
}

export interface RiskAssessment {
  merchant_id: string;
  risk_score: number;
  risk_band: string;
  top_signals: RiskSignal[];
  evidence_event_ids: string[];
  model_version: string;
  assessed_at: string;
}

export interface Incident {
  incident_id: string;
  merchant_id: string;
  created_at: string;
  status: string;
  incident_type: string;
  risk_score: number;
  risk_band: string;
  signal_ids: string[];
  evidence_event_ids: string[];
  evidence_version?: number;
  summary: string;
}

export interface MerchantProfile {
  merchant_id: string;
  typical_hours: Record<string, number>;
  known_devices: string[];
  known_countries: string[];
  known_asns: string[];
  api_rate_baseline: { mean: number; std: number; total: number };
  transaction_rate_baseline: { mean: number; std: number; total: number };
  amount_statistics: Record<string, number>;
  event_frequency: Record<string, number>;
  sensitive_action_count: number;
  total_events: number;
  baseline_window_start: string | null;
  baseline_window_end: string | null;
}

export interface MerchantRisk {
  merchant_id: string;
  merchant_name: string;
  merchant_type: string;
  risk_score: number;
  risk_band: string;
}

export interface Overview {
  total_merchants: number;
  total_incidents: number;
  active_incidents: number;
  merchant_risks: MerchantRisk[];
  recent_events: MerchantEvent[];
  risk_distribution: Record<string, number>;
}

export interface ScenarioResult {
  status: string;
  scenario: {
    scenario_id: string;
    scenario_type: string;
    merchant_id: string;
    attack_start_time: string;
    attack_end_time: string;
    injected_event_ids: string[];
    label: string;
  };
  events_injected: number;
  risk_assessment: RiskAssessment | null;
  incident_created: Incident | null;
  incident_id?: string;
}

// Day 3: AI Investigator Interfaces

export interface AttackStage {
  stage: string;
  event_ids: string[];
  explanation: string;
}

export interface KeyEvidenceItem {
  event_id: string;
  signal: string;
  severity: string;
  reason: string;
}

export interface LegitimateExplanation {
  hypothesis: string;
  supporting_evidence: string[];
  counter_evidence: string[];
  status: 'SUPPORTED' | 'WEAK' | 'REJECTED';
}

export interface HistoricalMatch {
  incident_id: string;
  merchant_id: string;
  similarity_percentage: number;
  outcome: string;
  pattern: string;
  resolution: string;
  relevance_notes: string;
}

export interface LearningIntelligence {
  historical_cases_analyzed: number;
  similar_patterns_found: number;
  confirmed_ato_matches: number;
  legitimate_matches: number;
  pattern_confidence: number;
  knowledge_sources_used: string[];
}

export interface AIInvestigationResult {
  incident_id: string;
  merchant_id?: string;
  run_id?: string;
  assessment: 'LIKELY_ATO' | 'SUSPICIOUS' | 'INCONCLUSIVE' | 'LIKELY_BENIGN';
  confidence: number;
  summary: string;
  executive_summary?: string;
  what_happened?: string;
  why_this_matters: string;
  why_it_matters?: string;
  root_cause_hypotheses?: string[];
  attack_progression: AttackStage[];
  key_evidence: KeyEvidenceItem[];
  behavioral_deviation: {
    summary: string;
    deviations: string[];
  };
  workflow_assessment: {
    matched_pattern: string;
    transition_anomalies: string[];
    assessment: string;
  };
  legitimate_explanations_considered: LegitimateExplanation[];
  contradictions_or_uncertainty: string[];
  historical_matches?: HistoricalMatch[];
  historical_pattern_summary?: string;
  learning_intelligence?: LearningIntelligence;
  recommended_defensive_actions: string[];
  immediate_actions?: string[];
  containment_actions?: string[];
  recovery_actions?: string[];
  resolution_conditions?: string[];
  estimated_resolution_window?: string;
  monitoring_requirements?: string[];
  analyst_questions?: string[];
  risk_score_reference: number;
  risk_score_source: string;
  evidence_version?: number;
  model_version: string;
  investigator_version: string;
  evidence_event_ids: string[];
  generated_at: string;
}

export interface InvestigationAuditRecord {
  audit_id: string;
  incident_id: string;
  merchant_id: string;
  investigator_version: string;
  provider: string;
  model_name: string;
  start_time: string;
  end_time: string;
  duration_ms: number;
  tools_called: string[];
  evidence_count: number;
  assessment: string;
  confidence: number;
  is_fallback: boolean;
  error_message: string | null;
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`API Error ${res.status}: ${errorText}`);
  }
  return res.json();
}

export interface InvestigationStageEvent {
  stage_index?: number;
  stage_key?: string;
  label?: string;
  status?: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'DONE' | 'ERROR';
  detail?: string;
}

export const api = {
  getHealth: () => apiFetch<{ status: string; database: string }>('/health'),
  getOverview: () => apiFetch<Overview>('/overview'),
  getMerchants: () => apiFetch<{ merchants: Merchant[] }>('/merchants'),
  getMerchant: (id: string) => apiFetch<Merchant>(`/merchants/${id}`),
  getMerchantRisk: (id: string) => apiFetch<RiskAssessment>(`/merchants/${id}/risk`),
  getMerchantProfile: (id: string) => apiFetch<MerchantProfile>(`/merchants/${id}/profile`),
  getMerchantEvents: (id: string, limit = 50) =>
    apiFetch<{ events: MerchantEvent[] }>(`/merchants/${id}/events?limit=${limit}`),
  getIncidents: (limit = 200) => apiFetch<{ incidents: Incident[] }>(`/incidents?limit=${limit}`),
  getIncident: (id: string) => apiFetch<Incident>(`/incidents/${id}`),
  injectScenario: (merchantId: string, scenarioType: string) =>
    apiFetch<ScenarioResult>('/scenarios/inject', {
      method: 'POST',
      body: JSON.stringify({ merchant_id: merchantId, scenario_type: scenarioType }),
    }),
  // Incident Lifecycle & Learning Loop APIs
  updateIncidentStatus: (incidentId: string, status: string, notes?: string) =>
    apiFetch<{ incident_id: string; status: string; updated: boolean }>(`/incidents/${incidentId}/status`, {
      method: 'POST',
      body: JSON.stringify({ status, notes }),
    }),
  submitAnalystFeedback: (incidentId: string, outcome: string, notes?: string, analystId = 'analyst-1') =>
    apiFetch<{ incident_id: string; feedback_recorded: boolean }>(`/incidents/${incidentId}/feedback`, {
      method: 'POST',
      body: JSON.stringify({ outcome, notes, analyst_id: analystId }),
    }),
  getCaseMemory: (excludeIncidentId?: string) =>
    apiFetch<{ case_memories: unknown[]; count: number }>(`/cases/memory${excludeIncidentId ? `?exclude_incident_id=${excludeIncidentId}` : ''}`),
  // AI Investigator APIs
  investigateIncident: (incidentId: string) =>
    apiFetch<{ incident_id: string; investigation: AIInvestigationResult; audit: InvestigationAuditRecord }>(
      `/incidents/${incidentId}/investigate`,
      { method: 'POST' }
    ),
  getInvestigation: (incidentId: string) =>
    apiFetch<AIInvestigationResult>(`/incidents/${incidentId}/investigation`),
  getInvestigationAudit: (incidentId: string) =>
    apiFetch<InvestigationAuditRecord>(`/incidents/${incidentId}/investigation/audit`),
  streamInvestigation: (
    incidentId: string,
    onStage: (event: InvestigationStageEvent) => void,
    onComplete: (data: { investigation: AIInvestigationResult; audit: InvestigationAuditRecord }) => void,
    onError: (err: Error) => void
  ) => {
    const url = `${API_BASE}/incidents/${incidentId}/investigate/stream`;
    fetch(url, { method: 'POST' })
      .then(response => {
        if (!response.ok) throw new Error(`HTTP error ${response.status}`);
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        function read() {
          reader?.read().then(({ done, value }) => {
            if (done) return;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              const trimmed = line.trim();
              if (trimmed.startsWith('data: ')) {
                try {
                  const data = JSON.parse(trimmed.slice(6));
                  if (data.status === 'DONE') {
                    onComplete({ investigation: data.investigation, audit: data.audit });
                  } else if (data.status === 'ERROR') {
                    onError(new Error(data.error || 'Stream error'));
                  } else {
                    onStage(data);
                  }
                } catch (e) {
                  console.error('Failed to parse SSE line:', e);
                }
              }
            }
            read();
          }).catch(onError);
        }
        read();
      })
      .catch(onError);
  },
};

