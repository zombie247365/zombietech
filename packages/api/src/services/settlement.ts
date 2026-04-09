import { prisma } from '@zombietech/database';
import { AppError } from '../middleware/errorHandler';

/**
 * Settlement calculation engine.
 *
 * Settlement covers all completed, non-cancelled, non-disputed sessions for
 * an operator within a given period.
 *
 * Fee waterfall (all in cents):
 *   gross_revenue
 *   - platform_fee        (contract.platform_fee_pct × gross_revenue)
 *   - site_fee            (session's site slot base_fee_cents_per_session)
 *   - landlord_share      (site.landlord_partner.revenue_share_pct × site_fee, if applicable)
 *   - activation_deduct   (min(40_000, remaining_balance) per session, until balance = 0)
 *   - penalty_deductions  (awarded dispute amounts against operator)
 *   ──────────────────────────────────────────────────────────────────────
 *   = operator_payout
 */

export interface SettlementInput {
  operatorId: string;
  periodStart: Date;
  periodEnd: Date;
}

export interface CalculatedSettlement {
  operatorId: string;
  periodStart: Date;
  periodEnd: Date;
  sessionCount: number;
  grossRevenueCents: bigint;
  platformFeeCents: bigint;
  siteFeesCents: bigint;
  landlordShareCents: bigint;
  activationDeductionCents: bigint;
  penaltyDeductionsCents: bigint;
  operatorPayoutCents: bigint;
  lineItems: LineItem[];
}

interface LineItem {
  sessionId: string;
  siteSlotId: string;
  lineType: 'revenue' | 'platform_fee' | 'site_fee' | 'landlord_share' | 'penalty' | 'activation';
  amountCents: bigint;
  description: string;
}

/** Maximum activation fee deduction per session (R400 = 40 000 cents) */
const ACTIVATION_DEDUCTION_PER_SESSION = BigInt(40_000);

export async function calculateSettlement(input: SettlementInput): Promise<CalculatedSettlement> {
  const { operatorId, periodStart, periodEnd } = input;

  // ── Load operator (we need activation_fee_balance) ────────────────────────
  const operator = await prisma.operator.findUnique({
    where: { id: operatorId },
    select: { id: true, activation_fee_balance: true },
  });
  if (!operator) throw new AppError(404, 'Operator not found', 'NOT_FOUND');

  // ── Load all eligible sessions in period ──────────────────────────────────
  // "Eligible" = completed sessions within the period, not under open dispute
  const sessions = await prisma.session.findMany({
    where: {
      status: 'completed',
      session_date: { gte: periodStart, lte: periodEnd },
      contract: { operator_id: operatorId },
      // Exclude sessions with open/under_review disputes
      disputes: { none: { status: { in: ['open', 'under_review'] } } },
    },
    include: {
      contract: {
        select: {
          platform_fee_pct: true,
          site_slot: {
            select: {
              id: true,
              base_fee_cents_per_session: true,
              site: {
                select: {
                  landlord_partner_id: true,
                  landlord_partner: {
                    select: { revenue_share_pct: true },
                  },
                },
              },
            },
          },
        },
      },
      // Load resolved disputes where operator was found liable
      disputes: {
        where: { status: 'resolved', admin_decision: { in: ['award_full', 'award_partial'] } },
        select: { awarded_amount_cents: true, dispute_ref: true },
      },
    },
  });

  if (sessions.length === 0) {
    return {
      operatorId,
      periodStart,
      periodEnd,
      sessionCount: 0,
      grossRevenueCents: BigInt(0),
      platformFeeCents: BigInt(0),
      siteFeesCents: BigInt(0),
      landlordShareCents: BigInt(0),
      activationDeductionCents: BigInt(0),
      penaltyDeductionsCents: BigInt(0),
      operatorPayoutCents: BigInt(0),
      lineItems: [],
    };
  }

  const lineItems: LineItem[] = [];
  let totalGross = BigInt(0);
  let totalPlatformFee = BigInt(0);
  let totalSiteFees = BigInt(0);
  let totalLandlordShare = BigInt(0);
  let totalActivationDeduction = BigInt(0);
  let totalPenalties = BigInt(0);

  // Running balance so deductions don't go negative within the batch
  let remainingActivationBalance = BigInt(operator.activation_fee_balance);

  for (const session of sessions) {
    const grossRevenue = session.gross_revenue_cents ?? BigInt(0);
    const platformFeePct = Number(session.contract.platform_fee_pct);
    const siteSlot = session.contract.site_slot;
    const siteFee = siteSlot.base_fee_cents_per_session;
    const landlordPartner = siteSlot.site.landlord_partner;

    // ── Revenue line ──────────────────────────────────────────────────────
    lineItems.push({
      sessionId: session.id,
      siteSlotId: siteSlot.id,
      lineType: 'revenue',
      amountCents: grossRevenue,
      description: `Gross revenue — session ${session.session_ref}`,
    });
    totalGross += grossRevenue;

    // ── Platform fee (10%) ────────────────────────────────────────────────
    const platformFee = BigInt(Math.round(Number(grossRevenue) * platformFeePct / 100));
    lineItems.push({
      sessionId: session.id,
      siteSlotId: siteSlot.id,
      lineType: 'platform_fee',
      amountCents: -platformFee,
      description: `ZombieTech platform fee (${platformFeePct}%) — ${session.session_ref}`,
    });
    totalPlatformFee += platformFee;

    // ── Site fee ──────────────────────────────────────────────────────────
    lineItems.push({
      sessionId: session.id,
      siteSlotId: siteSlot.id,
      lineType: 'site_fee',
      amountCents: -siteFee,
      description: `Site fee — ${session.session_ref}`,
    });
    totalSiteFees += siteFee;

    // ── Landlord share (if applicable) ────────────────────────────────────
    if (landlordPartner) {
      const landlordPct = Number(landlordPartner.revenue_share_pct);
      const landlordShare = BigInt(Math.round(Number(siteFee) * landlordPct / 100));
      lineItems.push({
        sessionId: session.id,
        siteSlotId: siteSlot.id,
        lineType: 'landlord_share',
        amountCents: -landlordShare,
        description: `Landlord partner share (${landlordPct}%) — ${session.session_ref}`,
      });
      totalLandlordShare += landlordShare;
    }

    // ── Activation fee deduction (R400/session until balance = 0) ─────────
    if (remainingActivationBalance > BigInt(0)) {
      const deduction =
        remainingActivationBalance < ACTIVATION_DEDUCTION_PER_SESSION
          ? remainingActivationBalance
          : ACTIVATION_DEDUCTION_PER_SESSION;
      lineItems.push({
        sessionId: session.id,
        siteSlotId: siteSlot.id,
        lineType: 'activation',
        amountCents: -deduction,
        description: `Activation fee deduction (R${Number(deduction) / 100}) — ${session.session_ref}`,
      });
      totalActivationDeduction += deduction;
      remainingActivationBalance -= deduction;
    }

    // ── Penalty deductions (resolved disputes against operator) ───────────
    for (const dispute of session.disputes) {
      const penalty = dispute.awarded_amount_cents ?? BigInt(0);
      if (penalty > BigInt(0)) {
        lineItems.push({
          sessionId: session.id,
          siteSlotId: siteSlot.id,
          lineType: 'penalty',
          amountCents: -penalty,
          description: `Dispute penalty (${dispute.dispute_ref}) — ${session.session_ref}`,
        });
        totalPenalties += penalty;
      }
    }
  }

  const operatorPayout =
    totalGross -
    totalPlatformFee -
    totalSiteFees -
    totalLandlordShare -
    totalActivationDeduction -
    totalPenalties;

  return {
    operatorId,
    periodStart,
    periodEnd,
    sessionCount: sessions.length,
    grossRevenueCents: totalGross,
    platformFeeCents: totalPlatformFee,
    siteFeesCents: totalSiteFees,
    landlordShareCents: totalLandlordShare,
    activationDeductionCents: totalActivationDeduction,
    penaltyDeductionsCents: totalPenalties,
    operatorPayoutCents: operatorPayout < BigInt(0) ? BigInt(0) : operatorPayout,
    lineItems,
  };
}

/**
 * Persist a calculated settlement into the database.
 * Returns the created Settlement record.
 */
export async function persistSettlement(calc: CalculatedSettlement) {
  // Generate settlement_ref: ZT-ST-{YYYYMMDD}-{random 4 digits}
  const dateStr = calc.periodEnd.toISOString().slice(0, 10).replace(/-/g, '');
  const rand = String(Math.floor(Math.random() * 9000) + 1000);
  const settlementRef = `ZT-ST-${dateStr}-${rand}`;

  return prisma.$transaction(async (tx) => {
    // Create settlement record
    const settlement = await tx.settlement.create({
      data: {
        operator_id: calc.operatorId,
        settlement_ref: settlementRef,
        period_start: calc.periodStart,
        period_end: calc.periodEnd,
        gross_revenue_cents: calc.grossRevenueCents,
        platform_fee_cents: calc.platformFeeCents,
        site_fees_cents: calc.siteFeesCents,
        landlord_share_cents: calc.landlordShareCents,
        penalty_deductions_cents: calc.penaltyDeductionsCents,
        activation_deduction_cents: calc.activationDeductionCents,
        operator_payout_cents: calc.operatorPayoutCents,
        status: 'ready',
      },
    });

    // Create line items
    await tx.settlementLineItem.createMany({
      data: calc.lineItems.map((li) => ({
        settlement_id: settlement.id,
        session_id: li.sessionId,
        site_slot_id: li.siteSlotId,
        line_type: li.lineType,
        amount_cents: li.amountCents,
        description: li.description,
      })),
    });

    // Deduct activation balance from operator
    if (calc.activationDeductionCents > BigInt(0)) {
      await tx.operator.update({
        where: { id: calc.operatorId },
        data: {
          activation_fee_balance: {
            decrement: Number(calc.activationDeductionCents),
          },
        },
      });
    }

    return settlement;
  });
}
