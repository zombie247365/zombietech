-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('site_owner', 'operator', 'admin');

-- CreateEnum
CREATE TYPE "ScoreTier" AS ENUM ('standard', 'silver', 'gold', 'platinum');

-- CreateEnum
CREATE TYPE "VettingStatus" AS ENUM ('pending', 'approved', 'rejected', 'suspended');

-- CreateEnum
CREATE TYPE "ConsentStatus" AS ENUM ('pending', 'uploaded', 'landlord_verified');

-- CreateEnum
CREATE TYPE "DayOfWeek" AS ENUM ('mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun');

-- CreateEnum
CREATE TYPE "UpsideModel" AS ENUM ('fixed', 'variable');

-- CreateEnum
CREATE TYPE "SiteSlotStatus" AS ENUM ('open', 'booked', 'suspended');

-- CreateEnum
CREATE TYPE "AreaCategory" AS ENUM ('kitchen', 'equipment', 'security', 'custom');

-- CreateEnum
CREATE TYPE "BookingRequestStatus" AS ENUM ('pending', 'approved', 'declined', 'expired');

-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('active', 'in_notice', 'terminated', 'expired');

-- CreateEnum
CREATE TYPE "TerminatedBy" AS ENUM ('site_owner', 'operator', 'mutual', 'breach');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('scheduled', 'active', 'completed', 'disputed', 'cancelled');

-- CreateEnum
CREATE TYPE "PhotoType" AS ENUM ('before', 'after', 'lockup');

-- CreateEnum
CREATE TYPE "AiResult" AS ENUM ('clean', 'flagged', 'inconclusive');

-- CreateEnum
CREATE TYPE "AdminOverride" AS ENUM ('clean', 'flagged');

-- CreateEnum
CREATE TYPE "SettlementStatus" AS ENUM ('pending', 'ready', 'released', 'held', 'failed');

-- CreateEnum
CREATE TYPE "LineType" AS ENUM ('revenue', 'platform_fee', 'site_fee', 'landlord_share', 'penalty', 'activation');

-- CreateEnum
CREATE TYPE "DisputeStatus" AS ENUM ('open', 'under_review', 'resolved', 'escalated');

-- CreateEnum
CREATE TYPE "ClaimType" AS ENUM ('damage', 'cleaning', 'theft', 'breach', 'false_claim');

-- CreateEnum
CREATE TYPE "AiRecommendation" AS ENUM ('award_full', 'award_partial', 'reject');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('lease', 'bank_statement', 'utility_bill', 'id_document', 'proof_of_address', 'food_cert', 'insurance', 'consent_letter', 'contract_pdf', 'other');

-- CreateEnum
CREATE TYPE "CheckType" AS ENUM ('id_biometric', 'address', 'criminal', 'cipc', 'aml_pep', 'food_cert', 'insurance', 'credit');

-- CreateEnum
CREATE TYPE "VettingResult" AS ENUM ('pass', 'fail', 'flag', 'pending');

-- CreateEnum
CREATE TYPE "TrustScoreEventType" AS ENUM ('clean_session', 'penalty_claim', 'breach', 'dispute_raised', 'dispute_won', 'dispute_lost', 'response_rate', 'satisfaction');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('booking_request', 'booking_approved', 'session_reminder', 'handover_due', 'report_ready', 'settlement_released', 'dispute_opened', 'dispute_resolved', 'vetting_complete', 'score_change');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('push', 'in_app', 'sms', 'email');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('pending', 'sent', 'delivered', 'read', 'failed');

-- CreateEnum
CREATE TYPE "LandlordPartnerStatus" AS ENUM ('active', 'suspended', 'negotiating');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "mobile" VARCHAR(20) NOT NULL,
    "full_name" VARCHAR(255) NOT NULL,
    "role" "UserRole" NOT NULL,
    "otp_hash" VARCHAR(255),
    "otp_expires_at" TIMESTAMPTZ,
    "email_verified_at" TIMESTAMPTZ,
    "mobile_verified_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site_owners" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "trading_name" VARCHAR(255) NOT NULL,
    "business_category" VARCHAR(100) NOT NULL,
    "company_reg_number" VARCHAR(50),
    "vat_number" VARCHAR(20),
    "bank_account_ref" VARCHAR(100),
    "payout_verified_at" TIMESTAMPTZ,
    "site_score" INTEGER NOT NULL DEFAULT 50,
    "score_tier" "ScoreTier" NOT NULL DEFAULT 'standard',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "site_owners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operators" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "trading_concept" TEXT NOT NULL,
    "food_category" VARCHAR(100) NOT NULL,
    "emergency_contact_name" VARCHAR(255) NOT NULL,
    "emergency_contact_mobile" VARCHAR(20) NOT NULL,
    "bank_account_ref" VARCHAR(100),
    "payout_verified_at" TIMESTAMPTZ,
    "trust_score" INTEGER NOT NULL DEFAULT 50,
    "activation_fee_balance" INTEGER NOT NULL DEFAULT 0,
    "vetting_status" "VettingStatus" NOT NULL DEFAULT 'pending',
    "vetting_approved_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "operators_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "landlord_partners" (
    "id" TEXT NOT NULL,
    "company_name" VARCHAR(255) NOT NULL,
    "contact_name" VARCHAR(255) NOT NULL,
    "contact_email" VARCHAR(255) NOT NULL,
    "revenue_share_pct" DECIMAL(5,2) NOT NULL,
    "agreement_signed_at" TIMESTAMPTZ NOT NULL,
    "agreement_document_id" TEXT,
    "portfolio_size" INTEGER NOT NULL,
    "status" "LandlordPartnerStatus" NOT NULL DEFAULT 'negotiating',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "landlord_partners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sites" (
    "id" TEXT NOT NULL,
    "site_owner_id" TEXT NOT NULL,
    "landlord_partner_id" TEXT,
    "trading_name" VARCHAR(255) NOT NULL,
    "business_category" VARCHAR(100) NOT NULL,
    "address_line1" VARCHAR(255) NOT NULL,
    "suburb" VARCHAR(100) NOT NULL,
    "city" VARCHAR(100) NOT NULL,
    "latitude" DECIMAL(10,7) NOT NULL,
    "longitude" DECIMAL(10,7) NOT NULL,
    "site_opens_time" VARCHAR(8) NOT NULL,
    "site_closes_time" VARCHAR(8) NOT NULL,
    "zombie_end_time" VARCHAR(8) NOT NULL,
    "monthly_rent_cents" BIGINT NOT NULL,
    "monthly_utilities_cents" BIGINT NOT NULL,
    "site_operating_hours_per_month" INTEGER NOT NULL,
    "hourly_rate_cents" BIGINT NOT NULL,
    "consent_status" "ConsentStatus" NOT NULL DEFAULT 'pending',
    "site_score" INTEGER NOT NULL DEFAULT 50,
    "score_tier" "ScoreTier" NOT NULL DEFAULT 'standard',
    "is_listed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site_slots" (
    "id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "day_of_week" "DayOfWeek",
    "is_closed_day" BOOLEAN NOT NULL DEFAULT false,
    "slot_start_time" VARCHAR(8) NOT NULL,
    "slot_end_time" VARCHAR(8) NOT NULL,
    "slot_hours" DECIMAL(4,2) NOT NULL,
    "base_fee_cents_per_session" BIGINT NOT NULL,
    "upside_model" "UpsideModel" NOT NULL,
    "upside_fixed_pct" DECIMAL(5,2),
    "upside_variable_pct" DECIMAL(5,2),
    "status" "SiteSlotStatus" NOT NULL DEFAULT 'open',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "site_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site_checklist_items" (
    "id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "area_name" VARCHAR(255) NOT NULL,
    "area_category" "AreaCategory" NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "is_required" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "site_checklist_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_requests" (
    "id" TEXT NOT NULL,
    "site_slot_id" TEXT NOT NULL,
    "operator_id" TEXT NOT NULL,
    "concept_summary" TEXT NOT NULL,
    "requested_start_date" DATE NOT NULL,
    "recurring" BOOLEAN NOT NULL DEFAULT false,
    "status" "BookingRequestStatus" NOT NULL DEFAULT 'pending',
    "site_owner_response_at" TIMESTAMPTZ,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booking_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contracts" (
    "id" TEXT NOT NULL,
    "contract_ref" VARCHAR(20) NOT NULL,
    "site_slot_id" TEXT NOT NULL,
    "operator_id" TEXT NOT NULL,
    "booking_request_id" TEXT NOT NULL,
    "hourly_rate_cents" BIGINT NOT NULL,
    "upside_model" "UpsideModel" NOT NULL,
    "upside_pct" DECIMAL(5,2) NOT NULL,
    "platform_fee_pct" DECIMAL(5,2) NOT NULL DEFAULT 10.00,
    "notice_period_days" INTEGER NOT NULL DEFAULT 30,
    "goodwill_threshold_sessions" INTEGER NOT NULL DEFAULT 6,
    "goodwill_fee_pct" DECIMAL(5,2) NOT NULL DEFAULT 8.00,
    "deactivation_fee_pct" DECIMAL(5,2) NOT NULL DEFAULT 15.00,
    "status" "ContractStatus" NOT NULL DEFAULT 'active',
    "site_owner_signed_at" TIMESTAMPTZ,
    "operator_signed_at" TIMESTAMPTZ,
    "terminated_at" TIMESTAMPTZ,
    "terminated_by" "TerminatedBy",
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "session_ref" VARCHAR(20) NOT NULL,
    "contract_id" TEXT NOT NULL,
    "session_date" DATE NOT NULL,
    "scheduled_start" TIMESTAMPTZ NOT NULL,
    "scheduled_end" TIMESTAMPTZ NOT NULL,
    "actual_start" TIMESTAMPTZ,
    "actual_end" TIMESTAMPTZ,
    "site_owner_handover_signed_at" TIMESTAMPTZ,
    "operator_handover_signed_at" TIMESTAMPTZ,
    "gross_revenue_cents" BIGINT NOT NULL DEFAULT 0,
    "status" "SessionStatus" NOT NULL DEFAULT 'scheduled',
    "before_photos_complete" BOOLEAN NOT NULL DEFAULT false,
    "after_photos_complete" BOOLEAN NOT NULL DEFAULT false,
    "lockup_complete" BOOLEAN NOT NULL DEFAULT false,
    "ai_handover_score" INTEGER,
    "ai_flags_count" INTEGER,
    "site_owner_confirmed_at" TIMESTAMPTZ,
    "site_owner_confirmed_good_order" BOOLEAN,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session_photos" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "checklist_item_id" TEXT NOT NULL,
    "photo_type" "PhotoType" NOT NULL,
    "storage_key" VARCHAR(500) NOT NULL,
    "storage_url" TEXT NOT NULL,
    "latitude" DECIMAL(10,7) NOT NULL,
    "longitude" DECIMAL(10,7) NOT NULL,
    "device_timestamp" TIMESTAMPTZ NOT NULL,
    "server_timestamp" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hash" VARCHAR(64) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "session_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "photo_comparisons" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "checklist_item_id" TEXT NOT NULL,
    "before_photo_id" TEXT NOT NULL,
    "after_photo_id" TEXT,
    "ai_result" "AiResult" NOT NULL,
    "ai_confidence" DECIMAL(5,2) NOT NULL,
    "ai_description" TEXT NOT NULL,
    "admin_override" "AdminOverride",
    "admin_override_by" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "photo_comparisons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settlements" (
    "id" TEXT NOT NULL,
    "operator_id" TEXT NOT NULL,
    "settlement_ref" VARCHAR(20) NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "gross_revenue_cents" BIGINT NOT NULL DEFAULT 0,
    "platform_fee_cents" BIGINT NOT NULL DEFAULT 0,
    "site_fees_cents" BIGINT NOT NULL DEFAULT 0,
    "landlord_share_cents" BIGINT NOT NULL DEFAULT 0,
    "penalty_deductions_cents" BIGINT NOT NULL DEFAULT 0,
    "activation_deduction_cents" BIGINT NOT NULL DEFAULT 0,
    "operator_payout_cents" BIGINT NOT NULL DEFAULT 0,
    "status" "SettlementStatus" NOT NULL DEFAULT 'pending',
    "released_at" TIMESTAMPTZ,
    "payment_provider_ref" VARCHAR(255),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "settlements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settlement_line_items" (
    "id" TEXT NOT NULL,
    "settlement_id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "site_slot_id" TEXT NOT NULL,
    "line_type" "LineType" NOT NULL,
    "amount_cents" BIGINT NOT NULL,
    "description" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "settlement_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "disputes" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "raised_by_user_id" TEXT NOT NULL,
    "dispute_ref" VARCHAR(20) NOT NULL,
    "claim_type" "ClaimType" NOT NULL,
    "claim_amount_cents" BIGINT NOT NULL,
    "description" TEXT NOT NULL,
    "ai_recommendation" "AiRecommendation",
    "ai_confidence" DECIMAL(5,2),
    "ai_reasoning" TEXT,
    "admin_decision" "AiRecommendation",
    "admin_decided_by" TEXT,
    "awarded_amount_cents" BIGINT,
    "status" "DisputeStatus" NOT NULL DEFAULT 'open',
    "deadline_at" TIMESTAMPTZ NOT NULL,
    "resolved_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "disputes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "owner_user_id" TEXT NOT NULL,
    "document_type" "DocumentType" NOT NULL,
    "storage_key" VARCHAR(500) NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "file_size_bytes" BIGINT NOT NULL,
    "hash" VARCHAR(64) NOT NULL,
    "ai_parsed" BOOLEAN NOT NULL DEFAULT false,
    "ai_extracted_data" JSONB,
    "expires_at" DATE,
    "expiry_alerted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vetting_records" (
    "id" TEXT NOT NULL,
    "operator_id" TEXT NOT NULL,
    "check_type" "CheckType" NOT NULL,
    "provider" VARCHAR(100) NOT NULL,
    "provider_ref" VARCHAR(255) NOT NULL,
    "result" "VettingResult" NOT NULL DEFAULT 'pending',
    "confidence_score" DECIMAL(5,2),
    "raw_response" JSONB,
    "flag_reason" TEXT,
    "requires_manual_review" BOOLEAN NOT NULL DEFAULT false,
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vetting_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trust_score_events" (
    "id" TEXT NOT NULL,
    "subject_user_id" TEXT NOT NULL,
    "contract_id" TEXT,
    "session_id" TEXT,
    "dispute_id" TEXT,
    "event_type" "TrustScoreEventType" NOT NULL,
    "points_delta" INTEGER NOT NULL,
    "score_before" INTEGER NOT NULL,
    "score_after" INTEGER NOT NULL,
    "description" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trust_score_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "notification_type" "NotificationType" NOT NULL,
    "related_entity_id" TEXT NOT NULL,
    "related_entity_type" VARCHAR(50) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "body" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'pending',
    "sent_at" TIMESTAMPTZ,
    "read_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" TEXT NOT NULL,
    "actor_user_id" TEXT,
    "event_type" VARCHAR(100) NOT NULL,
    "entity_type" VARCHAR(50) NOT NULL,
    "entity_id" TEXT NOT NULL,
    "ip_address" VARCHAR(45),
    "user_agent" TEXT,
    "payload" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "idx_users_email" ON "users"("email");

-- CreateIndex
CREATE INDEX "idx_users_mobile" ON "users"("mobile");

-- CreateIndex
CREATE INDEX "idx_users_role" ON "users"("role");

-- CreateIndex
CREATE UNIQUE INDEX "site_owners_user_id_key" ON "site_owners"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "operators_user_id_key" ON "operators"("user_id");

-- CreateIndex
CREATE INDEX "sites_site_owner_id_idx" ON "sites"("site_owner_id");

-- CreateIndex
CREATE INDEX "sites_city_idx" ON "sites"("city");

-- CreateIndex
CREATE INDEX "sites_is_listed_idx" ON "sites"("is_listed");

-- CreateIndex
CREATE INDEX "site_slots_site_id_idx" ON "site_slots"("site_id");

-- CreateIndex
CREATE INDEX "site_slots_status_idx" ON "site_slots"("status");

-- CreateIndex
CREATE INDEX "site_checklist_items_site_id_sort_order_idx" ON "site_checklist_items"("site_id", "sort_order");

-- CreateIndex
CREATE INDEX "booking_requests_site_slot_id_idx" ON "booking_requests"("site_slot_id");

-- CreateIndex
CREATE INDEX "booking_requests_operator_id_idx" ON "booking_requests"("operator_id");

-- CreateIndex
CREATE INDEX "booking_requests_status_idx" ON "booking_requests"("status");

-- CreateIndex
CREATE UNIQUE INDEX "contracts_contract_ref_key" ON "contracts"("contract_ref");

-- CreateIndex
CREATE INDEX "contracts_operator_id_idx" ON "contracts"("operator_id");

-- CreateIndex
CREATE INDEX "contracts_status_idx" ON "contracts"("status");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_session_ref_key" ON "sessions"("session_ref");

-- CreateIndex
CREATE INDEX "sessions_contract_id_idx" ON "sessions"("contract_id");

-- CreateIndex
CREATE INDEX "sessions_session_date_idx" ON "sessions"("session_date");

-- CreateIndex
CREATE INDEX "sessions_status_idx" ON "sessions"("status");

-- CreateIndex
CREATE INDEX "session_photos_session_id_photo_type_idx" ON "session_photos"("session_id", "photo_type");

-- CreateIndex
CREATE INDEX "photo_comparisons_session_id_idx" ON "photo_comparisons"("session_id");

-- CreateIndex
CREATE UNIQUE INDEX "settlements_settlement_ref_key" ON "settlements"("settlement_ref");

-- CreateIndex
CREATE INDEX "settlements_operator_id_idx" ON "settlements"("operator_id");

-- CreateIndex
CREATE INDEX "settlements_status_idx" ON "settlements"("status");

-- CreateIndex
CREATE INDEX "settlement_line_items_settlement_id_idx" ON "settlement_line_items"("settlement_id");

-- CreateIndex
CREATE UNIQUE INDEX "disputes_dispute_ref_key" ON "disputes"("dispute_ref");

-- CreateIndex
CREATE INDEX "disputes_session_id_idx" ON "disputes"("session_id");

-- CreateIndex
CREATE INDEX "disputes_status_idx" ON "disputes"("status");

-- CreateIndex
CREATE INDEX "documents_owner_user_id_idx" ON "documents"("owner_user_id");

-- CreateIndex
CREATE INDEX "documents_document_type_idx" ON "documents"("document_type");

-- CreateIndex
CREATE INDEX "vetting_records_operator_id_idx" ON "vetting_records"("operator_id");

-- CreateIndex
CREATE INDEX "trust_score_events_subject_user_id_idx" ON "trust_score_events"("subject_user_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_status_idx" ON "notifications"("user_id", "status");

-- CreateIndex
CREATE INDEX "audit_log_entity_type_entity_id_idx" ON "audit_log"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_log_actor_user_id_idx" ON "audit_log"("actor_user_id");

-- AddForeignKey
ALTER TABLE "site_owners" ADD CONSTRAINT "site_owners_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operators" ADD CONSTRAINT "operators_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sites" ADD CONSTRAINT "sites_site_owner_id_fkey" FOREIGN KEY ("site_owner_id") REFERENCES "site_owners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sites" ADD CONSTRAINT "sites_landlord_partner_id_fkey" FOREIGN KEY ("landlord_partner_id") REFERENCES "landlord_partners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "site_slots" ADD CONSTRAINT "site_slots_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "site_checklist_items" ADD CONSTRAINT "site_checklist_items_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_requests" ADD CONSTRAINT "booking_requests_site_slot_id_fkey" FOREIGN KEY ("site_slot_id") REFERENCES "site_slots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_requests" ADD CONSTRAINT "booking_requests_operator_id_fkey" FOREIGN KEY ("operator_id") REFERENCES "operators"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_site_slot_id_fkey" FOREIGN KEY ("site_slot_id") REFERENCES "site_slots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_operator_id_fkey" FOREIGN KEY ("operator_id") REFERENCES "operators"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_booking_request_id_fkey" FOREIGN KEY ("booking_request_id") REFERENCES "booking_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_photos" ADD CONSTRAINT "session_photos_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_photos" ADD CONSTRAINT "session_photos_checklist_item_id_fkey" FOREIGN KEY ("checklist_item_id") REFERENCES "site_checklist_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photo_comparisons" ADD CONSTRAINT "photo_comparisons_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photo_comparisons" ADD CONSTRAINT "photo_comparisons_checklist_item_id_fkey" FOREIGN KEY ("checklist_item_id") REFERENCES "site_checklist_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photo_comparisons" ADD CONSTRAINT "photo_comparisons_before_photo_id_fkey" FOREIGN KEY ("before_photo_id") REFERENCES "session_photos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photo_comparisons" ADD CONSTRAINT "photo_comparisons_after_photo_id_fkey" FOREIGN KEY ("after_photo_id") REFERENCES "session_photos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photo_comparisons" ADD CONSTRAINT "photo_comparisons_admin_override_by_fkey" FOREIGN KEY ("admin_override_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_operator_id_fkey" FOREIGN KEY ("operator_id") REFERENCES "operators"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlement_line_items" ADD CONSTRAINT "settlement_line_items_settlement_id_fkey" FOREIGN KEY ("settlement_id") REFERENCES "settlements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlement_line_items" ADD CONSTRAINT "settlement_line_items_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlement_line_items" ADD CONSTRAINT "settlement_line_items_site_slot_id_fkey" FOREIGN KEY ("site_slot_id") REFERENCES "site_slots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_raised_by_user_id_fkey" FOREIGN KEY ("raised_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_admin_decided_by_fkey" FOREIGN KEY ("admin_decided_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vetting_records" ADD CONSTRAINT "vetting_records_operator_id_fkey" FOREIGN KEY ("operator_id") REFERENCES "operators"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vetting_records" ADD CONSTRAINT "vetting_records_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trust_score_events" ADD CONSTRAINT "trust_score_events_subject_user_id_fkey" FOREIGN KEY ("subject_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trust_score_events" ADD CONSTRAINT "trust_score_events_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trust_score_events" ADD CONSTRAINT "trust_score_events_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trust_score_events" ADD CONSTRAINT "trust_score_events_dispute_id_fkey" FOREIGN KEY ("dispute_id") REFERENCES "disputes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
