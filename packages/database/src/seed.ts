import { PrismaClient, Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding ZombieTech database...');

  // ─── Clean existing data (order matters for FK constraints) ───
  await prisma.auditLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.trustScoreEvent.deleteMany();
  await prisma.vettingRecord.deleteMany();
  await prisma.document.deleteMany();
  await prisma.dispute.deleteMany();
  await prisma.settlementLineItem.deleteMany();
  await prisma.settlement.deleteMany();
  await prisma.photoComparison.deleteMany();
  await prisma.sessionPhoto.deleteMany();
  await prisma.session.deleteMany();
  await prisma.contract.deleteMany();
  await prisma.bookingRequest.deleteMany();
  await prisma.siteChecklistItem.deleteMany();
  await prisma.siteSlot.deleteMany();
  await prisma.site.deleteMany();
  await prisma.siteOwner.deleteMany();
  await prisma.operator.deleteMany();
  await prisma.user.deleteMany();
  await prisma.landlordPartner.deleteMany();
  console.log('  ✓ Cleared existing data');

  // ─── Landlord Partner ───
  const landlordPartner = await prisma.landlordPartner.create({
    data: {
      company_name: 'Growthpoint Properties',
      contact_name: 'Sipho Ndlovu',
      contact_email: 'sipho.ndlovu@growthpoint.co.za',
      revenue_share_pct: 2.5,
      agreement_signed_at: new Date('2025-06-01T10:00:00+02:00'),
      portfolio_size: 12,
      status: 'active',
    },
  });
  console.log('  ✓ Created landlord partner');

  // ─── Admin user ───
  const adminUser = await prisma.user.create({
    data: {
      email: 'admin@zombietech.co.za',
      mobile: '+27821234567',
      full_name: 'ZombieTech Admin',
      role: 'admin',
      mobile_verified_at: new Date('2025-01-01T00:00:00Z'),
      email_verified_at: new Date('2025-01-01T00:00:00Z'),
    },
  });

  // ─── Site Owner 1: Thabo Mokoena (restaurant owner) ───
  const siteOwner1User = await prisma.user.create({
    data: {
      email: 'thabo.mokoena@thaboskitchen.co.za',
      mobile: '+27833456789',
      full_name: 'Thabo Mokoena',
      role: 'site_owner',
      mobile_verified_at: new Date('2025-03-15T08:00:00+02:00'),
      email_verified_at: new Date('2025-03-15T08:05:00+02:00'),
    },
  });

  const siteOwner1 = await prisma.siteOwner.create({
    data: {
      user_id: siteOwner1User.id,
      trading_name: "Thabo's Kitchen",
      business_category: 'Restaurant',
      company_reg_number: '2019/345678/07',
      vat_number: '4210987654',
      bank_account_ref: 'fnb_tok_4b2a9c1d',
      payout_verified_at: new Date('2025-03-20T10:00:00+02:00'),
      site_score: 72,
      score_tier: 'gold',
    },
  });

  // ─── Site Owner 2: Priya Naidoo (café owner) ───
  const siteOwner2User = await prisma.user.create({
    data: {
      email: 'priya.naidoo@spicejarsa.co.za',
      mobile: '+27844567890',
      full_name: 'Priya Naidoo',
      role: 'site_owner',
      mobile_verified_at: new Date('2025-04-10T09:00:00+02:00'),
      email_verified_at: new Date('2025-04-10T09:10:00+02:00'),
    },
  });

  const siteOwner2 = await prisma.siteOwner.create({
    data: {
      user_id: siteOwner2User.id,
      trading_name: 'Spice Jar',
      business_category: 'Café',
      company_reg_number: '2021/112233/07',
      vat_number: null,
      bank_account_ref: 'absa_tok_7e3f1a2b',
      payout_verified_at: new Date('2025-04-15T11:00:00+02:00'),
      site_score: 55,
      score_tier: 'silver',
    },
  });
  console.log('  ✓ Created site owners');

  // ─── Operator 1: Kefilwe Sithole (street food) ───
  const operator1User = await prisma.user.create({
    data: {
      email: 'kefilwe.sithole@gmail.com',
      mobile: '+27855678901',
      full_name: 'Kefilwe Sithole',
      role: 'operator',
      mobile_verified_at: new Date('2025-05-01T10:00:00+02:00'),
      email_verified_at: new Date('2025-05-01T10:15:00+02:00'),
    },
  });

  const operator1 = await prisma.operator.create({
    data: {
      user_id: operator1User.id,
      trading_concept: 'Township-inspired street food — Kota burgers, chakalaka chicken wings, and pap stacks. Targeting late-night diners and early morning breakfast crowds.',
      food_category: 'Street Food',
      emergency_contact_name: 'Nomsa Sithole',
      emergency_contact_mobile: '+27866789012',
      bank_account_ref: 'std_tok_9c4d2e3f',
      payout_verified_at: new Date('2025-05-10T12:00:00+02:00'),
      trust_score: 68,
      activation_fee_balance: 0,
      vetting_status: 'approved',
      vetting_approved_at: new Date('2025-05-08T15:00:00+02:00'),
    },
  });

  // ─── Operator 2: Marco van der Berg (pizza) ───
  const operator2User = await prisma.user.create({
    data: {
      email: 'marco.vdberg@firewoodpizza.co.za',
      mobile: '+27877890123',
      full_name: 'Marco van der Berg',
      role: 'operator',
      mobile_verified_at: new Date('2025-05-15T11:00:00+02:00'),
      email_verified_at: new Date('2025-05-15T11:20:00+02:00'),
    },
  });

  const operator2 = await prisma.operator.create({
    data: {
      user_id: operator2User.id,
      trading_concept: 'Authentic Neapolitan wood-fired pizza using locally sourced toppings. Serving Friday–Sunday evenings targeting the upmarket dinner crowd.',
      food_category: 'Pizza',
      emergency_contact_name: 'Anke van der Berg',
      emergency_contact_mobile: '+27888901234',
      bank_account_ref: 'ned_tok_2a7b8c9d',
      payout_verified_at: new Date('2025-05-20T09:00:00+02:00'),
      trust_score: 81,
      activation_fee_balance: 0,
      vetting_status: 'approved',
      vetting_approved_at: new Date('2025-05-18T14:00:00+02:00'),
    },
  });

  // ─── Operator 3: Ayesha Cassim (baked goods) — still in vetting ───
  const operator3User = await prisma.user.create({
    data: {
      email: 'ayesha.cassim@sugarandspice.co.za',
      mobile: '+27899012345',
      full_name: 'Ayesha Cassim',
      role: 'operator',
      mobile_verified_at: new Date('2026-03-20T14:00:00+02:00'),
      email_verified_at: new Date('2026-03-20T14:10:00+02:00'),
    },
  });

  const operator3 = await prisma.operator.create({
    data: {
      user_id: operator3User.id,
      trading_concept: 'Premium Cape Malay baked goods — koeksisters, melktert, and savoury pies. Early morning bake-and-dispatch operation targeting wholesale café clients.',
      food_category: 'Bakery',
      emergency_contact_name: 'Farouk Cassim',
      emergency_contact_mobile: '+27810123456',
      bank_account_ref: null,
      payout_verified_at: null,
      trust_score: 50,
      activation_fee_balance: 80000,
      vetting_status: 'pending',
      vetting_approved_at: null,
    },
  });
  console.log('  ✓ Created operators');

  // ─── Site 1: Thabo's Kitchen, Sandton ───
  const site1 = await prisma.site.create({
    data: {
      site_owner_id: siteOwner1.id,
      landlord_partner_id: landlordPartner.id,
      trading_name: "Thabo's Kitchen",
      business_category: 'Restaurant',
      address_line1: '15 Rivonia Road',
      suburb: 'Sandton',
      city: 'Johannesburg',
      latitude: -26.1076,
      longitude: 28.0567,
      site_opens_time: '07:00',
      site_closes_time: '22:00',
      zombie_end_time: '06:00',
      monthly_rent_cents: 3500000,   // R35,000
      monthly_utilities_cents: 450000, // R4,500
      site_operating_hours_per_month: 450,
      hourly_rate_cents: 8778,         // (35000+4500)/450 * 100
      consent_status: 'landlord_verified',
      site_score: 72,
      score_tier: 'gold',
      is_listed: true,
    },
  });

  // Checklist items for site 1
  const checklistItems1 = await Promise.all([
    prisma.siteChecklistItem.create({
      data: {
        site_id: site1.id,
        area_name: 'Main Kitchen Prep Area',
        area_category: 'kitchen',
        sort_order: 1,
        is_required: true,
        description: 'All surfaces wiped, equipment returned to original positions, no food debris.',
      },
    }),
    prisma.siteChecklistItem.create({
      data: {
        site_id: site1.id,
        area_name: 'Industrial 6-Burner Stove',
        area_category: 'equipment',
        sort_order: 2,
        is_required: true,
        description: 'Burners off, drip trays cleaned, hood filter checked.',
      },
    }),
    prisma.siteChecklistItem.create({
      data: {
        site_id: site1.id,
        area_name: 'Cold Room / Walk-in Fridge',
        area_category: 'kitchen',
        sort_order: 3,
        is_required: true,
        description: 'Door sealed, no perishables left, temperature between 0–4°C.',
      },
    }),
    prisma.siteChecklistItem.create({
      data: {
        site_id: site1.id,
        area_name: 'Back Door & Delivery Entrance',
        area_category: 'security',
        sort_order: 4,
        is_required: true,
        description: 'Door locked with deadbolt, no props or obstructions.',
      },
    }),
  ]);

  // Slots for site 1 (zombie hours: 22:00–06:00, Tue–Sun)
  const slot1a = await prisma.siteSlot.create({
    data: {
      site_id: site1.id,
      day_of_week: 'tue',
      is_closed_day: false,
      slot_start_time: '22:00',
      slot_end_time: '06:00',
      slot_hours: 8,
      base_fee_cents_per_session: 70224,  // 8 × R702.24
      upside_model: 'fixed',
      upside_fixed_pct: 12.0,
      upside_variable_pct: null,
      status: 'booked',
    },
  });

  const slot1b = await prisma.siteSlot.create({
    data: {
      site_id: site1.id,
      day_of_week: 'fri',
      is_closed_day: false,
      slot_start_time: '22:00',
      slot_end_time: '06:00',
      slot_hours: 8,
      base_fee_cents_per_session: 70224,
      upside_model: 'variable',
      upside_fixed_pct: null,
      upside_variable_pct: 18.0,
      status: 'open',
    },
  });

  // ─── Site 2: Spice Jar, Cape Town ───
  const site2 = await prisma.site.create({
    data: {
      site_owner_id: siteOwner2.id,
      landlord_partner_id: null,
      trading_name: 'Spice Jar Café',
      business_category: 'Café',
      address_line1: '42 Bree Street',
      suburb: 'Cape Town City Bowl',
      city: 'Cape Town',
      latitude: -33.9249,
      longitude: 18.4241,
      site_opens_time: '07:00',
      site_closes_time: '17:00',
      zombie_end_time: '06:00',
      monthly_rent_cents: 1800000,  // R18,000
      monthly_utilities_cents: 280000, // R2,800
      site_operating_hours_per_month: 260,
      hourly_rate_cents: 8000,       // (18000+2800)/260 * 100
      consent_status: 'uploaded',
      site_score: 55,
      score_tier: 'silver',
      is_listed: true,
    },
  });

  // Checklist items for site 2
  const checklistItems2 = await Promise.all([
    prisma.siteChecklistItem.create({
      data: {
        site_id: site2.id,
        area_name: 'Espresso Bar & Coffee Equipment',
        area_category: 'equipment',
        sort_order: 1,
        is_required: true,
        description: 'Machine off, portafilters emptied and rinsed, steam wands wiped.',
      },
    }),
    prisma.siteChecklistItem.create({
      data: {
        site_id: site2.id,
        area_name: 'Kitchen Prep Counter',
        area_category: 'kitchen',
        sort_order: 2,
        is_required: true,
        description: 'Surfaces sanitised, knives in block, cutting boards washed.',
      },
    }),
    prisma.siteChecklistItem.create({
      data: {
        site_id: site2.id,
        area_name: 'Front Door & Roller Shutter',
        area_category: 'security',
        sort_order: 3,
        is_required: true,
        description: 'Roller shutter padlocked, alarm set to stay mode.',
      },
    }),
  ]);

  // Slot for site 2
  const slot2a = await prisma.siteSlot.create({
    data: {
      site_id: site2.id,
      day_of_week: 'sat',
      is_closed_day: false,
      slot_start_time: '17:00',
      slot_end_time: '01:00',
      slot_hours: 8,
      base_fee_cents_per_session: 64000,  // 8 × R640
      upside_model: 'fixed',
      upside_fixed_pct: 10.0,
      upside_variable_pct: null,
      status: 'open',
    },
  });
  console.log('  ✓ Created sites and slots');

  // ─── Booking Request ───
  const bookingRequest1 = await prisma.bookingRequest.create({
    data: {
      site_slot_id: slot1a.id,
      operator_id: operator1.id,
      concept_summary: 'Late-night kota and street food operation targeting Sandton club-goers and late-night workers. Trading 22:00–05:00 on Tuesdays.',
      requested_start_date: new Date('2025-06-01'),
      recurring: true,
      status: 'approved',
      site_owner_response_at: new Date('2025-05-25T14:00:00+02:00'),
      expires_at: new Date('2025-05-28T23:59:59+02:00'),
    },
  });
  console.log('  ✓ Created booking request');

  // ─── Contract ───
  const contract1 = await prisma.contract.create({
    data: {
      contract_ref: 'ZT-C-0001',
      site_slot_id: slot1a.id,
      operator_id: operator1.id,
      booking_request_id: bookingRequest1.id,
      hourly_rate_cents: 8778,
      upside_model: 'fixed',
      upside_pct: 12.0,
      platform_fee_pct: 10.0,
      notice_period_days: 30,
      goodwill_threshold_sessions: 6,
      goodwill_fee_pct: 8.0,
      deactivation_fee_pct: 15.0,
      status: 'active',
      site_owner_signed_at: new Date('2025-05-26T10:30:00+02:00'),
      operator_signed_at: new Date('2025-05-26T11:00:00+02:00'),
    },
  });
  console.log('  ✓ Created contract');

  // ─── Sessions (6 historical + 1 upcoming) ───
  const sessionDates = [
    new Date('2025-06-03'),
    new Date('2025-06-10'),
    new Date('2025-06-17'),
    new Date('2025-06-24'),
    new Date('2025-07-01'),
    new Date('2025-07-08'),
  ];

  const completedSessions = [];
  for (let i = 0; i < sessionDates.length; i++) {
    const date = sessionDates[i];
    const start = new Date(date);
    start.setHours(22, 0, 0, 0);
    const end = new Date(date);
    end.setDate(end.getDate() + 1);
    end.setHours(6, 0, 0, 0);

    const grossRevenue = 180000 + Math.floor(Math.random() * 120000); // R1,800–R3,000

    const session = await prisma.session.create({
      data: {
        session_ref: `ZT-S-${String(i + 1).padStart(4, '0')}`,
        contract_id: contract1.id,
        session_date: date,
        scheduled_start: start,
        scheduled_end: end,
        actual_start: new Date(start.getTime() + 3 * 60000), // 3 min late
        actual_end: new Date(end.getTime() - 10 * 60000),    // 10 min early
        site_owner_handover_signed_at: new Date(start.getTime() + 1 * 60000),
        operator_handover_signed_at: new Date(start.getTime() + 3 * 60000),
        gross_revenue_cents: grossRevenue,
        status: 'completed',
        before_photos_complete: true,
        after_photos_complete: true,
        lockup_complete: true,
        ai_handover_score: 85 + Math.floor(Math.random() * 15),
        ai_flags_count: i === 2 ? 1 : 0, // one slightly flagged session
        site_owner_confirmed_at: new Date(end.getTime() + 6 * 3600000), // 6 hrs after end
        site_owner_confirmed_good_order: true,
      },
    });
    completedSessions.push(session);
  }

  // Upcoming scheduled session
  const upcomingDate = new Date('2026-04-07'); // Tomorrow from seeding date
  const upcomingStart = new Date(upcomingDate);
  upcomingStart.setHours(22, 0, 0, 0);
  const upcomingEnd = new Date(upcomingDate);
  upcomingEnd.setDate(upcomingEnd.getDate() + 1);
  upcomingEnd.setHours(6, 0, 0, 0);

  const upcomingSession = await prisma.session.create({
    data: {
      session_ref: 'ZT-S-0007',
      contract_id: contract1.id,
      session_date: upcomingDate,
      scheduled_start: upcomingStart,
      scheduled_end: upcomingEnd,
      gross_revenue_cents: 0,
      status: 'scheduled',
      before_photos_complete: false,
      after_photos_complete: false,
      lockup_complete: false,
    },
  });
  console.log(`  ✓ Created ${completedSessions.length + 1} sessions`);

  // ─── Settlements (weekly, one per completed week) ───
  for (let i = 0; i < completedSessions.length; i++) {
    const s = completedSessions[i];
    const gross = Number(s.gross_revenue_cents);
    const platformFee = Math.round(gross * 0.10);
    const siteFee = 70224; // base session fee
    const upsideFixed = Math.round(siteFee * 0.12);
    const totalSiteFee = siteFee + upsideFixed;
    const landlordShare = i === 0 ? Math.round(totalSiteFee * 0.025) : 0; // first site has landlord
    const operatorPayout = gross - platformFee - totalSiteFee - landlordShare;

    const periodStart = new Date(s.session_date);
    const periodEnd = new Date(s.session_date);
    periodEnd.setDate(periodEnd.getDate() + 6);

    const settlement = await prisma.settlement.create({
      data: {
        operator_id: operator1.id,
        settlement_ref: `ZT-P-${String(i + 1).padStart(4, '0')}`,
        period_start: periodStart,
        period_end: periodEnd,
        gross_revenue_cents: gross,
        platform_fee_cents: platformFee,
        site_fees_cents: totalSiteFee,
        landlord_share_cents: landlordShare,
        penalty_deductions_cents: 0,
        activation_deduction_cents: 0,
        operator_payout_cents: operatorPayout,
        status: 'released',
        released_at: new Date(periodEnd.getTime() + 12 * 3600000),
        payment_provider_ref: `PP-${Date.now()}-${i}`,
      },
    });

    // Line items
    await prisma.settlementLineItem.createMany({
      data: [
        {
          settlement_id: settlement.id,
          session_id: s.id,
          site_slot_id: slot1a.id,
          line_type: 'revenue',
          amount_cents: gross,
          description: `Gross revenue - ${s.session_ref}`,
        },
        {
          settlement_id: settlement.id,
          session_id: s.id,
          site_slot_id: slot1a.id,
          line_type: 'platform_fee',
          amount_cents: -platformFee,
          description: `ZombieTech platform fee (10%) - ${s.session_ref}`,
        },
        {
          settlement_id: settlement.id,
          session_id: s.id,
          site_slot_id: slot1a.id,
          line_type: 'site_fee',
          amount_cents: -totalSiteFee,
          description: `Site fee + 12% upside - ${s.session_ref}`,
        },
      ],
    });
  }
  console.log('  ✓ Created settlements and line items');

  // ─── Vetting records for approved operators ───
  const vettingChecks = [
    { check_type: 'id_biometric', provider: 'Smile Identity', result: 'pass', confidence: 97.5 },
    { check_type: 'address', provider: 'Smile Identity', result: 'pass', confidence: 91.0 },
    { check_type: 'criminal', provider: 'MIE', result: 'pass', confidence: 100.0 },
    { check_type: 'cipc', provider: 'MIE', result: 'pass', confidence: 88.0 },
    { check_type: 'aml_pep', provider: 'LexisNexis', result: 'pass', confidence: 99.0 },
    { check_type: 'food_cert', provider: 'Manual', result: 'pass', confidence: 100.0 },
  ] as const;

  for (const op of [operator1, operator2]) {
    for (const check of vettingChecks) {
      await prisma.vettingRecord.create({
        data: {
          operator_id: op.id,
          check_type: check.check_type,
          provider: check.provider,
          provider_ref: `REF-${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
          result: check.result,
          confidence_score: check.confidence,
          raw_response: { status: 'pass', timestamp: new Date().toISOString() },
          flag_reason: null,
          requires_manual_review: false,
          reviewed_by: null,
        },
      });
    }
  }

  // Pending check for operator 3
  await prisma.vettingRecord.create({
    data: {
      operator_id: operator3.id,
      check_type: 'id_biometric',
      provider: 'Smile Identity',
      provider_ref: `REF-${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
      result: 'pending',
      confidence_score: null,
      raw_response: Prisma.DbNull,
      requires_manual_review: false,
    },
  });
  console.log('  ✓ Created vetting records');

  // ─── Trust score events for operator 1 ───
  let scoreNow = 50;
  for (let i = 0; i < completedSessions.length; i++) {
    const delta = 2; // clean_session
    await prisma.trustScoreEvent.create({
      data: {
        subject_user_id: operator1User.id,
        contract_id: contract1.id,
        session_id: completedSessions[i].id,
        event_type: 'clean_session',
        points_delta: delta,
        score_before: scoreNow,
        score_after: scoreNow + delta,
        description: `Clean session completed — ${completedSessions[i].session_ref}`,
      },
    });
    scoreNow += delta;
  }
  // Update operator trust score
  await prisma.operator.update({
    where: { id: operator1.id },
    data: { trust_score: scoreNow },
  });
  console.log('  ✓ Created trust score events');

  // ─── Audit log entries ───
  await prisma.auditLog.createMany({
    data: [
      {
        actor_user_id: adminUser.id,
        event_type: 'platform.seeded',
        entity_type: 'system',
        entity_id: '00000000-0000-0000-0000-000000000000',
        payload: { message: 'Database seeded with test data', timestamp: new Date().toISOString() },
      },
      {
        actor_user_id: siteOwner1User.id,
        event_type: 'contract.signed',
        entity_type: 'contract',
        entity_id: contract1.id,
        payload: { contract_ref: 'ZT-C-0001', role: 'site_owner' },
      },
      {
        actor_user_id: operator1User.id,
        event_type: 'contract.signed',
        entity_type: 'contract',
        entity_id: contract1.id,
        payload: { contract_ref: 'ZT-C-0001', role: 'operator' },
      },
    ],
  });
  console.log('  ✓ Created audit log entries');

  console.log('\n✅ Seed complete!');
  console.log('\nTest accounts:');
  console.log('  Admin:       admin@zombietech.co.za');
  console.log('  Site Owner 1: thabo.mokoena@thaboskitchen.co.za');
  console.log('  Site Owner 2: priya.naidoo@spicejarsa.co.za');
  console.log('  Operator 1:  kefilwe.sithole@gmail.com (approved)');
  console.log('  Operator 2:  marco.vdberg@firewoodpizza.co.za (approved)');
  console.log('  Operator 3:  ayesha.cassim@sugarandspice.co.za (pending vetting)');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
