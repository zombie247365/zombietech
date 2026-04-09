import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '@zombietech/database';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { auditLog } from '../middleware/auditLogger';
import { AppError } from '../middleware/errorHandler';
import { config } from '../config';
import {
  PLATFORM_FEE_PCT, DEFAULT_NOTICE_PERIOD_DAYS, GOODWILL_THRESHOLD_SESSIONS,
  GOODWILL_FEE_PCT, DEACTIVATION_FEE_PCT, ACTIVATION_FEE_CENTS, OTP_EXPIRES_MINUTES,
} from '@zombietech/shared';

const router = Router();

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Generate next sequential contract ref e.g. ZT-C-0042 */
async function nextContractRef(): Promise<string> {
  const last = await prisma.contract.findFirst({ orderBy: { created_at: 'desc' } });
  if (!last) return 'ZT-C-0001';
  const n = parseInt(last.contract_ref.replace('ZT-C-', ''), 10) + 1;
  return `ZT-C-${String(n).padStart(4, '0')}`;
}

/** Send OTP to user mobile for contract signing */
async function sendSigningOtp(userId: string): Promise<string> {
  const otp = config.isDev && config.otp.bypassInDev
    ? config.otp.devOtp
    : String(Math.floor(100000 + Math.random() * 900000));

  const hash = await bcrypt.hash(otp, 10);
  const expiresAt = new Date(Date.now() + OTP_EXPIRES_MINUTES * 60 * 1000);

  await prisma.user.update({
    where: { id: userId },
    data: { otp_hash: hash, otp_expires_at: expiresAt },
  });

  if (config.isDev) {
    console.log(`[DEV SIGNING OTP] user=${userId}: ${otp}`);
  }

  return otp; // returned only in dev response
}

// ── Schemas ───────────────────────────────────────────────────────────────────

const createContractSchema = z.object({
  booking_request_id: z.string().uuid(),
});

const signContractSchema = z.object({
  otp: z.string().length(6),
});

// ── POST /api/contracts  (generate from approved booking) ─────────────────

router.post('/', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { booking_request_id } = req.body as z.infer<typeof createContractSchema>;
    if (!booking_request_id) throw new AppError(422, 'booking_request_id is required', 'VALIDATION');

    const booking = await prisma.bookingRequest.findUnique({
      where: { id: booking_request_id },
      include: {
        site_slot: { include: { site: { include: { site_owner: true } } } },
        operator: true,
      },
    });
    if (!booking) throw new AppError(404, 'Booking request not found', 'NOT_FOUND');
    if (booking.status !== 'approved') throw new AppError(400, 'Booking must be approved before contract generation', 'INVALID_STATE');

    // Only the operator or the site owner can initiate contract generation
    const siteOwnerId = booking.site_slot.site.site_owner.user_id;
    const operatorUserId = booking.operator.user_id;
    if (req.user!.id !== siteOwnerId && req.user!.id !== operatorUserId && req.user!.role !== 'admin') {
      throw new AppError(403, 'Access denied', 'FORBIDDEN');
    }

    // Check a contract doesn't already exist for this booking
    const existing = await prisma.contract.findFirst({ where: { booking_request_id } });
    if (existing) {
      return res.json({ success: true, data: existing, already_exists: true });
    }

    const slot = booking.site_slot;
    const contractRef = await nextContractRef();

    const contract = await prisma.contract.create({
      data: {
        contract_ref: contractRef,
        site_slot_id: slot.id,
        operator_id: booking.operator_id,
        booking_request_id: booking.id,
        // Lock commercial terms at signing time
        hourly_rate_cents: slot.site.hourly_rate_cents,
        upside_model: slot.upside_model,
        upside_pct: slot.upside_model === 'fixed'
          ? (slot.upside_fixed_pct ?? 0)
          : (slot.upside_variable_pct ?? 0),
        platform_fee_pct: PLATFORM_FEE_PCT,
        notice_period_days: DEFAULT_NOTICE_PERIOD_DAYS,
        goodwill_threshold_sessions: GOODWILL_THRESHOLD_SESSIONS,
        goodwill_fee_pct: GOODWILL_FEE_PCT,
        deactivation_fee_pct: DEACTIVATION_FEE_PCT,
        status: 'active',
      },
    });

    await auditLog(req, 'contract.generated', 'contract', contract.id, {
      contract_ref: contractRef,
      booking_request_id,
      operator_id: booking.operator_id,
    });

    res.status(201).json({ success: true, data: contract });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/contracts ────────────────────────────────────────────────────

router.get('/', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { status } = req.query as { status?: string };
    let where: Record<string, unknown> = {};

    if (req.user!.role === 'operator') {
      const operator = await prisma.operator.findUnique({ where: { user_id: req.user!.id } });
      if (!operator) throw new AppError(403, 'No profile', 'NO_PROFILE');
      where = { operator_id: operator.id };
    } else if (req.user!.role === 'site_owner') {
      const siteOwner = await prisma.siteOwner.findUnique({ where: { user_id: req.user!.id } });
      if (!siteOwner) throw new AppError(403, 'No profile', 'NO_PROFILE');
      where = { site_slot: { site: { site_owner_id: siteOwner.id } } };
    }

    if (status) where.status = status;

    const contracts = await prisma.contract.findMany({
      where,
      include: {
        site_slot: { include: { site: { select: { trading_name: true, address_line1: true, suburb: true, city: true } } } },
        operator: { include: { user: { select: { full_name: true, email: true } } } },
        _count: { select: { sessions: true } },
      },
      orderBy: { created_at: 'desc' },
    });

    res.json({ success: true, data: contracts });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/contracts/:id ────────────────────────────────────────────────

router.get('/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const contract = await prisma.contract.findUnique({
      where: { id: req.params.id },
      include: {
        site_slot: { include: { site: { include: { site_owner: { include: { user: { select: { full_name: true, email: true } } } }, site_checklist_items: { orderBy: { sort_order: 'asc' } } } } } },
        operator: { include: { user: { select: { full_name: true, email: true, mobile: true } } } },
        booking_request: true,
        sessions: { orderBy: { session_date: 'desc' }, take: 10 },
        _count: { select: { sessions: true } },
      },
    });
    if (!contract) throw new AppError(404, 'Contract not found', 'NOT_FOUND');

    // Access control
    const operator = req.user!.role === 'operator'
      ? await prisma.operator.findUnique({ where: { user_id: req.user!.id } })
      : null;
    const siteOwner = req.user!.role === 'site_owner'
      ? await prisma.siteOwner.findUnique({ where: { user_id: req.user!.id } })
      : null;

    const isOperator = operator && contract.operator_id === operator.id;
    const isSiteOwner = siteOwner && contract.site_slot.site.site_owner_id === siteOwner.id;
    if (!isOperator && !isSiteOwner && req.user!.role !== 'admin') {
      throw new AppError(403, 'Access denied', 'FORBIDDEN');
    }

    res.json({ success: true, data: contract });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/contracts/:id/request-signing-otp ───────────────────────────

router.post('/:id/request-signing-otp', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const contract = await prisma.contract.findUnique({
      where: { id: req.params.id },
      include: { site_slot: { include: { site: { include: { site_owner: true } } } }, operator: true },
    });
    if (!contract) throw new AppError(404, 'Contract not found', 'NOT_FOUND');

    const siteOwnerUserId = contract.site_slot.site.site_owner.user_id;
    const operatorUserId = contract.operator.user_id;
    if (req.user!.id !== siteOwnerUserId && req.user!.id !== operatorUserId) {
      throw new AppError(403, 'Only parties to this contract can request a signing OTP', 'FORBIDDEN');
    }

    const devOtp = await sendSigningOtp(req.user!.id);

    res.json({
      success: true,
      data: {
        message: 'Signing OTP sent to your registered mobile number',
        expires_in_seconds: OTP_EXPIRES_MINUTES * 60,
        ...(config.isDev ? { dev_otp: devOtp } : {}),
      },
    });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/contracts/:id/sign ──────────────────────────────────────────

router.post('/:id/sign', authenticate, validate(signContractSchema), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { otp } = req.body as { otp: string };

    const contract = await prisma.contract.findUnique({
      where: { id: req.params.id },
      include: {
        site_slot: { include: { site: { include: { site_owner: true } } } },
        operator: true,
        booking_request: true,
      },
    });
    if (!contract) throw new AppError(404, 'Contract not found', 'NOT_FOUND');
    if (contract.status !== 'active') throw new AppError(400, 'Contract is not active', 'INVALID_STATE');

    const siteOwnerUserId = contract.site_slot.site.site_owner.user_id;
    const operatorUserId = contract.operator.user_id;
    const isSiteOwner = req.user!.id === siteOwnerUserId;
    const isOperator = req.user!.id === operatorUserId;

    if (!isSiteOwner && !isOperator) {
      throw new AppError(403, 'Only parties to this contract can sign', 'FORBIDDEN');
    }
    if (isSiteOwner && contract.site_owner_signed_at) {
      throw new AppError(400, 'Site owner has already signed this contract', 'ALREADY_SIGNED');
    }
    if (isOperator && contract.operator_signed_at) {
      throw new AppError(400, 'Operator has already signed this contract', 'ALREADY_SIGNED');
    }

    // Verify OTP
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) throw new AppError(404, 'User not found', 'NOT_FOUND');

    const isDevBypass = config.isDev && otp === config.otp.devOtp;
    if (!isDevBypass) {
      if (!user.otp_hash || !user.otp_expires_at) {
        throw new AppError(400, 'No signing OTP was requested — call /request-signing-otp first', 'NO_OTP');
      }
      if (new Date() > user.otp_expires_at) {
        throw new AppError(400, 'Signing OTP has expired', 'OTP_EXPIRED');
      }
      const valid = await bcrypt.compare(otp, user.otp_hash);
      if (!valid) throw new AppError(400, 'Invalid OTP', 'INVALID_OTP');
    }

    // Clear OTP
    await prisma.user.update({
      where: { id: user.id },
      data: { otp_hash: null, otp_expires_at: null },
    });

    const now = new Date();
    const updateData: Record<string, unknown> = {};
    if (isSiteOwner) updateData.site_owner_signed_at = now;
    if (isOperator) {
      updateData.operator_signed_at = now;
      // Enforce activation fee on first ever contract
      const existingContracts = await prisma.contract.count({
        where: { operator_id: contract.operator_id, operator_signed_at: { not: null } },
      });
      if (existingContracts === 0) {
        await prisma.operator.update({
          where: { id: contract.operator_id },
          data: { activation_fee_balance: ACTIVATION_FEE_CENTS },
        });
      }
    }

    const updated = await prisma.contract.update({
      where: { id: contract.id },
      data: updateData,
    });

    // When both parties sign: mark the slot as booked
    const fullySignedNow = isSiteOwner
      ? (contract.operator_signed_at !== null)
      : (contract.site_owner_signed_at !== null);

    if (fullySignedNow) {
      await prisma.siteSlot.update({
        where: { id: contract.site_slot_id },
        data: { status: 'booked' },
      });

      // Auto-generate the first session for the next occurrence
      await _scheduleNextSession(contract.id, contract.site_slot_id, contract.booking_request.requested_start_date);
    }

    await auditLog(req, 'contract.signed', 'contract', contract.id, {
      signed_by: req.user!.id,
      role: isSiteOwner ? 'site_owner' : 'operator',
      contract_ref: contract.contract_ref,
      fully_signed: fullySignedNow,
    });

    res.json({
      success: true,
      data: {
        ...updated,
        fully_signed: fullySignedNow,
        message: fullySignedNow
          ? 'Contract is fully signed. First session has been scheduled.'
          : `Waiting for the ${isSiteOwner ? 'operator' : 'site owner'} to sign.`,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/contracts/:id/initiate-termination ──────────────────────────

router.post('/:id/initiate-termination', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const contract = await prisma.contract.findUnique({
      where: { id: req.params.id },
      include: {
        site_slot: { include: { site: { include: { site_owner: true } } } },
        operator: true,
      },
    });
    if (!contract) throw new AppError(404, 'Contract not found', 'NOT_FOUND');
    if (contract.status !== 'active') throw new AppError(400, 'Contract is not active', 'INVALID_STATE');

    const siteOwnerUserId = contract.site_slot.site.site_owner.user_id;
    const operatorUserId = contract.operator.user_id;
    const isSiteOwner = req.user!.id === siteOwnerUserId;
    const isOperator = req.user!.id === operatorUserId;

    if (!isSiteOwner && !isOperator && req.user!.role !== 'admin') {
      throw new AppError(403, 'Not a party to this contract', 'FORBIDDEN');
    }

    const terminatedBy = isSiteOwner ? 'site_owner' : isOperator ? 'operator' : 'mutual';

    await prisma.contract.update({
      where: { id: contract.id },
      data: { status: 'in_notice' },
    });

    await auditLog(req, 'contract.termination_initiated', 'contract', contract.id, {
      initiated_by: req.user!.id,
      terminated_by: terminatedBy,
      notice_period_days: contract.notice_period_days,
    });

    res.json({
      success: true,
      data: {
        status: 'in_notice',
        notice_period_days: contract.notice_period_days,
        message: `Termination notice issued. Contract ends after ${contract.notice_period_days} days or the last scheduled session in the notice window.`,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ── Internal helper: schedule the first session ────────────────────────────

async function _scheduleNextSession(contractId: string, slotId: string, requestedStartDate: Date): Promise<void> {
  const slot = await prisma.siteSlot.findUnique({ where: { id: slotId } });
  if (!slot) return;

  // Compute next occurrence on or after requested_start_date for this slot's day_of_week
  let sessionDate = new Date(requestedStartDate);
  if (slot.day_of_week) {
    const dayMap: Record<string, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
    const targetDay = dayMap[slot.day_of_week];
    while (sessionDate.getDay() !== targetDay) {
      sessionDate.setDate(sessionDate.getDate() + 1);
    }
  }

  const [startH, startM] = slot.slot_start_time.split(':').map(Number);
  const [endH, endM] = slot.slot_end_time.split(':').map(Number);

  const scheduledStart = new Date(sessionDate);
  scheduledStart.setHours(startH, startM, 0, 0);

  const scheduledEnd = new Date(sessionDate);
  // Handle overnight slots (end time earlier than start means next day)
  if (endH < startH || (endH === startH && endM < startM)) {
    scheduledEnd.setDate(scheduledEnd.getDate() + 1);
  }
  scheduledEnd.setHours(endH, endM, 0, 0);

  // Count existing sessions for ref generation
  const count = await prisma.session.count({ where: { contract_id: contractId } });
  const sessionRef = `ZT-S-${String(count + 1).padStart(4, '0')}`;

  await prisma.session.create({
    data: {
      session_ref: sessionRef,
      contract_id: contractId,
      session_date: sessionDate,
      scheduled_start: scheduledStart,
      scheduled_end: scheduledEnd,
      status: 'scheduled',
      gross_revenue_cents: BigInt(0),
    },
  });
}

export { _scheduleNextSession };
export default router;
