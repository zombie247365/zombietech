// Platform constants
export const PLATFORM_FEE_PCT = 10.00;
export const ACTIVATION_FEE_CENTS = 80000; // R800
export const ACTIVATION_FEE_PER_SESSION_CENTS = 40000; // R400 per session deduction
export const DEFAULT_NOTICE_PERIOD_DAYS = 30;
export const GOODWILL_THRESHOLD_SESSIONS = 6;
export const GOODWILL_FEE_PCT = 8.00;
export const DEACTIVATION_FEE_PCT = 15.00;
export const CLEAN_HANDOVER_RATE_THRESHOLD = 0.80; // 80%

// Settlement
export const SETTLEMENT_AUTO_RELEASE_DAY = 1; // Monday
export const SETTLEMENT_AUTO_RELEASE_HOUR = 12; // 12:00

// OTP
export const OTP_EXPIRES_MINUTES = 10;
export const OTP_LENGTH = 6;

// South Africa
export const DEFAULT_TIMEZONE = 'Africa/Johannesburg';
export const DEFAULT_CURRENCY = 'ZAR';
export const DEFAULT_CURRENCY_SYMBOL = 'R';
export const PHONE_COUNTRY_CODE = '+27';
export const SA_ID_LENGTH = 13;
export const VAT_THRESHOLD_CENTS = 100_000_000; // R1,000,000 in cents

// Pagination
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

// Scoring
export const MIN_SCORE = 0;
export const MAX_SCORE = 100;
export const SILVER_TIER_THRESHOLD = 40;
export const GOLD_TIER_THRESHOLD = 65;
export const PLATINUM_TIER_THRESHOLD = 85;

// Trust score deltas
export const TRUST_SCORE_CLEAN_SESSION = 2;
export const TRUST_SCORE_PENALTY_CLAIM = -5;
export const TRUST_SCORE_BREACH = -15;
export const TRUST_SCORE_DISPUTE_WON = 3;
export const TRUST_SCORE_DISPUTE_LOST = -8;
