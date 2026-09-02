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

export const api = {
  getHealth: () => apiFetch<{ status: string; database: string }>('/health'),
  getOverview: () => apiFetch<Overview>('/overview'),
  getMerchants: () => apiFetch<{ merchants: Merchant[] }>('/merchants'),
  getMerchant: (id: string) => apiFetch<Merchant>(`/merchants/${id}`),
  getMerchantRisk: (id: string) => apiFetch<RiskAssessment>(`/merchants/${id}/risk`),
  getMerchantProfile: (id: string) => apiFetch<MerchantProfile>(`/merchants/${id}/profile`),
  getMerchantEvents: (id: string, limit = 50) =>
    apiFetch<{ events: MerchantEvent[] }>(`/merchants/${id}/events?limit=${limit}`),
  getIncidents: (limit = 50) => apiFetch<{ incidents: Incident[] }>(`/incidents?limit=${limit}`),
  getIncident: (id: string) => apiFetch<Incident>(`/incidents/${id}`),
  injectScenario: (merchantId: string, scenarioType: string) =>
    apiFetch<ScenarioResult>('/scenarios/inject', {
      method: 'POST',
      body: JSON.stringify({ merchant_id: merchantId, scenario_type: scenarioType }),
    }),
};
