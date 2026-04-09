import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '@zombietech/database';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { auditLog } from '../middleware/auditLogger';
import { AppError } from '../middleware/errorHandler';
import { calculateSettlement, persistSettlement } from '../services/settlement';
import { runAutoRelease } from '../jobs/autoRelease';
import { initiatePayout } from '../services/payments';
import { sendSettlementSms } from '../services/sms';
import { sendNotification } from '../services/notifications';

/**
 * Settlement routes — mounted at /api/settlements
 *
 * POST /calculate      — calculate (and persist) a settlement for an operator/period
 * GET  /               — list settlements (admin: all, operator: own)
 * GET  /:id            — get settlement with line items
 * POST /:id/release    — release a ready settlement to the operator
 */

const router = Router();

// ── Validation schemas ────────────────────────────────────────────────────────

const calculateSchema = z.object({
  operator_id: z.string().uuid('operator_id must be a UUID'),
  period_start: z.string().datetime({ offset: false, message: 'period_start must be ISO 8601 date' }),
  period_end: z.string().datetime({ offset: false, message: 'period_end must be ISO 8601 date' }),
});

// ── POST /api/settlements/calculate ──────────────────────────────────────────
//
// Admin only. Calculates and persists a settlement for an operator over a
// given date range. Returns the created Settlement with all line items.
// A session is only included if:
//   - status = 'completed'
//   - session_date within [period_start, period_end]
//   - no open/under_review disputes

router.post(
  '/calculate',
  authenticate,
  requireRole('admin'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const parse = calculateSchema.safeParse(req.body);
      if (!parse.success) {
        throw new AppError(422, parse.error.issues.map((i) => i.message).join('; '), 'VALIDATION');
      }
      const { operator_id, period_start, period_end } = parse.data;

      const start = new Date(period_start);
      const end = new Date(period_end);
      if (end <= start) {
        throw new AppError(400, 'period_end must be after period_start', 'VALIDATION');
      }

      // Check operator exists
      const operator = await prisma.operator.findUnique({
        where: { id: operator_id },
        select: { id: true, user: { select: { full_name: true } } },
      });
      if (!operator) throw new AppError(404, 'Operator not found', 'NOT_FOUND');

      // Check for existing settlement that overlaps this period
      const overlapping = await prisma.settlement.findFirst({
        where: {
          operator_id,
          status: { in: ['pending', 'ready', 'released'] },
          period_start: { lte: end },
          period_end: { gte: start },
        },
      });
      if (overlapping) {
        throw new AppError(
          409,
          `A settlement (${overlapping.settlement_ref}) already exists for this operator covering this period`,
          'DUPLICATE_SETTLEMENT',
        );
      }

      const calc = await calculateSettlement({ operatorId: operator_id, periodStart: start, periodEnd: end });
      const settlement = await persistSettlement(calc);

      // Reload with line items
      const full = await prisma.settlement.findUnique({
        where: { id: settlement.id },
        include: { line_items: { orderBy: { created_at: 'asc' } } },
      });

      await auditLog(req, 'settlement.calculated', 'settlement', settlement.id, {
        operator_id,
        period_start,
        period_end,
        session_count: calc.sessionCount,
        operator_payout_cents: calc.operatorPayoutCents.toString(),
      });

      res.status(201).json({ success: true, data: full });
    } catch (err) {
      next(err);
    }
  },
);

// ── GET /api/settlements ──────────────────────────────────────────────────────
//
// Admin: all settlements. Operator: own settlements only.

router.get('/', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { status, operator_id, page = '1', limit = '20' } = req.query as Record<string, string>;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    // Non-admins can only see their own settlements
    let resolvedOperatorId = operator_id;
    if (req.user!.role !== 'admin') {
      const op = await prisma.operator.findUnique({ where: { user_id: req.user!.id }, select: { id: true } });
      if (!op) throw new AppError(403, 'Operator profile not found', 'FORBIDDEN');
      resolvedOperatorId = op.id;
    }

    const where: Record<string, unknown> = {};
    if (resolvedOperatorId) where['operator_id'] = resolvedOperatorId;
    if (status) where['status'] = status;

    const [settlements, total] = await Promise.all([
      prisma.settlement.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip,
        take: limitNum,
        include: {
          operator: { select: { user: { select: { full_name: true } } } },
        },
      }),
      prisma.settlement.count({ where }),
    ]);

    res.json({
      success: true,
      data: settlements,
      meta: { total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) },
    });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/settlements/:id ──────────────────────────────────────────────────

router.get('/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const settlement = await prisma.settlement.findUnique({
      where: { id: req.params.id },
      include: {
        operator: { select: { id: true, user: { select: { full_name: true, mobile: true } } } },
        line_items: { orderBy: [{ line_type: 'asc' }, { created_at: 'asc' }] },
      },
    });
    if (!settlement) throw new AppError(404, 'Settlement not found', 'NOT_FOUND');

    // Access check: admin or own settlement
    if (req.user!.role !== 'admin') {
      const op = await prisma.operator.findUnique({ where: { user_id: req.user!.id }, select: { id: true } });
      if (!op || op.id !== settlement.operator_id) {
        throw new AppError(403, 'Access denied', 'FORBIDDEN');
      }
    }

    res.json({ success: true, data: settlement });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/settlements/:id/release ────────────────────────────────────────
//
// Admin only. Marks a settlement as released and records the payment provider ref.
// In production this would trigger a Peach Payments payout. For now it just
// transitions the status and records the reference.

router.post(
  '/:id/release',
  authenticate,
  requireRole('admin'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const settlement = await prisma.settlement.findUnique({ where: { id: req.params.id } });
      if (!settlement) throw new AppError(404, 'Settlement not found', 'NOT_FOUND');

      if (!['ready', 'pending'].includes(settlement.status)) {
        throw new AppError(
          400,
          `Settlement cannot be released from status: ${settlement.status}`,
          'INVALID_STATE',
        );
      }

      const { payment_provider_ref } = req.body as { payment_provider_ref?: string };

      // Fetch operator bank account ref for payout
      const operatorFull = await prisma.operator.findUnique({
        where: { id: settlement.operator_id },
        include: { user: { select: { id: true, full_name: true, mobile: true } } },
      });

      // Initiate Peach Payments payout (non-blocking in dev, awaited in prod)
      let paymentRef = payment_provider_ref ?? null;
      if (operatorFull?.bank_account_ref) {
        const payoutResult = await initiatePayout({
          amount: Number(settlement.operator_payout_cents),
          currency: 'ZAR',
          reference: settlement.settlement_ref,
          recipientAccountRef: operatorFull.bank_account_ref,
          description: `ZombieTech settlement ${settlement.settlement_ref}`,
        });
        if (payoutResult.success && payoutResult.payoutId) {
          paymentRef = payoutResult.payoutId;
        }
      }

      const updated = await prisma.settlement.update({
        where: { id: req.params.id },
        data: {
          status: 'released',
          released_at: new Date(),
          payment_provider_ref: paymentRef,
        },
      });

      // Notify operator via push + SMS (non-blocking)
      if (operatorFull?.user) {
        const payoutRands = Number(settlement.operator_payout_cents) / 100;
        sendNotification({
          userId: operatorFull.user.id,
          mobile: operatorFull.user.mobile,
          title: 'Settlement released',
          body: `R${payoutRands.toFixed(2)} has been released for settlement ${settlement.settlement_ref}.`,
          type: 'settlement_released',
          entityId: settlement.id,
          entityType: 'settlement',
        }).catch(console.error);
        sendSettlementSms(operatorFull.user.mobile, settlement.settlement_ref, payoutRands).catch(console.error);
      }

      await auditLog(req, 'settlement.released', 'settlement', req.params.id, {
        operator_id: settlement.operator_id,
        operator_payout_cents: settlement.operator_payout_cents.toString(),
        payment_provider_ref: paymentRef,
        released_by: req.user!.id,
      });

      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  },
);

// ── POST /api/settlements/auto-release ────────────────────────────────────────
// Admin-only manual trigger for the Monday auto-release job.

router.post(
  '/auto-release',
  authenticate,
  requireRole('admin'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const result = await runAutoRelease();
      await auditLog(req, 'settlement.auto_release_triggered', 'settlement', 'batch', {
        triggered_by: req.user!.id,
        ...result,
      });
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
