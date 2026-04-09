import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '@zombietech/database';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { auditLog } from '../middleware/auditLogger';
import { AppError } from '../middleware/errorHandler';
import { config } from '../config';
import { OTP_EXPIRES_MINUTES } from '@zombietech/shared';
import { _scheduleNextSession } from './contracts';
import { runSessionComparisons } from '../services/photoComparison';

const router = Router();

// ── Schemas ───────────────────────────────────────────────────────────────────

const createSessionSchema = z.object({
  contract_id: z.string().uuid(),
  session_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const startSessionSchema = z.object({
  otp: z.string().length(6),
  role: z.enum(['site_owner', 'operator']),
});

const endSessionSchema = z.object({
  gross_revenue_cents: z.number().int().nonnegative(),
});

const handoverOtpSchema = z.object({
  otp: z.string().length(6),
  role: z.enum(['site_owner', 'operator']),
});

// ── Helpers ───────────────────────────────────────────────────────────────────

async function sendHandoverOtp(userId: string): Promise<string> {
  const otp = config.isDev && config.otp.bypassInDev
    ? config.otp.devOtp
    : String(Math.floor(100000 + Math.random() * 900000));

  const hash = await bcrypt.hash(otp, 10);
  const expiresAt = new Date(Date.now() + OTP_EXPIRES_MINUTES * 60 * 1000);

  await prisma.user.update({
    where: { id: userId },
    data: { otp_hash: hash, otp_expires_at: expiresAt },
  });

  if (config.isDev) console.log(`[DEV HANDOVER OTP] user=${userId}: ${otp}`);
  return otp;
}

async function verifyHandoverOtp(userId: string, otp: string): Promise<void> {
  if (config.isDev && otp === config.otp.devOtp) return;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.otp_hash || !user.otp_expires_at) {
    throw new AppError(400, 'No handover OTP requested — call /request-handover-otp first', 'NO_OTP');
  }
  if (new Date() > user.otp_expires_at) throw new AppError(400, 'Handover OTP expired', 'OTP_EXPIRED');
  const valid = await bcrypt.compare(otp, user.otp_hash);
  if (!valid) throw new AppError(400, 'Invalid OTP', 'INVALID_OTP');

  await prisma.user.update({
    where: { id: userId },
    data: { otp_hash: null, otp_expires_at: null },
  });
}

async function getSessionParties(sessionId: string) {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      contract: {
        include: {
          site_slot: { include: { site: { include: { site_owner: true } } } },
          operator: true,
        },
      },
    },
  });
  if (!session) throw new AppError(404, 'Session not found', 'NOT_FOUND');
  return session;
}

// ── POST /api/sessions  (manually create a session on a contract) ──────────

router.post('/', authenticate, validate(createSessionSchema), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { contract_id, session_date } = req.body as z.infer<typeof createSessionSchema>;

    const contract = await prisma.contract.findUnique({
      where: { id: contract_id },
      include: {
        site_slot: { include: { site: { include: { site_owner: true } } } },
        operator: true,
      },
    });
    if (!contract) throw new AppError(404, 'Contract not found', 'NOT_FOUND');
    if (contract.status !== 'active' && contract.status !== 'in_notice') {
      throw new AppError(400, 'Contract is not active', 'INVALID_STATE');
    }

    // Access: site owner or operator on this contract, or admin
    const siteOwnerUserId = contract.site_slot.site.site_owner.user_id;
    const operatorUserId = contract.operator.user_id;
    if (req.user!.id !== siteOwnerUserId && req.user!.id !== operatorUserId && req.user!.role !== 'admin') {
      throw new AppError(403, 'Not a party to this contract', 'FORBIDDEN');
    }

    const slot = contract.site_slot;
    const date = new Date(session_date);
    const [startH, startM] = slot.slot_start_time.split(':').map(Number);
    const [endH, endM] = slot.slot_end_time.split(':').map(Number);

    const scheduledStart = new Date(date);
    scheduledStart.setHours(startH, startM, 0, 0);

    const scheduledEnd = new Date(date);
    if (endH < startH || (endH === startH && endM < startM)) {
      scheduledEnd.setDate(scheduledEnd.getDate() + 1);
    }
    scheduledEnd.setHours(endH, endM, 0, 0);

    // Check for duplicate
    const duplicate = await prisma.session.findFirst({
      where: { contract_id, session_date: date, status: { not: 'cancelled' } },
    });
    if (duplicate) throw new AppError(409, 'A session already exists for this date on this contract', 'DUPLICATE');

    const count = await prisma.session.count({ where: { contract_id } });
    const sessionRef = `ZT-S-${String(count + 1).padStart(4, '0')}`;

    const session = await prisma.session.create({
      data: {
        session_ref: sessionRef,
        contract_id,
        session_date: date,
        scheduled_start: scheduledStart,
        scheduled_end: scheduledEnd,
        status: 'scheduled',
        gross_revenue_cents: BigInt(0),
      },
    });

    await auditLog(req, 'session.created', 'session', session.id, {
      session_ref: sessionRef,
      contract_id,
      session_date,
    });

    res.status(201).json({ success: true, data: session });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/sessions ─────────────────────────────────────────────────────

router.get('/', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { status, contract_id } = req.query as Record<string, string>;
    let where: Record<string, unknown> = {};

    if (req.user!.role === 'operator') {
      const operator = await prisma.operator.findUnique({ where: { user_id: req.user!.id } });
      if (!operator) throw new AppError(403, 'No profile', 'NO_PROFILE');
      where.contract = { operator_id: operator.id };
    } else if (req.user!.role === 'site_owner') {
      const siteOwner = await prisma.siteOwner.findUnique({ where: { user_id: req.user!.id } });
      if (!siteOwner) throw new AppError(403, 'No profile', 'NO_PROFILE');
      where.contract = { site_slot: { site: { site_owner_id: siteOwner.id } } };
    }

    if (status) where.status = status;
    if (contract_id) where.contract_id = contract_id;

    const sessions = await prisma.session.findMany({
      where,
      orderBy: { session_date: 'desc' },
      take: 50,
      include: {
        contract: {
          include: {
            site_slot: { include: { site: { select: { trading_name: true, address_line1: true, suburb: true, city: true } } } },
            operator: { include: { user: { select: { full_name: true } } } },
          },
        },
        _count: { select: { session_photos: true, disputes: true } },
      },
    });

    res.json({ success: true, data: sessions });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/sessions/:id ─────────────────────────────────────────────────

router.get('/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const session = await getSessionParties(req.params.id);

    const siteOwnerUserId = session.contract.site_slot.site.site_owner.user_id;
    const operatorUserId = session.contract.operator.user_id;
    if (req.user!.id !== siteOwnerUserId && req.user!.id !== operatorUserId && req.user!.role !== 'admin') {
      throw new AppError(403, 'Access denied', 'FORBIDDEN');
    }

    const full = await prisma.session.findUnique({
      where: { id: req.params.id },
      include: {
        contract: {
          include: {
            site_slot: { include: { site: { include: { site_checklist_items: { orderBy: { sort_order: 'asc' } } } } } },
            operator: { include: { user: { select: { full_name: true, mobile: true } } } },
          },
        },
        session_photos: { orderBy: { created_at: 'asc' } },
        photo_comparisons: true,
        disputes: true,
      },
    });

    res.json({ success: true, data: full });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/sessions/:id/request-handover-otp ───────────────────────────

router.post('/:id/request-handover-otp', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const session = await getSessionParties(req.params.id);
    const siteOwnerUserId = session.contract.site_slot.site.site_owner.user_id;
    const operatorUserId = session.contract.operator.user_id;

    if (req.user!.id !== siteOwnerUserId && req.user!.id !== operatorUserId) {
      throw new AppError(403, 'Not a party to this session', 'FORBIDDEN');
    }
    if (session.status !== 'scheduled') {
      throw new AppError(400, `Session is ${session.status} — handover only applies to scheduled sessions`, 'INVALID_STATE');
    }

    const devOtp = await sendHandoverOtp(req.user!.id);
    res.json({
      success: true,
      data: {
        message: 'Handover OTP sent to your mobile',
        expires_in_seconds: OTP_EXPIRES_MINUTES * 60,
        ...(config.isDev ? { dev_otp: devOtp } : {}),
      },
    });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/sessions/:id/start  (dual-OTP handover) ─────────────────────
/**
 * Business rule: A session cannot move from scheduled → active until BOTH
 * the site owner AND the operator have submitted valid OTPs.
 * actual_start is set the moment the second OTP lands.
 */
router.post('/:id/start', authenticate, validate(startSessionSchema), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { otp } = req.body as { otp: string; role: string };
    const session = await getSessionParties(req.params.id);

    if (session.status !== 'scheduled') {
      throw new AppError(400, `Session is already ${session.status}`, 'INVALID_STATE');
    }

    const siteOwnerUserId = session.contract.site_slot.site.site_owner.user_id;
    const operatorUserId = session.contract.operator.user_id;
    const isSiteOwner = req.user!.id === siteOwnerUserId;
    const isOperator = req.user!.id === operatorUserId;

    if (!isSiteOwner && !isOperator) throw new AppError(403, 'Not a party to this session', 'FORBIDDEN');

    // Check already signed for this side
    if (isSiteOwner && session.site_owner_handover_signed_at) {
      throw new AppError(400, 'Site owner has already submitted their handover OTP', 'ALREADY_SIGNED');
    }
    if (isOperator && session.operator_handover_signed_at) {
      throw new AppError(400, 'Operator has already submitted their handover OTP', 'ALREADY_SIGNED');
    }

    await verifyHandoverOtp(req.user!.id, otp);

    const now = new Date();
    const updateData: Record<string, unknown> = {};
    if (isSiteOwner) updateData.site_owner_handover_signed_at = now;
    if (isOperator) updateData.operator_handover_signed_at = now;

    // Check if the other party has already signed
    const otherSigned = isSiteOwner
      ? session.operator_handover_signed_at !== null
      : session.site_owner_handover_signed_at !== null;

    if (otherSigned) {
      // Both parties have signed — activate the session
      updateData.status = 'active';
      updateData.actual_start = now;
    }

    const updated = await prisma.session.update({ where: { id: session.id }, data: updateData });

    await auditLog(req, isSiteOwner ? 'session.site_owner_handover_signed' : 'session.operator_handover_signed', 'session', session.id, {
      session_ref: session.session_ref,
      activated: !!otherSigned,
    });

    res.json({
      success: true,
      data: {
        ...updated,
        message: otherSigned
          ? 'Session is now ACTIVE. Both parties have confirmed handover.'
          : `Waiting for the ${isSiteOwner ? 'operator' : 'site owner'} to confirm handover.`,
        activated: !!otherSigned,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/sessions/:id/end ────────────────────────────────────────────

router.post('/:id/end', authenticate, validate(endSessionSchema), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { gross_revenue_cents } = req.body as z.infer<typeof endSessionSchema>;
    const session = await getSessionParties(req.params.id);

    if (session.status !== 'active') {
      throw new AppError(400, `Session must be active to end — current status: ${session.status}`, 'INVALID_STATE');
    }

    const operatorUserId = session.contract.operator.user_id;
    if (req.user!.id !== operatorUserId && req.user!.role !== 'admin') {
      throw new AppError(403, 'Only the operator or admin can end a session', 'FORBIDDEN');
    }

    // ── Checklist gate: lockup must be complete before session can close ──────
    // Re-fetch session to get current flags
    const freshSession = await prisma.session.findUnique({
      where: { id: session.id },
      select: {
        lockup_complete: true,
        after_photos_complete: true,
        before_photos_complete: true,
        contract: {
          select: {
            site_slot: {
              select: {
                site: {
                  select: {
                    site_checklist_items: { select: { id: true, is_required: true, area_name: true, sort_order: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (freshSession) {
      const requiredItems = freshSession.contract.site_slot.site.site_checklist_items.filter(
        (ci) => ci.is_required,
      );

      if (requiredItems.length > 0) {
        // Check which required items have lockup photos
        const lockupPhotos = await prisma.sessionPhoto.findMany({
          where: {
            session_id: session.id,
            photo_type: 'lockup',
            checklist_item_id: { in: requiredItems.map((ci) => ci.id) },
          },
          select: { checklist_item_id: true },
        });

        const completedIds = new Set(lockupPhotos.map((p) => p.checklist_item_id));
        const incomplete = requiredItems.filter((ci) => !completedIds.has(ci.id));

        if (incomplete.length > 0) {
          const names = incomplete
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((ci) => `#${ci.sort_order} "${ci.area_name}"`)
            .join(', ');
          throw new AppError(
            400,
            `Session cannot close until all lock-up checklist items are complete. Missing: ${names}`,
            'LOCKUP_INCOMPLETE',
          );
        }

        // Check after photos for all required items
        const afterPhotos = await prisma.sessionPhoto.findMany({
          where: {
            session_id: session.id,
            photo_type: 'after',
            checklist_item_id: { in: requiredItems.map((ci) => ci.id) },
          },
          select: { checklist_item_id: true },
        });

        const afterCompletedIds = new Set(afterPhotos.map((p) => p.checklist_item_id));
        const missingAfter = requiredItems.filter((ci) => !afterCompletedIds.has(ci.id));

        if (missingAfter.length > 0) {
          const names = missingAfter
            .map((ci) => `#${ci.sort_order} "${ci.area_name}"`)
            .join(', ');
          throw new AppError(
            400,
            `After photos are required for all checklist areas before closing. Missing: ${names}`,
            'AFTER_PHOTOS_INCOMPLETE',
          );
        }
      }
    }

    const now = new Date();
    const updated = await prisma.session.update({
      where: { id: session.id },
      data: {
        status: 'completed',
        actual_end: now,
        gross_revenue_cents: BigInt(gross_revenue_cents),
        lockup_complete: true,
        after_photos_complete: true,
      },
    });

    // Run AI photo comparisons asynchronously (don't block the response)
    runSessionComparisons(session.id).catch((err) =>
      console.error(`[AI] Session comparison failed for ${session.id}:`, err),
    );

    // Schedule next weekly session if contract is still active
    const contract = await prisma.contract.findUnique({ where: { id: session.contract_id } });
    if (contract?.status === 'active') {
      const nextDate = new Date(session.session_date);
      nextDate.setDate(nextDate.getDate() + 7);
      await _scheduleNextSession(contract.id, contract.site_slot_id, nextDate).catch((err) =>
        console.error('[sessions] Failed to schedule next session:', err),
      );
    }

    await auditLog(req, 'session.ended', 'session', session.id, {
      session_ref: session.session_ref,
      gross_revenue_cents,
      ended_by: req.user!.id,
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/sessions/:id/confirm  (site owner confirms good order) ───────

router.post('/:id/confirm', authenticate, requireRole('site_owner'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { good_order = true } = req.body as { good_order?: boolean };
    const session = await getSessionParties(req.params.id);

    const siteOwnerUserId = session.contract.site_slot.site.site_owner.user_id;
    if (req.user!.id !== siteOwnerUserId) throw new AppError(403, 'Not your site', 'FORBIDDEN');
    if (session.status !== 'completed') throw new AppError(400, 'Session must be completed to confirm', 'INVALID_STATE');
    if (session.site_owner_confirmed_at) throw new AppError(400, 'Already confirmed', 'ALREADY_CONFIRMED');

    const updated = await prisma.session.update({
      where: { id: session.id },
      data: {
        site_owner_confirmed_at: new Date(),
        site_owner_confirmed_good_order: good_order,
      },
    });

    await auditLog(req, 'session.confirmed', 'session', session.id, { good_order, confirmed_by: req.user!.id });
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/sessions/:id/cancel ────────────────────────────────────────

router.post('/:id/cancel', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { reason } = req.body as { reason?: string };
    const session = await getSessionParties(req.params.id);

    const siteOwnerUserId = session.contract.site_slot.site.site_owner.user_id;
    const operatorUserId = session.contract.operator.user_id;
    if (req.user!.id !== siteOwnerUserId && req.user!.id !== operatorUserId && req.user!.role !== 'admin') {
      throw new AppError(403, 'Not a party to this session', 'FORBIDDEN');
    }
    if (!['scheduled'].includes(session.status)) {
      throw new AppError(400, 'Only scheduled sessions can be cancelled', 'INVALID_STATE');
    }

    await prisma.session.update({
      where: { id: session.id },
      data: { status: 'cancelled' },
    });

    await auditLog(req, 'session.cancelled', 'session', session.id, {
      cancelled_by: req.user!.id,
      reason,
    });

    res.json({ success: true, data: { status: 'cancelled' } });
  } catch (err) {
    next(err);
  }
});

export default router;
