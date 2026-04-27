# ZombieTech — Project Brief for Claude Code

## What is ZombieTech

ZombieTech is a platform that reanimates commercial kitchens (and other commercial spaces) during their dead hours — after the site owner closes, a vetted "zombie operator" runs their own business from the premises. The site owner earns guaranteed income from dead time. The operator gets a fully-equipped commercial kitchen with zero capital outlay. ZombieTech earns a 10% transaction fee on all revenue flowing through the platform.

The core metaphor: a Ghost Kitchen has a commercial kitchen but no serving area. A Zombie Kitchen has neither — it reanimates an existing kitchen during its dead time.

---

## Three-party commercial model

**Site owner** — lists their commercial premises on ZombieTech. Earns a blended hourly rate (monthly rent ÷ 720 + monthly utilities ÷ operating hours) plus an upside: either a fixed % markup (guaranteed) or a variable % share of zombie operator net profit.

**Zombie operator** — books an available slot, passes vetting/KYC, signs a digital contract, and trades during the site's dead hours. Pays the site fee and a 10% ZombieTech platform fee. No capital outlay on premises or equipment.

**ZombieTech** — earns 10% of all zombie operator gross revenue as a transaction fee. Also earns a one-off R800 activation fee per operator (deferred across first 2 sessions), an annual site listing fee, and termination/goodwill fees.

---

## Technology stack (use this exactly)

- **Database**: PostgreSQL with Prisma ORM
- **Backend API**: Node.js + Express + TypeScript
- **Site owner portal**: Next.js 14 (App Router) + Tailwind CSS
- **Operator mobile app**: React Native (Expo) + Tailwind (NativeWind)
- **Admin portal**: Next.js 14 (App Router) + Tailwind CSS
- **Authentication**: JWT tokens issued on OTP verification (Twilio for SMS OTP)
- **File storage**: AWS S3 (documents and photos)
- **Payments**: Peach Payments (South Africa) for card collection and payouts
- **ID vetting**: Smile Identity API (biometric liveness + ID verification)
- **Criminal/CIPC checks**: MIE API
- **AML/PEP screening**: LexisNexis API
- **AI document parsing**: Anthropic Claude API (claude-sonnet-4-20250514)
- **AI photo comparison**: Anthropic Claude API with vision
- **Push notifications**: Expo Push Notifications (operator app) + FCM (web)
- **Maps**: Google Maps API (site browse with map view)
- **Monorepo**: Turborepo with the following packages:
  - `apps/web-site-owner` — Next.js site owner portal
  - `apps/web-admin` — Next.js admin portal
  - `apps/mobile-operator` — React Native operator app
  - `packages/api` — Express API server
  - `packages/database` — Prisma schema + migrations
  - `packages/shared` — shared types, utilities, constants

---

## Database schema — 16 tables across 7 domains

All monetary values stored in cents as bigint. No soft deletes on transactional tables.

### Identity domain
**users** — base account for all platform users
- id (uuid PK), email (varchar 255, unique), mobile (varchar 20), full_name (varchar 255)
- role (enum: site_owner | operator | admin)
- otp_hash (varchar 255), otp_expires_at (timestamptz)
- email_verified_at (timestamptz nullable), mobile_verified_at (timestamptz nullable)
- created_at, updated_at (timestamptz)
- Indexes: idx_users_email (unique), idx_users_mobile, idx_users_role

**site_owners** — extended profile for role=site_owner (1:1 with users)
- id (uuid PK), user_id (uuid FK → users.id unique)
- trading_name, business_category, company_reg_number (nullable), vat_number (nullable)
- bank_account_ref (varchar 100, tokenised), payout_verified_at (timestamptz nullable)
- site_score (integer 0-100), score_tier (enum: standard|silver|gold|platinum)
- created_at (timestamptz)

**operators** — extended profile for role=operator (1:1 with users)
- id (uuid PK), user_id (uuid FK → users.id unique)
- trading_concept (text), food_category (varchar 100)
- emergency_contact_name (varchar 255), emergency_contact_mobile (varchar 20)
- bank_account_ref (varchar 100, tokenised), payout_verified_at (timestamptz nullable)
- trust_score (integer 0-100), activation_fee_balance (integer, cents remaining)
- vetting_status (enum: pending|approved|rejected|suspended)
- vetting_approved_at (timestamptz nullable)
- created_at (timestamptz)

### Sites domain
**sites** — a physical commercial premises listed on the platform
- id (uuid PK), site_owner_id (uuid FK → site_owners.id)
- landlord_partner_id (uuid FK → landlord_partners.id, nullable)
- trading_name, business_category, address_line1, suburb, city
- latitude (decimal 10,7), longitude (decimal 10,7)
- site_opens_time (time), site_closes_time (time), zombie_end_time (time)
- monthly_rent_cents (bigint), monthly_utilities_cents (bigint)
- site_operating_hours_per_month (integer), hourly_rate_cents (bigint, computed)
- consent_status (enum: pending|uploaded|landlord_verified)
- site_score (integer), score_tier (enum: standard|silver|gold|platinum)
- is_listed (boolean), created_at (timestamptz)

**site_slots** — a specific bookable time window at a site
- id (uuid PK), site_id (uuid FK → sites.id)
- day_of_week (enum: mon|tue|wed|thu|fri|sat|sun, nullable for closed days)
- is_closed_day (boolean), slot_start_time (time), slot_end_time (time)
- slot_hours (decimal 4,2), base_fee_cents_per_session (bigint)
- upside_model (enum: fixed|variable)
- upside_fixed_pct (decimal 5,2 nullable), upside_variable_pct (decimal 5,2 nullable)
- status (enum: open|booked|suspended), created_at (timestamptz)

**site_checklist_items** — photo areas defined by site owner, immutable after contract signing
- id (uuid PK), site_id (uuid FK → sites.id)
- area_name (varchar 255), area_category (enum: kitchen|equipment|security|custom)
- sort_order (integer), is_required (boolean default true)
- description (text), created_at (timestamptz)

**landlord_partners** — portfolio partnership agreements with commercial property groups
- id (uuid PK), company_name, contact_name, contact_email
- revenue_share_pct (decimal 5,2), agreement_signed_at (timestamptz)
- agreement_document_id (uuid FK → documents.id)
- portfolio_size (integer), status (enum: active|suspended|negotiating)
- created_at (timestamptz)

### Contracts domain
**booking_requests** — operator request to book a slot before contract generation
- id (uuid PK), site_slot_id (uuid FK → site_slots.id)
- operator_id (uuid FK → operators.id)
- concept_summary (text), requested_start_date (date), recurring (boolean)
- status (enum: pending|approved|declined|expired)
- site_owner_response_at (timestamptz nullable), expires_at (timestamptz)
- created_at (timestamptz)

**contracts** — the zombie services agreement, atomic unit of the platform
- id (uuid PK, human ref ZT-C-NNNN), site_slot_id (uuid FK → site_slots.id)
- operator_id (uuid FK → operators.id)
- booking_request_id (uuid FK → booking_requests.id)
- contract_ref (varchar 20 unique), hourly_rate_cents (bigint, locked at signing)
- upside_model (enum: fixed|variable), upside_pct (decimal 5,2, locked)
- platform_fee_pct (decimal 5,2, default 10.00, locked)
- notice_period_days (integer default 30)
- goodwill_threshold_sessions (integer default 6)
- goodwill_fee_pct (decimal 5,2 default 8.00)
- deactivation_fee_pct (decimal 5,2 default 15.00)
- status (enum: active|in_notice|terminated|expired)
- site_owner_signed_at (timestamptz), operator_signed_at (timestamptz)
- terminated_at (timestamptz nullable)
- terminated_by (enum: site_owner|operator|mutual|breach, nullable)
- created_at (timestamptz)

### Sessions domain
**sessions** — one zombie trading session
- id (uuid PK, human ref ZT-S-NNNN), contract_id (uuid FK → contracts.id)
- session_ref (varchar 20 unique), session_date (date)
- scheduled_start (timestamptz), scheduled_end (timestamptz)
- actual_start (timestamptz), actual_end (timestamptz)
- site_owner_handover_signed_at (timestamptz), operator_handover_signed_at (timestamptz)
- gross_revenue_cents (bigint)
- status (enum: scheduled|active|completed|disputed|cancelled)
- before_photos_complete (boolean), after_photos_complete (boolean), lockup_complete (boolean)
- ai_handover_score (integer), ai_flags_count (integer)
- site_owner_confirmed_at (timestamptz nullable)
- site_owner_confirmed_good_order (boolean nullable)
- created_at (timestamptz)

**session_photos** — individual photos taken in-app (GPS + server timestamp, no gallery uploads)
- id (uuid PK), session_id (uuid FK → sessions.id)
- checklist_item_id (uuid FK → site_checklist_items.id)
- photo_type (enum: before|after|lockup)
- storage_key (varchar 500), storage_url (text)
- latitude (decimal 10,7), longitude (decimal 10,7)
- device_timestamp (timestamptz), server_timestamp (timestamptz)
- hash (varchar 64, SHA-256), created_at (timestamptz)

**photo_comparisons** — AI comparison result for each before/after pair
- id (uuid PK), session_id (uuid FK → sessions.id)
- checklist_item_id (uuid FK → site_checklist_items.id)
- before_photo_id (uuid FK → session_photos.id)
- after_photo_id (uuid FK → session_photos.id, nullable)
- ai_result (enum: clean|flagged|inconclusive), ai_confidence (decimal 5,2)
- ai_description (text), admin_override (enum: clean|flagged, nullable)
- admin_override_by (uuid FK → users.id, nullable)
- created_at (timestamptz)

### Financial domain
**settlements** — weekly settlement batch, one per operator per weekend cycle
- id (uuid PK), operator_id (uuid FK → operators.id)
- settlement_ref (varchar 20 unique), period_start (date), period_end (date)
- gross_revenue_cents (bigint), platform_fee_cents (bigint)
- site_fees_cents (bigint), landlord_share_cents (bigint)
- penalty_deductions_cents (bigint), activation_deduction_cents (bigint)
- operator_payout_cents (bigint)
- status (enum: pending|ready|released|held|failed)
- released_at (timestamptz nullable), payment_provider_ref (varchar 255 nullable)
- created_at (timestamptz)

**settlement_line_items** — per-session breakdown within a settlement
- id (uuid PK), settlement_id (uuid FK → settlements.id)
- session_id (uuid FK → sessions.id), site_slot_id (uuid FK → site_slots.id)
- line_type (enum: revenue|platform_fee|site_fee|landlord_share|penalty|activation)
- amount_cents (bigint, positive=credit negative=debit)
- description (varchar 255), created_at (timestamptz)

**disputes** — damage or breach claims, blocks settlement until resolved
- id (uuid PK, human ref ZT-D-NNNN), session_id (uuid FK → sessions.id)
- raised_by_user_id (uuid FK → users.id), dispute_ref (varchar 20 unique)
- claim_type (enum: damage|cleaning|theft|breach|false_claim)
- claim_amount_cents (bigint), description (text)
- ai_recommendation (enum: award_full|award_partial|reject)
- ai_confidence (decimal 5,2), ai_reasoning (text)
- admin_decision (enum: award_full|award_partial|reject, nullable)
- admin_decided_by (uuid FK → users.id, nullable)
- awarded_amount_cents (bigint nullable)
- status (enum: open|under_review|resolved|escalated)
- deadline_at (timestamptz), resolved_at (timestamptz nullable)
- created_at (timestamptz)

### Compliance domain
**documents** — all uploaded files, immutably stored
- id (uuid PK), owner_user_id (uuid FK → users.id)
- document_type (enum: lease|bank_statement|utility_bill|id_document|proof_of_address|food_cert|insurance|consent_letter|contract_pdf|other)
- storage_key (varchar 500), file_name (varchar 255), mime_type (varchar 100)
- file_size_bytes (bigint), hash (varchar 64, SHA-256)
- ai_parsed (boolean), ai_extracted_data (jsonb)
- expires_at (date nullable), expiry_alerted_at (timestamptz nullable)
- created_at (timestamptz, immutable)

**vetting_records** — individual check results for operator vetting
- id (uuid PK), operator_id (uuid FK → operators.id)
- check_type (enum: id_biometric|address|criminal|cipc|aml_pep|food_cert|insurance|credit)
- provider (varchar 100), provider_ref (varchar 255)
- result (enum: pass|fail|flag|pending), confidence_score (decimal 5,2 nullable)
- raw_response (jsonb), flag_reason (text nullable)
- requires_manual_review (boolean), reviewed_by (uuid FK → users.id, nullable)
- reviewed_at (timestamptz nullable), created_at (timestamptz)

### Platform domain
**trust_score_events** — every trust score change, immutable audit trail
- id (uuid PK), subject_user_id (uuid FK → users.id)
- contract_id (uuid FK nullable), session_id (uuid FK nullable), dispute_id (uuid FK nullable)
- event_type (enum: clean_session|penalty_claim|breach|dispute_raised|dispute_won|dispute_lost|response_rate|satisfaction)
- points_delta (integer), score_before (integer), score_after (integer)
- description (varchar 255), created_at (timestamptz, immutable)

**notifications** — push and in-app notifications
- id (uuid PK), user_id (uuid FK → users.id)
- notification_type (enum: booking_request|booking_approved|session_reminder|handover_due|report_ready|settlement_released|dispute_opened|dispute_resolved|vetting_complete|score_change)
- related_entity_id (uuid), related_entity_type (varchar 50)
- title (varchar 255), body (text)
- channel (enum: push|in_app|sms|email)
- status (enum: pending|sent|delivered|read|failed)
- sent_at (timestamptz nullable), read_at (timestamptz nullable)
- created_at (timestamptz)

**audit_log** — append-only, non-deletable record of every platform event
- id (uuid PK), actor_user_id (uuid FK → users.id, nullable for system events)
- event_type (varchar 100, namespaced e.g. session.started, contract.signed)
- entity_type (varchar 50), entity_id (uuid)
- ip_address (inet nullable), user_agent (text nullable)
- payload (jsonb, full event payload at time of event)
- created_at (timestamptz, IMMUTABLE — no updates ever)

---

## Platform architecture

```
Client interfaces (site owner web app, operator mobile app, admin portal)
    ↓
API gateway & JWT authentication middleware
    ↓
Platform services:
  - AI engine (document parsing, photo comparison, revenue forecasting)
  - Contracts service (generate, store, sign)
  - Vetting & KYC service (orchestrate third-party checks)
  - Payments service (collect, escrow, settle)
    ↓
Data layer:
  - Document store (S3 + documents table)
  - Photo & evidence store (S3 + session_photos + photo_comparisons)
  - Event & audit log (audit_log table, append-only)
  - PostgreSQL (all other tables via Prisma)
```

---

## Key business rules — enforce these everywhere

1. **All monetary values in cents (bigint)**. Never store decimals for money. Convert to Rands only for display.

2. **audit_log is append-only**. No UPDATE or DELETE on this table ever. Enforce via PostgreSQL row-level security and application-level guards.

3. **Session photos must be taken in-app**. The API endpoint for photo upload must verify that the photo was captured via the in-app camera (server-generated timestamp, GPS from device location API). Reject any upload that arrives without these metadata fields.

4. **Dual OTP handover**. A session cannot move from `scheduled` to `active` status until BOTH the site owner and the operator have submitted valid OTPs. The actual_start timestamp is set at the moment the second OTP is verified.

5. **Lock-up sequence is sequential**. Photo checklist items for `lockup` type must be completed in sort_order. The API must reject out-of-order submissions.

6. **Settlement auto-release**. If a site owner does not confirm or raise a claim by Monday 12:00, the settlement is automatically released to the operator. This is a scheduled job.

7. **Activation fee deferred**. When an operator signs their first contract, activation_fee_balance is set to 80000 (R800 in cents). The settlement engine deducts min(40000, payout_amount) from each payout until activation_fee_balance reaches 0.

8. **Goodwill fee trigger**. When a site owner initiates termination (not mutual, not breach), check if the operator has completed >= goodwill_threshold_sessions at that site with >= 80% clean handover rate. If yes, calculate and charge the goodwill fee.

9. **Trust scores are bilateral**. Operators have trust_score on the operators table. Site owners have site_score on the sites table. Both are updated by the trust_score_events table via a background job after each settled session.

10. **Contracts are immutable after signing**. Once both site_owner_signed_at and operator_signed_at are set, no commercial fields (hourly_rate_cents, upside_pct, platform_fee_pct) may be changed. Enforce at the API level.

---

## Site owner app — 17 screens (web, Next.js)

Landing → How it works → Register (OTP) → Business details → Document upload (AI parsing) → AI fee review → Slot scheduler → Upside model → Site checklist builder → Contract preview → Sign & go live (OTP) → Site dashboard → Booking request review → Active session monitor → Handover report (Sunday morning) → Settlement → Performance

## Operator app — 17 screens (mobile, React Native)

Browse sites → Site detail with revenue forecast → Register (OTP) → Upload documents → Vetting status → Book a slot → Sign contract (OTP) → Home dashboard → Pre-session checklist → Handover sign (dual OTP) → Before photos (sequential, in-app camera only) → Trading live → After photos → Lock-up sequence → Session close → Settlement → Trust & profile

## Admin portal — 10 sections (web, Next.js)

Platform dashboard → Vetting queue → Site management → Operator management → Contract management → Live sessions monitor → Settlement queue → Disputes → Landlord partners → Analytics

---

## Build sequence for Claude Code

Work through these phases in order. Complete each phase before starting the next.

### Phase 1 — Foundation (start here)
1. Initialise Turborepo monorepo with all packages
2. Set up PostgreSQL database with complete Prisma schema (all 16 tables)
3. Run initial migration
4. Seed database with realistic test data (2 site owners, 3 operators, 4 sites, 6 contracts, 20 sessions)
5. Set up Express API with TypeScript, basic middleware, JWT auth, error handling

### Phase 2 — Core API
6. Auth endpoints: POST /auth/request-otp, POST /auth/verify-otp (returns JWT)
7. Site owner CRUD: sites, site_slots, site_checklist_items
8. Document upload: POST /documents (S3 upload + AI parsing via Claude API)
9. Operator onboarding: registration, document upload, vetting orchestration
10. Booking requests: create, approve, decline
11. Contract generation and OTP signing
12. Session management: create, handover sign (dual OTP), status transitions

### Phase 3 — Session operations
13. Photo upload endpoint (in-app only, GPS + timestamp validation, S3 storage, SHA-256 hash)
14. AI photo comparison (Claude vision API, store results in photo_comparisons)
15. Lock-up sequence enforcement (sequential, rejects out-of-order)
16. Session close and handover report generation

### Phase 4 — Financial
17. Settlement engine: compute splits, create settlement + line items
18. Auto-release job (Monday 12:00 deadline)
19. Activation fee deduction logic
20. Dispute creation, AI recommendation, admin resolution

### Phase 5 — Site owner web app (Next.js)
Build all 17 screens in sequence. Use the design from the site owner app artefact as reference.

### Phase 6 — Admin portal (Next.js)
Build all 10 sections. Use the admin portal artefact as reference.

### Phase 7 — Operator mobile app (React Native / Expo)
Build all 17 screens. Pay particular attention to the photo protocol screens — in-app camera only, GPS metadata, sequential checklist enforcement.

### Phase 8 — Background jobs & integrations
- Monday settlement release cron job
- Document expiry alert job (food certs, insurance)
- Third-party vetting API integrations (Smile Identity, MIE, LexisNexis)
- Peach Payments integration
- Push notifications (Expo + FCM)

---

## Environment variables required

```
DATABASE_URL=
JWT_SECRET=
JWT_EXPIRES_IN=7d
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=af-south-1
AWS_S3_BUCKET=zombietech-documents
ANTHROPIC_API_KEY=
SMILE_IDENTITY_API_KEY=
SMILE_IDENTITY_PARTNER_ID=
MIE_API_KEY=
LEXISNEXIS_API_KEY=
PEACH_PAYMENTS_API_KEY=
PEACH_PAYMENTS_MERCHANT_ID=
GOOGLE_MAPS_API_KEY=
EXPO_PUSH_TOKEN=
```

---

## South African context

- Currency: South African Rand (ZAR, symbol R)
- Phone numbers: +27 format
- ID documents: SA ID (13-digit) or passport
- Compliance: FICA (Financial Intelligence Centre Act) for AML/KYC
- Business registration: CIPC (Companies and Intellectual Property Commission)
- Tax authority: SARS (South African Revenue Service)
- VAT threshold: R1,000,000 annual turnover
- Time zone: Africa/Johannesburg (UTC+2, no daylight saving)
- Major payment processor: Peach Payments (preferred for SA market)

---

## What NOT to build yet (Release 2)

Do not build these until Release 1 is fully working and generating revenue:
- Shelf company registration wizard (requires CIPC API partnership)
- Bank account opening wizard (requires banking partner agreement)
- SARS registration wizard (requires SARS eFiling API)
- AI brand wizard
- Menu development wizard
- Supplier marketplace
- Inventory management
- Delivery platform integration (UberEats, Mr D)
