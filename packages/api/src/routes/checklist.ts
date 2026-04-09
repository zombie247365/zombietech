import { Router, Response, NextFunction } from 'express';
import { prisma } from '@zombietech/database';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { auditLog } from '../middleware/auditLogger';
import { AppError } from '../middleware/errorHandler';

/**
 * Lock-up checklist routes — mounted at /api/sessions/:id/checklist
 *
 * The lock-up sequence is the final step before a session can be closed.
 * Each checklist item must be completed in sort_order (sequential).
 * An item is "complete" when a lockup photo has been uploaded for it.
 * The session cannot move to closed until all required items are complete.
 */

const router = Router({ mergeParams: true });

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getSessionWithChecklist(sessionId: string) {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      contract: {
        include: {
          site_slot: {
            include: {
              site: {
                include: {
                  site_checklist_items: { orderBy: { sort_order: 'asc' } },
                },
              },
            },
          },
          operator: { select: { id: true, user_id: true } },
        },
      },
    },
  });
  if (!session) throw new AppError(404, 'Session not found', 'NOT_FOUND');
  return session;
}

// ── GET /api/sessions/:id/checklist ───────────────────────────────────────────
//
// Returns each checklist item enriched with:
//   - before_photo: the before photo for this item (if uploaded)
//   - lockup_photo: the lockup photo for this item (if uploaded)
//   - is_complete: true if lockup photo has been submitted
//   - is_unlocked: true if all prior items are complete (or this is #1)

router.get('/', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const sessionId = req.params.id;
    const session = await getSessionWithChecklist(sessionId);

    // Access: operator or site owner on this contract, or admin
    const operatorUserId = session.contract.operator.user_id;
    const siteOwnerUser = await prisma.siteOwner.findUnique({
      where: { id: session.contract.site_slot.site.site_owner_id },
      select: { user_id: true },
    });
    if (
      req.user!.id !== operatorUserId &&
      req.user!.id !== (siteOwnerUser?.user_id ?? '') &&
      req.user!.role !== 'admin'
    ) {
      throw new AppError(403, 'Access denied', 'FORBIDDEN');
    }

    const checklistItems = session.contract.site_slot.site.site_checklist_items;

    // Load all photos for this session in one query
    const photos = await prisma.sessionPhoto.findMany({
      where: { session_id: sessionId },
      select: {
        id: true,
        checklist_item_id: true,
        photo_type: true,
        storage_key: true,
        device_timestamp: true,
        created_at: true,
      },
    });

    const beforeByItem = new Map(
      photos.filter((p) => p.photo_type === 'before').map((p) => [p.checklist_item_id, p]),
    );
    const afterByItem = new Map(
      photos.filter((p) => p.photo_type === 'after').map((p) => [p.checklist_item_id, p]),
    );
    const lockupByItem = new Map(
      photos.filter((p) => p.photo_type === 'lockup').map((p) => [p.checklist_item_id, p]),
    );

    // Build enriched checklist
    const enriched = checklistItems.map((item, idx) => {
      const lockupPhoto = lockupByItem.get(item.id) ?? null;
      const isComplete = lockupPhoto !== null;

      // An item is unlocked when all prior required items are complete
      const priorItems = checklistItems.slice(0, idx);
      const priorRequiredComplete = priorItems
        .filter((ci) => ci.is_required)
        .every((ci) => lockupByItem.has(ci.id));

      const isUnlocked = idx === 0 || priorRequiredComplete;

      return {
        ...item,
        before_photo: beforeByItem.get(item.id) ?? null,
        after_photo: afterByItem.get(item.id) ?? null,
        lockup_photo: lockupPhoto,
        is_complete: isComplete,
        is_unlocked: isUnlocked,
      };
    });

    const totalRequired = checklistItems.filter((ci) => ci.is_required).length;
    const completedRequired = enriched.filter((ci) => ci.is_required && ci.is_complete).length;
    const allComplete = completedRequired === totalRequired;
    const nextIncomplete = enriched.find((ci) => ci.is_required && !ci.is_complete) ?? null;

    res.json({
      success: true,
      data: {
        session_id: sessionId,
        session_status: session.status,
        lockup_complete: session.lockup_complete,
        all_required_complete: allComplete,
        completed: completedRequired,
        total_required: totalRequired,
        next_item: nextIncomplete
          ? { id: nextIncomplete.id, sort_order: nextIncomplete.sort_order, area_name: nextIncomplete.area_name }
          : null,
        items: enriched,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/sessions/:id/checklist/:itemId/complete ─────────────────────────
//
// Mark a checklist item as complete. "Complete" means:
//   - A lockup photo has been uploaded for this item (enforced separately via photo upload)
//   - All prior items in sort_order are already complete (sequential enforcement)
//
// This endpoint exists as an explicit confirmation step, but the real gate is the
// photo upload endpoint. This allows admins to manually mark items complete if needed.

router.post(
  '/:itemId/complete',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id: sessionId, itemId } = req.params;
      const session = await getSessionWithChecklist(sessionId);

      // Only the operator or admin can mark items complete
      const operatorUserId = session.contract.operator.user_id;
      const isAdmin = req.user!.role === 'admin';
      if (req.user!.id !== operatorUserId && !isAdmin) {
        throw new AppError(403, 'Only the operator or admin can complete checklist items', 'FORBIDDEN');
      }

      if (session.status !== 'active') {
        throw new AppError(400, `Session must be active to complete checklist items. Status: ${session.status}`, 'INVALID_STATE');
      }

      const checklistItems = session.contract.site_slot.site.site_checklist_items;
      const item = checklistItems.find((ci) => ci.id === itemId);
      if (!item) {
        throw new AppError(404, 'Checklist item not found on this session\'s site', 'NOT_FOUND');
      }

      // ── Sequential enforcement ─────────────────────────────────────────────
      const priorRequired = checklistItems.filter(
        (ci) => ci.is_required && ci.sort_order < item.sort_order,
      );

      if (priorRequired.length > 0) {
        const completedLockups = await prisma.sessionPhoto.findMany({
          where: {
            session_id: sessionId,
            photo_type: 'lockup',
            checklist_item_id: { in: priorRequired.map((ci) => ci.id) },
          },
          select: { checklist_item_id: true },
        });

        const completedSet = new Set(completedLockups.map((p) => p.checklist_item_id));
        const blockers = priorRequired.filter((ci) => !completedSet.has(ci.id));

        if (blockers.length > 0) {
          const names = blockers.map((ci) => `#${ci.sort_order} "${ci.area_name}"`).join(', ');
          throw new AppError(
            400,
            `Complete these lock-up items first (in order): ${names}`,
            'LOCKUP_OUT_OF_ORDER',
          );
        }
      }

      // ── Verify lockup photo exists for this item ──────────────────────────
      const lockupPhoto = await prisma.sessionPhoto.findFirst({
        where: {
          session_id: sessionId,
          checklist_item_id: itemId,
          photo_type: 'lockup',
        },
      });

      if (!lockupPhoto && !isAdmin) {
        throw new AppError(
          400,
          `Upload a lock-up photo for "${item.area_name}" before marking it complete`,
          'PHOTO_REQUIRED',
        );
      }

      // ── Check if all required items are now complete ───────────────────────
      const allLockupPhotos = await prisma.sessionPhoto.findMany({
        where: { session_id: sessionId, photo_type: 'lockup' },
        select: { checklist_item_id: true },
      });

      const completedSet = new Set(allLockupPhotos.map((p) => p.checklist_item_id));
      completedSet.add(itemId); // include the current item

      const requiredItems = checklistItems.filter((ci) => ci.is_required);
      const allComplete = requiredItems.every((ci) => completedSet.has(ci.id));

      // Update session lockup_complete flag if all required items done
      if (allComplete) {
        await prisma.session.update({
          where: { id: sessionId },
          data: { lockup_complete: true },
        });
      }

      await auditLog(req, 'checklist.item_completed', 'site_checklist_item', itemId, {
        session_id: sessionId,
        area_name: item.area_name,
        sort_order: item.sort_order,
        all_complete: allComplete,
        completed_by: req.user!.id,
        admin_override: isAdmin && !lockupPhoto,
      });

      res.json({
        success: true,
        data: {
          item_id: itemId,
          area_name: item.area_name,
          is_complete: true,
          lockup_complete: allComplete,
          message: allComplete
            ? 'All lock-up items complete. Session is ready to close.'
            : `Item completed. ${requiredItems.length - completedSet.size} item(s) remaining.`,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

// ── GET /api/sessions/:id/checklist/:itemId ───────────────────────────────────

router.get('/:itemId', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id: sessionId, itemId } = req.params;
    const session = await getSessionWithChecklist(sessionId);

    const item = session.contract.site_slot.site.site_checklist_items.find(
      (ci) => ci.id === itemId,
    );
    if (!item) throw new AppError(404, 'Checklist item not found', 'NOT_FOUND');

    const photos = await prisma.sessionPhoto.findMany({
      where: { session_id: sessionId, checklist_item_id: itemId },
      orderBy: { photo_type: 'asc' },
    });

    const comparison = await prisma.photoComparison.findFirst({
      where: { session_id: sessionId, checklist_item_id: itemId },
    });

    res.json({
      success: true,
      data: {
        item,
        photos,
        comparison,
        is_complete: photos.some((p) => p.photo_type === 'lockup'),
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
