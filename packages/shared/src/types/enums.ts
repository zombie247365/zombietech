// User roles
export enum UserRole {
  SITE_OWNER = 'site_owner',
  OPERATOR = 'operator',
  ADMIN = 'admin',
}

// Score tiers
export enum ScoreTier {
  STANDARD = 'standard',
  SILVER = 'silver',
  GOLD = 'gold',
  PLATINUM = 'platinum',
}

// Vetting status
export enum VettingStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  SUSPENDED = 'suspended',
}

// Consent status
export enum ConsentStatus {
  PENDING = 'pending',
  UPLOADED = 'uploaded',
  LANDLORD_VERIFIED = 'landlord_verified',
}

// Day of week
export enum DayOfWeek {
  MON = 'mon',
  TUE = 'tue',
  WED = 'wed',
  THU = 'thu',
  FRI = 'fri',
  SAT = 'sat',
  SUN = 'sun',
}

// Upside model
export enum UpsideModel {
  FIXED = 'fixed',
  VARIABLE = 'variable',
}

// Site slot status
export enum SiteSlotStatus {
  OPEN = 'open',
  BOOKED = 'booked',
  SUSPENDED = 'suspended',
}

// Area category
export enum AreaCategory {
  KITCHEN = 'kitchen',
  EQUIPMENT = 'equipment',
  SECURITY = 'security',
  CUSTOM = 'custom',
}

// Booking request status
export enum BookingRequestStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  DECLINED = 'declined',
  EXPIRED = 'expired',
}

// Contract status
export enum ContractStatus {
  ACTIVE = 'active',
  IN_NOTICE = 'in_notice',
  TERMINATED = 'terminated',
  EXPIRED = 'expired',
}

// Terminated by
export enum TerminatedBy {
  SITE_OWNER = 'site_owner',
  OPERATOR = 'operator',
  MUTUAL = 'mutual',
  BREACH = 'breach',
}

// Session status
export enum SessionStatus {
  SCHEDULED = 'scheduled',
  ACTIVE = 'active',
  COMPLETED = 'completed',
  DISPUTED = 'disputed',
  CANCELLED = 'cancelled',
}

// Photo type
export enum PhotoType {
  BEFORE = 'before',
  AFTER = 'after',
  LOCKUP = 'lockup',
}

// AI result
export enum AiResult {
  CLEAN = 'clean',
  FLAGGED = 'flagged',
  INCONCLUSIVE = 'inconclusive',
}

// Admin override
export enum AdminOverride {
  CLEAN = 'clean',
  FLAGGED = 'flagged',
}

// Settlement status
export enum SettlementStatus {
  PENDING = 'pending',
  READY = 'ready',
  RELEASED = 'released',
  HELD = 'held',
  FAILED = 'failed',
}

// Settlement line type
export enum LineType {
  REVENUE = 'revenue',
  PLATFORM_FEE = 'platform_fee',
  SITE_FEE = 'site_fee',
  LANDLORD_SHARE = 'landlord_share',
  PENALTY = 'penalty',
  ACTIVATION = 'activation',
}

// Dispute status
export enum DisputeStatus {
  OPEN = 'open',
  UNDER_REVIEW = 'under_review',
  RESOLVED = 'resolved',
  ESCALATED = 'escalated',
}

// Claim type
export enum ClaimType {
  DAMAGE = 'damage',
  CLEANING = 'cleaning',
  THEFT = 'theft',
  BREACH = 'breach',
  FALSE_CLAIM = 'false_claim',
}

// AI recommendation
export enum AiRecommendation {
  AWARD_FULL = 'award_full',
  AWARD_PARTIAL = 'award_partial',
  REJECT = 'reject',
}

// Document type
export enum DocumentType {
  LEASE = 'lease',
  BANK_STATEMENT = 'bank_statement',
  UTILITY_BILL = 'utility_bill',
  ID_DOCUMENT = 'id_document',
  PROOF_OF_ADDRESS = 'proof_of_address',
  FOOD_CERT = 'food_cert',
  INSURANCE = 'insurance',
  CONSENT_LETTER = 'consent_letter',
  CONTRACT_PDF = 'contract_pdf',
  OTHER = 'other',
}

// Vetting check type
export enum CheckType {
  ID_BIOMETRIC = 'id_biometric',
  ADDRESS = 'address',
  CRIMINAL = 'criminal',
  CIPC = 'cipc',
  AML_PEP = 'aml_pep',
  FOOD_CERT = 'food_cert',
  INSURANCE = 'insurance',
  CREDIT = 'credit',
}

// Vetting result
export enum VettingResult {
  PASS = 'pass',
  FAIL = 'fail',
  FLAG = 'flag',
  PENDING = 'pending',
}

// Trust score event type
export enum TrustScoreEventType {
  CLEAN_SESSION = 'clean_session',
  PENALTY_CLAIM = 'penalty_claim',
  BREACH = 'breach',
  DISPUTE_RAISED = 'dispute_raised',
  DISPUTE_WON = 'dispute_won',
  DISPUTE_LOST = 'dispute_lost',
  RESPONSE_RATE = 'response_rate',
  SATISFACTION = 'satisfaction',
}

// Notification type
export enum NotificationType {
  BOOKING_REQUEST = 'booking_request',
  BOOKING_APPROVED = 'booking_approved',
  SESSION_REMINDER = 'session_reminder',
  HANDOVER_DUE = 'handover_due',
  REPORT_READY = 'report_ready',
  SETTLEMENT_RELEASED = 'settlement_released',
  DISPUTE_OPENED = 'dispute_opened',
  DISPUTE_RESOLVED = 'dispute_resolved',
  VETTING_COMPLETE = 'vetting_complete',
  SCORE_CHANGE = 'score_change',
}

// Notification channel
export enum NotificationChannel {
  PUSH = 'push',
  IN_APP = 'in_app',
  SMS = 'sms',
  EMAIL = 'email',
}

// Notification status
export enum NotificationStatus {
  PENDING = 'pending',
  SENT = 'sent',
  DELIVERED = 'delivered',
  READ = 'read',
  FAILED = 'failed',
}

// Landlord partner status
export enum LandlordPartnerStatus {
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  NEGOTIATING = 'negotiating',
}
