import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Prisma } from '@zombietech/database';
import { prisma } from '@zombietech/database';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { auditLog } from '../middleware/auditLogger';
import { AppError } from '../middleware/errorHandler';

/**
 * Dispute routes — mounted at /api/disputes
 *
 * POST /              — raise a dispute against a session
 * GET  /              — list disputes (admin: all; site owner / operator: own)
 * GET  /:id           — get dispute detail with AI recommendation
 * POST /:id/resolve   — admin resolve with decision
 */

const router = Router();

// ── Validation schemas ────────────────────────────────────────────────────────

const createDisputeSchema = z.object({
  session_id: z.string().uuid('session_id must be a UUID'),
  claim_type: z.enum(['damage', 'cleaning', 'theft', 'breach', 'false_claim']),
  claim_amount_cents: z.number().int().positive('claim_amount_cents must be a positive integer'),
  description: z.string().min(20, 'description must be at least 20 characters'),
});

const resolveDisputeSchema = z.object({
  admin_decision: z.enum(['award_full', 'award_partial', 'reject']),
  awarded_amount_cents: z.number().int().min(0).optional(),
});

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Generate an AI recommendation stub for a dispute (real integration uses Claude API) */
async function generateAiRecommendation(disputeId: string): Promise<void> {
  // Load dispute with photo comparisons for the session
  const dispute = await prisma.dispute.findUnique({
    where: { id: disputeId },
    include: {
      session: {
        include: {
          photo_comparisons: {
            select: { ai_result: true, ai_confidence: true, ai_description: true },
          },
        },
      },
    },
  });
  if (!dispute) return;

  const comparisons = dispute.session.photo_comparisons;
  const flaggedCount = comparisons.filter((c) => c.ai_result === 'flagged').length;
  const cleanCount = comparisons.filter((c) => c.ai_result === 'clean').length;
  const total = comparisons.length;

  let recommendation: 'award_full' | 'award_partial' | 'reject';
  let confidence: number;
  let reasoning: string;

  if (total === 0) {
    recommendation = 'reject';
    confidence = 0.5;
    reasoning = 'No AI photo comparisons available for this session. Manual review required.';
  } else if (flaggedCount === 0) {
    recommendation = 'reject';
    confidence = 0.85;
    reasoning = `All ${cleanCount} photo comparison(s) returned clean. No photographic evidence of damage or breach.`;
  } else if (flaggedCount === total) {
    recommendation = 'award_full';
    confidence = 0.82;
    reasoning = `${flaggedCount} of ${total} photo comparison(s) flagged issues. Strong photographic evidence supports the claim.`;
  } else {
    recommendation = 'award_partial';
    confidence = 0.65;
    reasoning = `${flaggedCount} of ${total} photo comparison(s) flagged. Partial award recommended proportional to evidence.`;
  }

  await prisma.dispute.update({
    where: { id: disputeId },
    data: {
      ai_recommendation: recommendation,
      ai_confidence: confidence,
      ai_reasoning: reasoning,
      status: 'under_review',
    },
  });
}

// ── POST /api/disputes ────────────────────────────────────────────────────────
//
// Raises a dispute against a completed session.
// Only site owners and admins can raise disputes (operators can raise false_claim).
// A session can have at most one open dispute at a time.

router.post('/', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const parse = createDisputeSchema.safeParse(req.body);
    if (!parse.success) {
      throw new AppError(422, parse.error.issues.map((i) => i.message).join('; '), 'VALIDATION');
    }
    const { session_id, claim_type, claim_amount_cents, description } = parse.data;

    // Load session with access context
    const session = await prisma.session.findUnique({
      where: { id: session_id },
      include: {
        contract: {
          include: {
            operator: { select: { id: true, user_id: true } },
            site_slot: {
              include: {
                site: { select: { site_owner_id: true } },
              },
            },
          },
        },
      },
    });
    if (!session) throw new AppError(404, 'Session not found', 'NOT_FOUND');

    // Only completed or disputed sessions can have disputes raised
    if (!['completed', 'disputed'].includes(session.status)) {
      throw new AppError(
        400,
        `Disputes can only be raised on completed sessions. Session status: ${session.status}`,
        'INVALID_STATE',
      );
    }

    // Determine if user is site owner, operator, or admin on this session
    const operatorUserId = session.contract.operator.user_id;
    const siteOwnerId = session.contract.site_slot.site.site_owner_id;
    const siteOwnerUser = await prisma.siteOwner.findUnique({
      where: { id: siteOwnerId },
      select: { user_id: true },
    });

    const isOperator = req.user!.id === operatorUserId;
    const isSiteOwner = req.user!.id === (siteOwnerUser?.user_id ?? '');
    const isAdmin = req.user!.role === 'admin';

    if (!isOperator && !isSiteOwner && !isAdmin) {
      throw new AppError(403, 'Access denied', 'FORBIDDEN');
    }

    // Operators can only raise false_claim disputes
    if (isOperator && !isAdmin && claim_type !== 'false_claim') {
      throw new AppError(400, 'Operators may only raise false_claim disputes', 'FORBIDDEN');
    }

    // Enforce one active dispute per session
    const existingOpen = await prisma.dispute.findFirst({
      where: { session_id, status: { in: ['open', 'under_review'] } },
    });
    if (existingOpen) {
      throw new AppError(
        409,
        `An open dispute (${existingOpen.dispute_ref}) already exists for this session`,
        'DUPLICATE_DISPUTE',
      );
    }

    // Generate dispute_ref: ZT-D-NNNN
    const disputeCount = await prisma.dispute.count();
    const disputeRef = `ZT-D-${String(disputeCount + 1).padStart(4, '0')}`;

    // Deadline: 7 days from now
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + 7);

    const dispute = await prisma.dispute.create({
      data: {
        session_id,
        raised_by_user_id: req.user!.id,
        dispute_ref: disputeRef,
        claim_type,
        claim_amount_cents: BigInt(claim_amount_cents),
        description,
        status: 'open',
        deadline_at: deadline,
      },
    });

    // Update session status to 'disputed'
    await prisma.session.update({
      where: { id: session_id },
      data: { status: 'disputed' },
    });

    await auditLog(req, 'dispute.raised', 'dispute', dispute.id, {
      session_id,
      dispute_ref: disputeRef,
      claim_type,
      claim_amount_cents,
      raised_by: req.user!.id,
    });

    // Run AI recommendation asynchronously (non-blocking)
    generateAiRecommendation(dispute.id).catch((err) =>
      console.error('[disputes] AI recommendation failed:', err),
    );

    res.status(201).json({ success: true, data: dispute });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/disputes ─────────────────────────────────────────────────────────

router.get('/', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { status, session_id, page = '1', limit = '20' } = req.query as Record<string, string>;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    // Build access-scoped filter
    const where: Prisma.DisputeWhereInput = {};
    if (status) where.status = status as Prisma.DisputeWhereInput['status'];
    if (session_id) where.session_id = session_id;

    if (req.user!.role !== 'admin') {
      // Non-admins see only disputes they raised or that involve their session
      where.raised_by_user_id = req.user!.id;
    }

    const [disputes, total] = await Promise.all([
      prisma.dispute.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip,
        take: limitNum,
        include: {
          session: { select: { session_ref: true, session_date: true } },
        },
      }),
      prisma.dispute.count({ where }),
    ]);

    res.json({
      success: true,
      data: disputes,
      meta: { total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) },
    });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/disputes/:id ─────────────────────────────────────────────────────

router.get('/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const dispute = await prisma.dispute.findUnique({
      where: { id: req.params.id },
      include: {
        session: {
          include: {
            photo_comparisons: {
              include: {
                checklist_item: { select: { area_name: true, sort_order: true } },
                before_photo: { select: { id: true, storage_key: true } },
                after_photo: { select: { id: true, storage_key: true } },
              },
            },
          },
        },
        raised_by: { select: { full_name: true, role: true } },
        decided_by: { select: { full_name: true } },
      },
    });
    if (!dispute) throw new AppError(404, 'Dispute not found', 'NOT_FOUND');

    // Access: admin, or user who raised the dispute
    if (req.user!.role !== 'admin' && req.user!.id !== dispute.raised_by_user_id) {
      throw new AppError(403, 'Access denied', 'FORBIDDEN');
    }

    res.json({ success: true, data: dispute });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/disputes/:id/resolve ────────────────────────────────────────────
//
// Admin only. Record the admin decision and awarded amount.
// - award_full: full claim_amount_cents awarded
// - award_partial: awarded_amount_cents (required in body) awarded
// - reject: no award
// On resolution, if an open settlement exists for the operator, it is held.

router.post(
  '/:id/resolve',
  authenticate,
  requireRole('admin'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const dispute = await prisma.dispute.findUnique({
        where: { id: req.params.id },
        include: {
          session: {
            include: {
              contract: { select: { operator_id: true } },
            },
          },
        },
      });
      if (!dispute) throw new AppError(404, 'Dispute not found', 'NOT_FOUND');

      if (dispute.status === 'resolved') {
        throw new AppError(400, 'Dispute is already resolved', 'INVALID_STATE');
      }

      const parse = resolveDisputeSchema.safeParse(req.body);
      if (!parse.success) {
        throw new AppError(422, parse.error.issues.map((i) => i.message).join('; '), 'VALIDATION');
      }
      const { admin_decision, awarded_amount_cents } = parse.data;

      // Determine awarded amount
      let awardedCents: bigint;
      if (admin_decision === 'award_full') {
        awardedCents = dispute.claim_amount_cents;
      } else if (admin_decision === 'award_partial') {
        if (awarded_amount_cents === undefined) {
          throw new AppError(400, 'awarded_amount_cents required for award_partial', 'VALIDATION');
        }
        if (BigInt(awarded_amount_cents) > dispute.claim_amount_cents) {
          throw new AppError(400, 'awarded_amount_cents cannot exceed claim_amount_cents', 'VALIDATION');
        }
        awardedCents = BigInt(awarded_amount_cents);
      } else {
        awardedCents = BigInt(0);
      }

      const resolved = await prisma.$transaction(async (tx) => {
        // Update dispute
        const updated = await tx.dispute.update({
          where: { id: req.params.id },
          data: {
            admin_decision,
            admin_decided_by: req.user!.id,
            awarded_amount_cents: awardedCents,
            status: 'resolved',
            resolved_at: new Date(),
          },
        });

        // Revert session to 'completed'
        await tx.session.update({
          where: { id: dispute.session_id },
          data: { status: 'completed' },
        });

        // If award > 0: hold any pending/ready settlement for this operator
        if (awardedCents > BigInt(0)) {
          await tx.settlement.updateMany({
            where: {
              operator_id: dispute.session.contract.operator_id,
              status: { in: ['pending', 'ready'] },
            },
            data: { status: 'held' },
          });
        }

        return updated;
      });

      await auditLog(req, 'dispute.resolved', 'dispute', req.params.id, {
        admin_decision,
        awarded_amount_cents: awardedCents.toString(),
        session_id: dispute.session_id,
        resolved_by: req.user!.id,
      });

      res.json({ success: true, data: resolved });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
