/**
 * API client for the ZombieTech Express API.
 *
 * Server-side usage: pass the `token` cookie value as `authToken`.
 * Client-side usage: cookies are sent automatically via credentials.
 *
 * The Next.js rewrite in next.config.js proxies /api/* → Express :4000/api/*
 * so all fetch calls use /api/* (relative, no CORS issues).
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '/api';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type FetchOptions = RequestInit & { token?: string };

async function apiFetch<T>(path: string, opts: FetchOptions = {}): Promise<T> {
  const { token, ...rest } = opts;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(rest.headers as Record<string, string> ?? {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    ...rest,
    headers,
  });

  const data = await res.json().catch(() => ({ success: false, error: res.statusText }));

  if (!res.ok) {
    throw new ApiError(res.status, data.error ?? 'Unknown error', data.code);
  }
  return data as T;
}

// ── Auth ──────────────────────────────────────────────────────────────────────
export const api = {
  auth: {
    requestOtp: (mobile: string) =>
      apiFetch<{ success: true; data: { is_registered: boolean; dev_otp?: string } }>('/auth/request-otp', {
        method: 'POST',
        body: JSON.stringify({ mobile }),
      }),
    verifyOtp: (mobile: string, otp: string, registration?: { full_name: string; email: string; role: string }) =>
      apiFetch<{ success: true; data: { token: string; user: User } }>('/auth/verify-otp', {
        method: 'POST',
        body: JSON.stringify({ mobile, otp, ...registration }),
      }),
  },

  // ── Sites ────────────────────────────────────────────────────────────────
  sites: {
    list: (token: string) =>
      apiFetch<ListResponse<Site>>('/sites', { token }),
    get: (id: string, token: string) =>
      apiFetch<ItemResponse<Site>>(`/sites/${id}`, { token }),
    create: (data: Partial<Site>, token: string) =>
      apiFetch<ItemResponse<Site>>('/sites', { method: 'POST', body: JSON.stringify(data), token }),
    update: (id: string, data: Partial<Site>, token: string) =>
      apiFetch<ItemResponse<Site>>(`/sites/${id}`, { method: 'PATCH', body: JSON.stringify(data), token }),

    slots: {
      list: (siteId: string, token: string) =>
        apiFetch<ListResponse<SiteSlot>>(`/sites/${siteId}/slots`, { token }),
      create: (siteId: string, data: Partial<SiteSlot>, token: string) =>
        apiFetch<ItemResponse<SiteSlot>>(`/sites/${siteId}/slots`, { method: 'POST', body: JSON.stringify(data), token }),
      update: (siteId: string, slotId: string, data: Partial<SiteSlot>, token: string) =>
        apiFetch<ItemResponse<SiteSlot>>(`/sites/${siteId}/slots/${slotId}`, { method: 'PATCH', body: JSON.stringify(data), token }),
      delete: (siteId: string, slotId: string, token: string) =>
        apiFetch<{ success: true }>(`/sites/${siteId}/slots/${slotId}`, { method: 'DELETE', token }),
    },

    checklist: {
      list: (siteId: string, token: string) =>
        apiFetch<ListResponse<ChecklistItem>>(`/sites/${siteId}/checklist`, { token }),
      create: (siteId: string, data: Partial<ChecklistItem>, token: string) =>
        apiFetch<ItemResponse<ChecklistItem>>(`/sites/${siteId}/checklist`, { method: 'POST', body: JSON.stringify(data), token }),
      update: (siteId: string, itemId: string, data: Partial<ChecklistItem>, token: string) =>
        apiFetch<ItemResponse<ChecklistItem>>(`/sites/${siteId}/checklist/${itemId}`, { method: 'PATCH', body: JSON.stringify(data), token }),
      delete: (siteId: string, itemId: string, token: string) =>
        apiFetch<{ success: true }>(`/sites/${siteId}/checklist/${itemId}`, { method: 'DELETE', token }),
    },
  },

  // ── Bookings ──────────────────────────────────────────────────────────────
  bookings: {
    list: (token: string, params?: Record<string, string>) => {
      const qs = params ? '?' + new URLSearchParams(params).toString() : '';
      return apiFetch<ListResponse<BookingRequest>>(`/bookings${qs}`, { token });
    },
    get: (id: string, token: string) =>
      apiFetch<ItemResponse<BookingRequest>>(`/bookings/${id}`, { token }),
    approve: (id: string, token: string) =>
      apiFetch<ItemResponse<BookingRequest>>(`/bookings/${id}/approve`, { method: 'POST', token }),
    decline: (id: string, reason: string, token: string) =>
      apiFetch<ItemResponse<BookingRequest>>(`/bookings/${id}/decline`, {
        method: 'POST', body: JSON.stringify({ reason }), token,
      }),
  },

  // ── Contracts ─────────────────────────────────────────────────────────────
  contracts: {
    list: (token: string, params?: Record<string, string>) => {
      const qs = params ? '?' + new URLSearchParams(params).toString() : '';
      return apiFetch<ListResponse<Contract>>(`/contracts${qs}`, { token });
    },
    get: (id: string, token: string) =>
      apiFetch<ItemResponse<Contract>>(`/contracts/${id}`, { token }),
  },

  // ── Sessions ──────────────────────────────────────────────────────────────
  sessions: {
    list: (token: string, params?: Record<string, string>) => {
      const qs = params ? '?' + new URLSearchParams(params).toString() : '';
      return apiFetch<ListResponse<Session>>(`/sessions${qs}`, { token });
    },
    get: (id: string, token: string) =>
      apiFetch<ItemResponse<Session>>(`/sessions/${id}`, { token }),
    checklist: (id: string, token: string) =>
      apiFetch<ItemResponse<unknown>>(`/sessions/${id}/checklist`, { token }),
    photos: (id: string, token: string) =>
      apiFetch<ListResponse<unknown>>(`/sessions/${id}/photos`, { token }),
  },

  // ── Settlements ───────────────────────────────────────────────────────────
  settlements: {
    list: (token: string, params?: Record<string, string>) => {
      const qs = params ? '?' + new URLSearchParams(params).toString() : '';
      return apiFetch<ListResponse<Settlement>>(`/settlements${qs}`, { token });
    },
    get: (id: string, token: string) =>
      apiFetch<ItemResponse<Settlement>>(`/settlements/${id}`, { token }),
  },

  // ── Disputes ──────────────────────────────────────────────────────────────
  disputes: {
    list: (token: string) =>
      apiFetch<ListResponse<Dispute>>('/disputes', { token }),
    create: (data: { session_id: string; claim_type: string; claim_amount_cents: number; description: string }, token: string) =>
      apiFetch<ItemResponse<Dispute>>('/disputes', { method: 'POST', body: JSON.stringify(data), token }),
  },

  // ── Documents ─────────────────────────────────────────────────────────────
  documents: {
    upload: (formData: FormData, token: string) =>
      fetch(`${API_BASE}/documents`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
        credentials: 'include',
      }).then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new ApiError(r.status, d.error, d.code);
        return d;
      }),
  },
};

// ── Shared types (minimal, for UI) ───────────────────────────────────────────
export interface User {
  id: string;
  full_name: string;
  email: string;
  mobile: string;
  role: string;
}

export interface Site {
  id: string;
  trading_name: string;
  business_category: string;
  address_line1: string;
  suburb: string;
  city: string;
  latitude: string;
  longitude: string;
  site_opens_time: string;
  site_closes_time: string;
  zombie_end_time: string;
  monthly_rent_cents: string;
  monthly_utilities_cents: string;
  site_operating_hours_per_month: number;
  hourly_rate_cents: string;
  consent_status: string;
  site_score: number;
  score_tier: string;
  is_listed: boolean;
  created_at: string;
  site_slots?: SiteSlot[];
  site_checklist_items?: ChecklistItem[];
}

export interface SiteSlot {
  id: string;
  site_id: string;
  day_of_week: string;
  is_closed_day: boolean;
  slot_start_time: string;
  slot_end_time: string;
  slot_hours: string;
  base_fee_cents_per_session: string;
  upside_model: string;
  upside_fixed_pct: string | null;
  upside_variable_pct: string | null;
  status: string;
}

export interface ChecklistItem {
  id: string;
  site_id: string;
  area_name: string;
  area_category: string;
  sort_order: number;
  is_required: boolean;
  description: string;
}

export interface BookingRequest {
  id: string;
  site_slot_id: string;
  operator_id: string;
  concept_summary: string;
  requested_start_date: string;
  recurring: boolean;
  status: string;
  expires_at: string;
  created_at: string;
  site_slot?: SiteSlot & { site?: Site };
  operator?: { id: string; trading_concept: string; trust_score: number; user?: User };
}

export interface Contract {
  id: string;
  contract_ref: string;
  site_slot_id: string;
  operator_id: string;
  hourly_rate_cents: string;
  upside_model: string;
  upside_pct: string;
  platform_fee_pct: string;
  notice_period_days: number;
  status: string;
  site_owner_signed_at: string | null;
  operator_signed_at: string | null;
  created_at: string;
  site_slot?: SiteSlot & { site?: Site };
  operator?: { id: string; trading_concept: string; trust_score: number; user?: User };
}

export interface Session {
  id: string;
  session_ref: string;
  contract_id: string;
  session_date: string;
  scheduled_start: string;
  scheduled_end: string;
  actual_start: string | null;
  actual_end: string | null;
  gross_revenue_cents: string | null;
  status: string;
  before_photos_complete: boolean;
  after_photos_complete: boolean;
  lockup_complete: boolean;
  ai_handover_score: number | null;
  ai_flags_count: number | null;
  site_owner_confirmed_at: string | null;
  site_owner_confirmed_good_order: boolean | null;
  created_at: string;
  contract?: Contract;
}

export interface Settlement {
  id: string;
  settlement_ref: string;
  operator_id: string;
  period_start: string;
  period_end: string;
  gross_revenue_cents: string;
  platform_fee_cents: string;
  site_fees_cents: string;
  landlord_share_cents: string;
  penalty_deductions_cents: string;
  activation_deduction_cents: string;
  operator_payout_cents: string;
  status: string;
  released_at: string | null;
  created_at: string;
  line_items?: SettlementLineItem[];
}

export interface SettlementLineItem {
  id: string;
  line_type: string;
  amount_cents: string;
  description: string;
}

export interface Dispute {
  id: string;
  dispute_ref: string;
  session_id: string;
  claim_type: string;
  claim_amount_cents: string;
  description: string;
  ai_recommendation: string | null;
  ai_confidence: string | null;
  admin_decision: string | null;
  awarded_amount_cents: string | null;
  status: string;
  deadline_at: string;
  created_at: string;
}

interface ListResponse<T> {
  success: boolean;
  data: T[];
  meta?: { total: number; page: number; limit: number; pages: number };
}

interface ItemResponse<T> {
  success: boolean;
  data: T;
}
