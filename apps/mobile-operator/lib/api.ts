import { getToken } from './storage';

const API_BASE = 'http://localhost:4000/api';

export class ApiError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function req<T = unknown>(
  path: string,
  opts: RequestInit & { auth?: boolean; token?: string } = {}
): Promise<T> {
  const { auth = true, token: providedToken, ...rest } = opts;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  if (auth) {
    const t = providedToken ?? (await getToken());
    if (t) headers['Authorization'] = `Bearer ${t}`;
  }

  const res = await fetch(`${API_BASE}${path}`, { ...rest, headers });
  const data = await res.json().catch(() => ({ success: false, error: res.statusText }));
  if (!res.ok) throw new ApiError(res.status, data.error ?? 'Request failed', data.code);
  return data as T;
}

// Types
export interface User {
  id: string; full_name: string; email: string; mobile: string; role: string;
}
export interface Operator {
  id: string; user_id: string; trading_concept: string; food_category: string;
  trust_score: number; vetting_status: string; activation_fee_balance: number;
  vetting_approved_at: string | null; created_at: string; user?: User;
}
export interface SiteSlot {
  id: string; day_of_week: string; slot_start_time: string; slot_end_time: string;
  slot_hours: string; base_fee_cents_per_session: string;
  upside_model: string; upside_fixed_pct: string | null; upside_variable_pct: string | null;
  status: string;
}
export interface Site {
  id: string; trading_name: string; business_category: string;
  address_line1: string; suburb: string; city: string;
  latitude: string; longitude: string;
  site_opens_time: string; site_closes_time: string; zombie_end_time: string;
  monthly_rent_cents: string; monthly_utilities_cents: string; hourly_rate_cents: string;
  consent_status: string; site_score: number; score_tier: string;
  is_listed: boolean; created_at: string;
  site_slots?: SiteSlot[];
}
export interface BookingRequest {
  id: string; site_slot_id: string; operator_id: string;
  concept_summary: string; requested_start_date: string; recurring: boolean;
  status: string; expires_at: string; created_at: string;
  site_slot?: SiteSlot & { site?: Site };
}
export interface Contract {
  id: string; contract_ref: string; site_slot_id: string; operator_id: string;
  hourly_rate_cents: string; upside_model: string; upside_pct: string;
  platform_fee_pct: string; notice_period_days: number; status: string;
  site_owner_signed_at: string | null; operator_signed_at: string | null;
  terminated_at: string | null; created_at: string;
  site_slot?: SiteSlot & { site?: Site };
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
export interface ChecklistItem {
  id: string; area_name: string; area_category: string;
  sort_order: number; is_required: boolean; description: string;
}
export interface SessionPhoto {
  id: string; session_id: string; checklist_item_id: string;
  photo_type: string; storage_url: string;
  latitude: string; longitude: string; server_timestamp: string;
}
export interface Settlement {
  id: string; settlement_ref: string; operator_id: string;
  period_start: string; period_end: string;
  gross_revenue_cents: string; platform_fee_cents: string;
  site_fees_cents: string; landlord_share_cents: string;
  penalty_deductions_cents: string; activation_deduction_cents: string;
  operator_payout_cents: string; status: string;
  released_at: string | null; created_at: string;
  line_items?: Array<{ id: string; line_type: string; amount_cents: string; description: string }>;
}

type L<T> = { success: boolean; data: T[] };
type I<T> = { success: boolean; data: T };

export const api = {
  auth: {
    requestOtp: (mobile: string) =>
      req<{ success: boolean }>('/auth/request-otp', {
        method: 'POST', body: JSON.stringify({ mobile }), auth: false,
      }),
    verifyOtp: (mobile: string, otp: string) =>
      req<I<{ token: string; user: User }>>('/auth/verify-otp', {
        method: 'POST', body: JSON.stringify({ mobile, otp }), auth: false,
      }),
    register: (data: { mobile: string; full_name: string; email: string }) =>
      req<{ success: boolean }>('/auth/register', {
        method: 'POST', body: JSON.stringify(data), auth: false,
      }),
  },
  operator: {
    me: () => req<I<Operator>>('/operators/me'),
    create: (data: { trading_concept: string; food_category: string; emergency_contact_name: string; emergency_contact_mobile: string }) =>
      req<I<Operator>>('/operators', { method: 'POST', body: JSON.stringify(data) }),
  },
  sites: {
    list: (params?: Record<string, string>) => {
      const qs = params ? '?' + new URLSearchParams(params) : '';
      return req<L<Site>>(`/sites${qs}`, { auth: false });
    },
    get: (id: string) => req<I<Site>>(`/sites/${id}`, { auth: false }),
  },
  bookings: {
    create: (data: { site_slot_id: string; concept_summary: string; requested_start_date: string; recurring: boolean }) =>
      req<I<BookingRequest>>('/bookings', { method: 'POST', body: JSON.stringify(data) }),
    list: () => req<L<BookingRequest>>('/bookings/my'),
    get: (id: string) => req<I<BookingRequest>>(`/bookings/${id}`),
  },
  contracts: {
    list: () => req<L<Contract>>('/contracts/my'),
    get: (id: string) => req<I<Contract>>(`/contracts/${id}`),
    sign: (id: string, otp: string) =>
      req<I<Contract>>(`/contracts/${id}/sign`, { method: 'POST', body: JSON.stringify({ otp }) }),
  },
  sessions: {
    list: () => req<L<Session>>('/sessions/my'),
    get: (id: string) => req<I<Session>>(`/sessions/${id}`),
    handoverSign: (id: string, otp: string) =>
      req<I<Session>>(`/sessions/${id}/handover-sign`, { method: 'POST', body: JSON.stringify({ otp }) }),
    checklist: (id: string) => req<L<ChecklistItem>>(`/sessions/${id}/checklist`),
    photos: (id: string) => req<L<SessionPhoto>>(`/sessions/${id}/photos`),
    uploadPhoto: (id: string, formData: FormData) =>
      req<I<SessionPhoto>>(`/sessions/${id}/photos`, {
        method: 'POST',
        body: formData,
        // override content-type so fetch sets multipart boundary
      }),
    closeSession: (id: string, grossRevenueCents: number) =>
      req<I<Session>>(`/sessions/${id}/close`, {
        method: 'POST', body: JSON.stringify({ gross_revenue_cents: grossRevenueCents }),
      }),
  },
  settlements: {
    list: () => req<L<Settlement>>('/settlements/my'),
    get: (id: string) => req<I<Settlement>>(`/settlements/${id}`),
  },
  documents: {
    upload: (formData: FormData) =>
      req<I<{ id: string }>>('/documents', { method: 'POST', body: formData }),
  },
};
