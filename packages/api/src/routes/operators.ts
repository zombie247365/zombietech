import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '@zombietech/database';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { auditLog } from '../middleware/auditLogger';
import { AppError } from '../middleware/errorHandler';
import { ACTIVATION_FEE_CENTS } from '@zombietech/shared';

const router = Router();

// ── Schemas ───────────────────────────────────────────────────────────────────

const updateProfileSchema = z.object({
  trading_concept: z.string().min(10).max(1000).optional(),
  food_category: z.string().min(2).max(100).optional(),
  emergency_contact_name: z.string().min(2).max(255).optional(),
  emergency_contact_mobile: z.string().regex(/^\+27[0-9]{9}$/).optional(),
});

const initiateVettingSchema = z.object({
  // IDs of documents to use for each check
  id_document_id: z.string().uuid(),
  proof_of_address_id: z.string().uuid(),
  food_cert_id: z.string().uuid().optional(),
  insurance_id: z.string().uuid().optional(),
});

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getOperatorProfile(userId: string) {
  const profile = await prisma.operator.findUnique({ where: { user_id: userId } });
  if (!profile) throw new AppError(403, 'Operator profile not found', 'NO_PROFILE');
  return profile;
}

/**
 * Stub for third-party vetting API calls.
 * Phase 3+ will call Smile Identity, MIE, LexisNexis in parallel.
 */
async function triggerExternalCheck(
  checkType: string,
  operatorId: string,
  documentId: string,
): Promise<{ provider_ref: string; result: 'pass' | 'fail' | 'flag' | 'pending' }> {
  // In dev / no-API mode, return pending immediately
  // Production: dispatch to external provider and store webhook callback
  return {
    provider_ref: `DEV-${checkType.toUpperCase()}-${Date.now()}`,
    result: 'pending',
  };
}

// ── GET /api/operators/profile  (own profile) ─────────────────────────────

router.get('/profile', authenticate, requireRole('operator'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const operator = await prisma.operator.findUnique({
      where: { user_id: req.user!.id },
      include: {
        user: { select: { id: true, full_name: true, email: true, mobile: true, mobile_verified_at: true } },
        vetting_records: { orderBy: { created_at: 'asc' } },
        contracts: {
          where: { status: { in: ['active', 'in_notice'] } },
          take: 5,
          include: { site_slot: { include: { site: { select: { trading_name: true, address_line1: true, suburb: true, city: true } } } } },
        },
      },
    });
    if (!operator) throw new AppError(404, 'Operator profile not found', 'NOT_FOUND');
    res.json({ success: true, data: operator });
  } catch (err) {
    next(err);
  }
});

// ── PUT /api/operators/profile ────────────────────────────────────────────

router.put('/profile', authenticate, requireRole('operator'), validate(updateProfileSchema), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const operator = await getOperatorProfile(req.user!.id);
    const body = req.body as z.infer<typeof updateProfileSchema>;

    const updated = await prisma.operator.update({
      where: { id: operator.id },
      data: body,
    });

    await auditLog(req, 'operator.profile_updated', 'operator', operator.id, { fields: Object.keys(body) });
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/operators/vetting/initiate ──────────────────────────────────

router.post('/vetting/initiate', authenticate, requireRole('operator'), validate(initiateVettingSchema), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const operator = await getOperatorProfile(req.user!.id);
    const body = req.body as z.infer<typeof initiateVettingSchema>;

    if (operator.vetting_status === 'approved') {
      throw new AppError(400, 'Operator is already approved', 'ALREADY_APPROVED');
    }
    if (operator.vetting_status === 'suspended') {
      throw new AppError(403, 'Account suspended — contact support', 'SUSPENDED');
    }

    // Verify documents belong to this user
    const docIds = [body.id_document_id, body.proof_of_address_id, body.food_cert_id, body.insurance_id].filter(Boolean) as string[];
    const docs = await prisma.document.findMany({
      where: { id: { in: docIds }, owner_user_id: req.user!.id },
    });
    if (docs.length !== docIds.length) {
      throw new AppError(400, 'One or more document IDs are invalid or not yours', 'INVALID_DOCUMENTS');
    }

    // Clear any previous pending vetting records
    await prisma.vettingRecord.deleteMany({
      where: { operator_id: operator.id, result: 'pending' },
    });

    // Required checks
    const checksToRun: Array<{ check_type: string; provider: string; document_id: string }> = [
      { check_type: 'id_biometric', provider: 'Smile Identity', document_id: body.id_document_id },
      { check_type: 'address', provider: 'Smile Identity', document_id: body.proof_of_address_id },
      { check_type: 'criminal', provider: 'MIE', document_id: body.id_document_id },
      { check_type: 'cipc', provider: 'MIE', document_id: body.id_document_id },
      { check_type: 'aml_pep', provider: 'LexisNexis', document_id: body.id_document_id },
    ];
    if (body.food_cert_id) checksToRun.push({ check_type: 'food_cert', provider: 'Manual', document_id: body.food_cert_id });
    if (body.insurance_id) checksToRun.push({ check_type: 'insurance', provider: 'Manual', document_id: body.insurance_id });

    const records = await Promise.all(
      checksToRun.map(async (check) => {
        const external = await triggerExternalCheck(check.check_type, operator.id, check.document_id);
        return prisma.vettingRecord.create({
          data: {
            operator_id: operator.id,
            check_type: check.check_type as 'id_biometric' | 'address' | 'criminal' | 'cipc' | 'aml_pep' | 'food_cert' | 'insurance' | 'credit',
            provider: check.provider,
            provider_ref: external.provider_ref,
            result: external.result,
            requires_manual_review: false,
          },
        });
      }),
    );

    // Update vetting status to pending
    await prisma.operator.update({
      where: { id: operator.id },
      data: { vetting_status: 'pending' },
    });

    await auditLog(req, 'vetting.initiated', 'operator', operator.id, {
      checks_initiated: checksToRun.length,
      document_ids: docIds,
    });

    res.status(201).json({
      success: true,
      data: {
        vetting_status: 'pending',
        checks_initiated: records.length,
        records,
        message: 'Vetting checks have been initiated. You will be notified once complete.',
      },
    });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/operators/vetting/status ─────────────────────────────────────

router.get('/vetting/status', authenticate, requireRole('operator'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const operator = await getOperatorProfile(req.user!.id);

    const records = await prisma.vettingRecord.findMany({
      where: { operator_id: operator.id },
      orderBy: { created_at: 'desc' },
      // Do not expose raw API responses to the client
      select: {
        id: true, check_type: true, provider: true, result: true,
        confidence_score: true, flag_reason: true, requires_manual_review: true,
        reviewed_at: true, created_at: true,
      },
    });

    res.json({
      success: true,
      data: {
        vetting_status: operator.vetting_status,
        vetting_approved_at: operator.vetting_approved_at,
        checks: records,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/operators/:operatorId/status  (admin access) ─────────────────

router.get('/:operatorId/status', authenticate, requireRole('admin'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const operator = await prisma.operator.findUnique({
      where: { id: req.params.operatorId },
      include: {
        user: { select: { id: true, full_name: true, email: true, mobile: true } },
        vetting_records: { orderBy: { created_at: 'asc' } },
      },
    });
    if (!operator) throw new AppError(404, 'Operator not found', 'NOT_FOUND');
    res.json({ success: true, data: operator });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/operators/:operatorId/approve  (admin) ──────────────────────

router.post('/:operatorId/approve', authenticate, requireRole('admin'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const operator = await prisma.operator.findUnique({ where: { id: req.params.operatorId } });
    if (!operator) throw new AppError(404, 'Operator not found', 'NOT_FOUND');
    if (operator.vetting_status === 'approved') throw new AppError(400, 'Already approved', 'ALREADY_APPROVED');

    const updated = await prisma.operator.update({
      where: { id: operator.id },
      data: {
        vetting_status: 'approved',
        vetting_approved_at: new Date(),
      },
    });

    // Send notification to operator
    await prisma.notification.create({
      data: {
        user_id: operator.user_id,
        notification_type: 'vetting_complete',
        related_entity_id: operator.id,
        related_entity_type: 'operator',
        title: 'Vetting approved!',
        body: 'Your identity checks have passed. You can now book kitchen slots.',
        channel: 'push',
        status: 'pending',
      },
    });

    await auditLog(req, 'vetting.approved', 'operator', operator.id, { approved_by: req.user!.id });
    res.json({ success: true, data: { vetting_status: updated.vetting_status, vetting_approved_at: updated.vetting_approved_at } });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/operators/:operatorId/reject  (admin) ───────────────────────

router.post('/:operatorId/reject', authenticate, requireRole('admin'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { reason } = req.body as { reason?: string };
    const operator = await prisma.operator.findUnique({ where: { id: req.params.operatorId } });
    if (!operator) throw new AppError(404, 'Operator not found', 'NOT_FOUND');

    await prisma.operator.update({
      where: { id: operator.id },
      data: { vetting_status: 'rejected' },
    });

    await prisma.notification.create({
      data: {
        user_id: operator.user_id,
        notification_type: 'vetting_complete',
        related_entity_id: operator.id,
        related_entity_type: 'operator',
        title: 'Vetting unsuccessful',
        body: reason ?? 'Your identity verification did not pass. Contact support for details.',
        channel: 'push',
        status: 'pending',
      },
    });

    await auditLog(req, 'vetting.rejected', 'operator', operator.id, { rejected_by: req.user!.id, reason });
    res.json({ success: true, data: { vetting_status: 'rejected' } });
  } catch (err) {
    next(err);
  }
});

export default router;
