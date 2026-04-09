import {
  UserRole, ScoreTier, VettingStatus, ConsentStatus, DayOfWeek, UpsideModel,
  SiteSlotStatus, AreaCategory, BookingRequestStatus, ContractStatus, TerminatedBy,
  SessionStatus, PhotoType, AiResult, AdminOverride, SettlementStatus, LineType,
  DisputeStatus, ClaimType, AiRecommendation, DocumentType, CheckType, VettingResult,
  TrustScoreEventType, NotificationType, NotificationChannel, NotificationStatus,
  LandlordPartnerStatus,
} from './enums';

export interface User {
  id: string;
  email: string;
  mobile: string;
  full_name: string;
  role: UserRole;
  otp_hash: string | null;
  otp_expires_at: Date | null;
  email_verified_at: Date | null;
  mobile_verified_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface SiteOwner {
  id: string;
  user_id: string;
  trading_name: string;
  business_category: string;
  company_reg_number: string | null;
  vat_number: string | null;
  bank_account_ref: string | null;
  payout_verified_at: Date | null;
  site_score: number;
  score_tier: ScoreTier;
  created_at: Date;
}

export interface Operator {
  id: string;
  user_id: string;
  trading_concept: string;
  food_category: string;
  emergency_contact_name: string;
  emergency_contact_mobile: string;
  bank_account_ref: string | null;
  payout_verified_at: Date | null;
  trust_score: number;
  activation_fee_balance: number;
  vetting_status: VettingStatus;
  vetting_approved_at: Date | null;
  created_at: Date;
}

export interface Site {
  id: string;
  site_owner_id: string;
  landlord_partner_id: string | null;
  trading_name: string;
  business_category: string;
  address_line1: string;
  suburb: string;
  city: string;
  latitude: number;
  longitude: number;
  site_opens_time: string;
  site_closes_time: string;
  zombie_end_time: string;
  monthly_rent_cents: bigint;
  monthly_utilities_cents: bigint;
  site_operating_hours_per_month: number;
  hourly_rate_cents: bigint;
  consent_status: ConsentStatus;
  site_score: number;
  score_tier: ScoreTier;
  is_listed: boolean;
  created_at: Date;
}

export interface SiteSlot {
  id: string;
  site_id: string;
  day_of_week: DayOfWeek | null;
  is_closed_day: boolean;
  slot_start_time: string;
  slot_end_time: string;
  slot_hours: number;
  base_fee_cents_per_session: bigint;
  upside_model: UpsideModel;
  upside_fixed_pct: number | null;
  upside_variable_pct: number | null;
  status: SiteSlotStatus;
  created_at: Date;
}

export interface SiteChecklistItem {
  id: string;
  site_id: string;
  area_name: string;
  area_category: AreaCategory;
  sort_order: number;
  is_required: boolean;
  description: string;
  created_at: Date;
}

export interface Contract {
  id: string;
  contract_ref: string;
  site_slot_id: string;
  operator_id: string;
  booking_request_id: string;
  hourly_rate_cents: bigint;
  upside_model: UpsideModel;
  upside_pct: number;
  platform_fee_pct: number;
  notice_period_days: number;
  goodwill_threshold_sessions: number;
  goodwill_fee_pct: number;
  deactivation_fee_pct: number;
  status: ContractStatus;
  site_owner_signed_at: Date | null;
  operator_signed_at: Date | null;
  terminated_at: Date | null;
  terminated_by: TerminatedBy | null;
  created_at: Date;
}

export interface Session {
  id: string;
  session_ref: string;
  contract_id: string;
  session_date: Date;
  scheduled_start: Date;
  scheduled_end: Date;
  actual_start: Date | null;
  actual_end: Date | null;
  site_owner_handover_signed_at: Date | null;
  operator_handover_signed_at: Date | null;
  gross_revenue_cents: bigint;
  status: SessionStatus;
  before_photos_complete: boolean;
  after_photos_complete: boolean;
  lockup_complete: boolean;
  ai_handover_score: number | null;
  ai_flags_count: number | null;
  site_owner_confirmed_at: Date | null;
  site_owner_confirmed_good_order: boolean | null;
  created_at: Date;
}

// API response wrapper
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// Auth types
export interface JwtPayload {
  sub: string;       // user id
  role: UserRole;
  email: string;
  iat?: number;
  exp?: number;
}

export interface OtpRequest {
  mobile?: string;
  email?: string;
}

export interface OtpVerify {
  mobile?: string;
  email?: string;
  otp: string;
}

export interface AuthResponse {
  token: string;
  user: Pick<User, 'id' | 'email' | 'mobile' | 'full_name' | 'role'>;
}
