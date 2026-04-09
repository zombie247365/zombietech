/**
 * Admin API client — calls the Express backend with admin JWT.
 * All calls pass the token from httpOnly cookie via Authorization header.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '/api';

export class ApiError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message);
    this.name = 'ApiError';
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function apiFetch<T = any>(path: string, opts: RequestInit & { token?: string } = {}): Promise<T> {
  const { token, ...rest } = opts;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(rest.headers as Record<string, string> ?? {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { credentials: 'include', ...rest, headers });
  const data = await res.json().catch(() => ({ success: false, error: res.statusText }));
  if (!res.ok) throw new ApiError(res.status, data.error ?? 'Unknown error', data.code);
  return data as T;
}

// Typed list/item wrappers
type L<T> = { success: boolean; data: T[]; meta?: { total: number; page: number; limit: number; pages: number } };
type I<T> = { success: boolean; data: T };

// ── API surface ───────────────────────────────────────────────────────────────
export const adminApi = {
  // Users
  users: {
    list: (token: string, params?: Record<string, string>) => {
      const qs = params ? '?' + new URLSearchParams(params) : '';
      return apiFetch<L<User>>(`/users${qs}`, { token });
    },
  },
  // Sites
  sites: {
    list: (token: string, params?: Record<string, string>) => {
      const qs = params ? '?' + new URLSearchParams(params) : '';
      return apiFetch<L<Site>>(`/sites${qs}`, { token });
    },
    get: (id: string, token: string) => apiFetch<I<Site>>(`/sites/${id}`, { token }),
    update: (id: string, data: Partial<Site>, token: string) =>
      apiFetch<I<Site>>(`/sites/${id}`, { method: 'PATCH', body: JSON.stringify(data), token }),
  },
  // Operators
  operators: {
    list: (token: string, params?: Record<string, string>) => {
      const qs = params ? '?' + new URLSearchParams(params) : '';
      return apiFetch<L<Operator>>(`/operators${qs}`, { token });
    },
    get: (id: string, token: string) => apiFetch<I<Operator>>(`/operators/${id}`, { token }),
    vetting: {
      list: (token: string) => apiFetch<L<VettingRecord>>('/operators/vetting', { token }),
      review: (operatorId: string, data: { status: string; notes?: string }, token: string) =>
        apiFetch<I<Operator>>(`/operators/${operatorId}/vetting`, { method: 'POST', body: JSON.stringify(data), token }),
    },
  },
  // Bookings
  bookings: {
    list: (token: string, params?: Record<string, string>) => {
      const qs = params ? '?' + new URLSearchParams(params) : '';
      return apiFetch<L<BookingRequest>>(`/bookings${qs}`, { token });
    },
  },
  // Contracts
  contracts: {
    list: (token: string, params?: Record<string, string>) => {
      const qs = params ? '?' + new URLSearchParams(params) : '';
      return apiFetch<L<Contract>>(`/contracts${qs}`, { token });
    },
    get: (id: string, token: string) => apiFetch<I<Contract>>(`/contracts/${id}`, { token }),
  },
  // Sessions
  sessions: {
    list: (token: string, params?: Record<string, string>) => {
      const qs = params ? '?' + new URLSearchParams(params) : '';
      return apiFetch<L<Session>>(`/sessions${qs}`, { token });
    },
    get: (id: string, token: string) => apiFetch<I<Session>>(`/sessions/${id}`, { token }),
  },
  // Settlements
  settlements: {
    list: (token: string, params?: Record<string, string>) => {
      const qs = params ? '?' + new URLSearchParams(params) : '';
      return apiFetch<L<Settlement>>(`/settlements${qs}`, { token });
    },
    get: (id: string, token: string) => apiFetch<I<Settlement>>(`/settlements/${id}`, { token }),
    calculate: (data: { operator_id: string; period_start: string; period_end: string }, token: string) =>
      apiFetch<I<Settlement>>('/settlements/calculate', { method: 'POST', body: JSON.stringify(data), token }),
    release: (id: string, ref: string | null, token: string) =>
      apiFetch<I<Settlement>>(`/settlements/${id}/release`, { method: 'POST', body: JSON.stringify({ payment_provider_ref: ref }), token }),
    autoRelease: (token: string) =>
      apiFetch<{ success: boolean; data: { released: number; ids: string[] } }>('/settlements/auto-release', { method: 'POST', token }),
  },
  // Disputes
  disputes: {
    list: (token: string, params?: Record<string, string>) => {
      const qs = params ? '?' + new URLSearchParams(params) : '';
      return apiFetch<L<Dispute>>(`/disputes${qs}`, { token });
    },
    get: (id: string, token: string) => apiFetch<I<Dispute>>(`/disputes/${id}`, { token }),
    resolve: (id: string, data: { admin_decision: string; awarded_amount_cents?: number }, token: string) =>
      apiFetch<I<Dispute>>(`/disputes/${id}/resolve`, { method: 'POST', body: JSON.stringify(data), token }),
  },
  // Documents
  documents: {
    list: (token: string, params?: Record<string, string>) => {
      const qs = params ? '?' + new URLSearchParams(params) : '';
      return apiFetch<L<Document>>(`/documents${qs}`, { token });
    },
  },
};

// ── Types ─────────────────────────────────────────────────────────────────────
export interface User {
  id: string; full_name: string; email: string; mobile: string; role: string; created_at: string;
}
export interface Site {
  id: string; trading_name: string; business_category: string;
  address_line1: string; suburb: string; city: string;
  monthly_rent_cents: string; monthly_utilities_cents: string;
  hourly_rate_cents: string; consent_status: string;
  site_score: number; score_tier: string; is_listed: boolean; created_at: string;
  site_owner_id: string; site_owner?: { user?: User };
}
export interface Operator {
  id: string; user_id: string; trading_concept: string; food_category: string;
  trust_score: number; vetting_status: string; activation_fee_balance: number;
  vetting_approved_at: string | null; created_at: string;
  user?: User;
}
export interface VettingRecord {
  id: string; operator_id: string; check_type: string; provider: string;
  result: string; confidence_score: string | null; flag_reason: string | null;
  requires_manual_review: boolean; reviewed_at: string | null; created_at: string;
}
export interface BookingRequest {
  id: string; site_slot_id: string; operator_id: string;
  concept_summary: string; requested_start_date: string; recurring: boolean;
  status: string; expires_at: string; created_at: string;
  site_slot?: { day_of_week: string; site?: Site };
  operator?: Operator;
}
export interface Contract {
  id: string; contract_ref: string; site_slot_id: string; operator_id: string;
  hourly_rate_cents: string; upside_model: string; upside_pct: string;
  platform_fee_pct: string; notice_period_days: number; status: string;
  site_owner_signed_at: string | null; operator_signed_at: string | null;
  terminated_at: string | null; created_at: string;
  site_slot?: { day_of_week: string; site?: Site };
  operator?: Operator;
}
export interface Session {
  id: string; session_ref: string; contract_id: string;
  session_date: string; scheduled_start: string; scheduled_end: string;
  actual_start: string | null; actual_end: string | null;
  gross_revenue_cents: string | null; status: string;
  before_photos_complete: boolean; after_photos_complete: boolean; lockup_complete: boolean;
  ai_handover_score: number | null; ai_flags_count: number | null;
  site_owner_confirmed_at: string | null; created_at: string;
  contract?: Contract;
}
export interface Settlement {
  id: string; settlement_ref: string; operator_id: string;
  period_start: string; period_end: string;
  gross_revenue_cents: string; platform_fee_cents: string;
  site_fees_cents: string; landlord_share_cents: string;
  penalty_deductions_cents: string; activation_deduction_cents: string;
  operator_payout_cents: string; status: string;
  released_at: string | null; payment_provider_ref: string | null;
  created_at: string;
  operator?: Operator;
  line_items?: Array<{ id: string; line_type: string; amount_cents: string; description: string }>;
}
export interface Dispute {
  id: string; dispute_ref: string; session_id: string; raised_by_user_id: string;
  claim_type: string; claim_amount_cents: string; description: string;
  ai_recommendation: string | null; ai_confidence: string | null; ai_reasoning: string | null;
  admin_decision: string | null; admin_decided_by: string | null;
  awarded_amount_cents: string | null; status: string;
  deadline_at: string; resolved_at: string | null; created_at: string;
  session?: Session; raised_by?: User;
}
export interface Document {
  id: string; owner_user_id: string; document_type: string;
  storage_key: string; file_name: string; mime_type: string;
  file_size_bytes: string; ai_parsed: boolean; ai_extracted_data: Record<string, unknown> | null;
  expires_at: string | null; created_at: string;
}
