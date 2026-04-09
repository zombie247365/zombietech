import { Router, Response, NextFunction, Request, RequestHandler } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { prisma } from '@zombietech/database';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { auditLog } from '../middleware/auditLogger';
import { AppError } from '../middleware/errorHandler';
import { uploadToS3, photoKey, presignedGetUrl, sha256 } from '../services/s3';
import { runSessionComparisons } from '../services/photoComparison';

const router = Router({ mergeParams: true }); // mergeParams so :id from parent is available

// ── Multer config (memory storage — buffer goes to S3) ─────────────────────

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 15 * 1024 * 1024, // 15 MB max per photo
    files: 1,
  },
  fileFilter(_req, file, cb) {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/heic', 'image/heif', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}. Use JPEG, PNG, HEIC, or WebP.`));
    }
  },
});

// ── GPS validation constants ──────────────────────────────────────────────────

// South Africa bounding box (generous to cover all territories)
const SA_LAT_MIN = -35.0;
const SA_LAT_MAX = -22.0;
const SA_LNG_MIN = 16.0;
const SA_LNG_MAX = 33.0;

// Maximum allowed age of device timestamp (prevents pre-captured photos)
const MAX_PHOTO_AGE_MINUTES = 30;

// Maximum allowed distance (metres) between photo GPS and site GPS
const MAX_DISTANCE_FROM_SITE_METRES = 500;

function degreesToRadians(deg: number): number {
  return deg * (Math.PI / 180);
}

/**
 * Haversine formula — returns distance in metres between two lat/lng points.
 */
function haversineDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R = 6371000; // Earth radius in metres
  const dLat = degreesToRadians(lat2 - lat1);
  const dLng = degreesToRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(degreesToRadians(lat1)) * Math.cos(degreesToRadians(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Metadata schema (sent as JSON body fields alongside the file) ─────────────

const photoMetaSchema = z.object({
  checklist_item_id: z.string().uuid('checklist_item_id must be a UUID'),
  photo_type: z.enum(['before', 'after', 'lockup']),
  latitude: z.coerce.number().min(SA_LAT_MIN).max(SA_LAT_MAX),
  longitude: z.coerce.number().min(SA_LNG_MIN).max(SA_LNG_MAX),
  device_timestamp: z.string().datetime({ message: 'device_timestamp must be an ISO 8601 datetime' }),
});

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getSessionOrThrow(sessionId: string) {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      contract: {
        include: {
          site_slot: {
            include: {
              site: {
                select: {
                  id: true,
                  site_owner_id: true,
                  trading_name: true,
                  latitude: true,
                  longitude: true,
                  site_checklist_items: {
                    orderBy: { sort_order: 'asc' },
                  },
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

// ── POST /api/sessions/:id/photos ─────────────────────────────────────────────
//
// Business rules enforced here:
// 1. Must have GPS latitude + longitude (SA bounds check)
// 2. Must have device_timestamp (within MAX_PHOTO_AGE_MINUTES of server time)
// 3. Photo must be taken within MAX_DISTANCE_FROM_SITE_METRES of the site
// 4. Only the operator on this contract can upload photos
// 5. Before photos: session must be active
// 6. After/lockup photos: session must be active
// 7. Lockup photos must be submitted in sort_order (sequential enforcement)
// 8. Duplicate photo (same checklist_item_id + photo_type) rejected — call /replace instead

router.post(
  '/',
  authenticate,
  requireRole('operator'),
  upload.single('photo') as unknown as RequestHandler,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const sessionId = req.params.id;
      if (!sessionId) throw new AppError(400, 'Session ID missing', 'VALIDATION');

      // ── 1. Validate metadata fields ────────────────────────────────────────
      const metaParse = photoMetaSchema.safeParse(req.body);
      if (!metaParse.success) {
        throw new AppError(422, 'Invalid photo metadata', 'VALIDATION');
      }
      const meta = metaParse.data;

      // ── 2. Require the uploaded file ───────────────────────────────────────
      if (!req.file) {
        throw new AppError(400, 'No photo file provided. Send a multipart/form-data request with field "photo"', 'NO_FILE');
      }

      // ── 3. GPS age check ──────────────────────────────────────────────────
      const deviceTime = new Date(meta.device_timestamp);
      const serverTime = new Date();
      const ageMinutes = Math.abs(serverTime.getTime() - deviceTime.getTime()) / 60000;
      if (ageMinutes > MAX_PHOTO_AGE_MINUTES) {
        throw new AppError(
          400,
          `Photo timestamp is ${Math.round(ageMinutes)} minutes from server time. ` +
          `Maximum allowed is ${MAX_PHOTO_AGE_MINUTES} minutes. Photos must be taken in the app, not pre-captured.`,
          'PHOTO_TOO_OLD',
        );
      }

      // ── 4. Load session and verify operator ───────────────────────────────
      const session = await getSessionOrThrow(sessionId);
      const operatorUserId = session.contract.operator.user_id;
      if (req.user!.id !== operatorUserId) {
        throw new AppError(403, 'Only the operator on this contract may upload photos', 'FORBIDDEN');
      }

      // ── 5. Session status check ───────────────────────────────────────────
      if (session.status !== 'active') {
        throw new AppError(
          400,
          `Photos can only be uploaded to an active session. Current status: ${session.status}`,
          'INVALID_STATE',
        );
      }

      // ── 6. Validate checklist item belongs to this site ───────────────────
      const site = session.contract.site_slot.site;
      const checklistItem = site.site_checklist_items.find(
        (ci) => ci.id === meta.checklist_item_id,
      );
      if (!checklistItem) {
        throw new AppError(
          400,
          'checklist_item_id does not belong to this session\'s site',
          'INVALID_CHECKLIST_ITEM',
        );
      }

      // ── 7. GPS proximity to site ──────────────────────────────────────────
      const siteLat = Number(site.latitude);
      const siteLng = Number(site.longitude);
      const distance = haversineDistance(meta.latitude, meta.longitude, siteLat, siteLng);
      if (distance > MAX_DISTANCE_FROM_SITE_METRES) {
        throw new AppError(
          400,
          `Photo was taken ${Math.round(distance)}m from the site (maximum ${MAX_DISTANCE_FROM_SITE_METRES}m allowed). ` +
          `Photos must be taken on-site.`,
          'PHOTO_TOO_FAR',
        );
      }

      // ── 8. Lockup sequential enforcement ─────────────────────────────────
      if (meta.photo_type === 'lockup') {
        // Find which sort_order the current item has
        const itemOrder = checklistItem.sort_order;

        // All items with lower sort_order must already have a lockup photo
        const lowerItems = site.site_checklist_items.filter(
          (ci) => ci.sort_order < itemOrder,
        );

        if (lowerItems.length > 0) {
          const completedLowerPhotoIds = await prisma.sessionPhoto.findMany({
            where: {
              session_id: sessionId,
              photo_type: 'lockup',
              checklist_item_id: { in: lowerItems.map((ci) => ci.id) },
            },
            select: { checklist_item_id: true },
          });

          const completedSet = new Set(completedLowerPhotoIds.map((p) => p.checklist_item_id));
          const missing = lowerItems.filter((ci) => !completedSet.has(ci.id));

          if (missing.length > 0) {
            const missingNames = missing.map((ci) => `#${ci.sort_order} ${ci.area_name}`).join(', ');
            throw new AppError(
              400,
              `Lock-up photos must be completed in order. Complete these first: ${missingNames}`,
              'LOCKUP_OUT_OF_ORDER',
            );
          }
        }
      }

      // ── 9. Duplicate check (same item + type) ─────────────────────────────
      const existing = await prisma.sessionPhoto.findFirst({
        where: {
          session_id: sessionId,
          checklist_item_id: meta.checklist_item_id,
          photo_type: meta.photo_type,
        },
      });
      if (existing) {
        throw new AppError(
          409,
          `A ${meta.photo_type} photo already exists for this checklist item. Use PUT /sessions/${sessionId}/photos/${existing.id} to replace it.`,
          'DUPLICATE_PHOTO',
        );
      }

      // ── 10. Upload to S3 ─────────────────────────────────────────────────
      const buffer = req.file.buffer;
      const fileHash = sha256(buffer);
      const key = photoKey(sessionId, meta.checklist_item_id, meta.photo_type, req.file.originalname || 'photo.jpg');

      const { url } = await uploadToS3(buffer, key, req.file.mimetype);

      // ── 11. Save to database ─────────────────────────────────────────────
      const photo = await prisma.sessionPhoto.create({
        data: {
          session_id: sessionId,
          checklist_item_id: meta.checklist_item_id,
          photo_type: meta.photo_type,
          storage_key: key,
          storage_url: url,
          latitude: meta.latitude,
          longitude: meta.longitude,
          device_timestamp: deviceTime,
          server_timestamp: serverTime,
          hash: fileHash,
        },
      });

      // ── 12. Update session completion flags ───────────────────────────────
      await _updateSessionPhotoFlags(sessionId, site.site_checklist_items.length);

      await auditLog(req, 'photo.uploaded', 'session_photo', photo.id, {
        session_id: sessionId,
        photo_type: meta.photo_type,
        checklist_item_id: meta.checklist_item_id,
        area_name: checklistItem.area_name,
        distance_from_site_metres: Math.round(distance),
      });

      res.status(201).json({
        success: true,
        data: {
          ...photo,
          storage_url: url, // already set above, but explicit
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

// ── PUT /api/sessions/:id/photos/:photoId  (replace a photo) ─────────────────

router.put(
  '/:photoId',
  authenticate,
  requireRole('operator'),
  upload.single('photo') as unknown as RequestHandler,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id: sessionId, photoId } = req.params;

      const existing = await prisma.sessionPhoto.findUnique({ where: { id: photoId } });
      if (!existing || existing.session_id !== sessionId) {
        throw new AppError(404, 'Photo not found', 'NOT_FOUND');
      }

      const session = await getSessionOrThrow(sessionId);
      if (req.user!.id !== session.contract.operator.user_id) {
        throw new AppError(403, 'Forbidden', 'FORBIDDEN');
      }
      if (session.status !== 'active') {
        throw new AppError(400, 'Session is not active', 'INVALID_STATE');
      }

      // Re-validate GPS metadata
      const metaParse = photoMetaSchema.safeParse(req.body);
      if (!metaParse.success) throw new AppError(422, 'Invalid photo metadata', 'VALIDATION');
      const meta = metaParse.data;

      const ageMinutes = Math.abs(new Date().getTime() - new Date(meta.device_timestamp).getTime()) / 60000;
      if (ageMinutes > MAX_PHOTO_AGE_MINUTES) {
        throw new AppError(400, `Photo timestamp too old (${Math.round(ageMinutes)} min)`, 'PHOTO_TOO_OLD');
      }

      if (!req.file) throw new AppError(400, 'No photo file provided', 'NO_FILE');

      const site = session.contract.site_slot.site;
      const distance = haversineDistance(meta.latitude, meta.longitude, Number(site.latitude), Number(site.longitude));
      if (distance > MAX_DISTANCE_FROM_SITE_METRES) {
        throw new AppError(400, `Photo taken ${Math.round(distance)}m from site`, 'PHOTO_TOO_FAR');
      }

      const buffer = req.file.buffer;
      const fileHash = sha256(buffer);
      const key = photoKey(sessionId, existing.checklist_item_id, existing.photo_type as 'before' | 'after' | 'lockup', req.file.originalname || 'photo.jpg');
      const { url } = await uploadToS3(buffer, key, req.file.mimetype);

      const updated = await prisma.sessionPhoto.update({
        where: { id: photoId },
        data: {
          storage_key: key,
          storage_url: url,
          latitude: meta.latitude,
          longitude: meta.longitude,
          device_timestamp: new Date(meta.device_timestamp),
          server_timestamp: new Date(),
          hash: fileHash,
        },
      });

      await auditLog(req, 'photo.replaced', 'session_photo', photoId, {
        session_id: sessionId,
        photo_type: existing.photo_type,
      });

      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  },
);

// ── GET /api/sessions/:id/photos ─────────────────────────────────────────────

router.get('/', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const sessionId = req.params.id;
    const { type } = req.query as { type?: string };

    const session = await getSessionOrThrow(sessionId);
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

    const photos = await prisma.sessionPhoto.findMany({
      where: {
        session_id: sessionId,
        ...(type ? { photo_type: type as 'before' | 'after' | 'lockup' } : {}),
      },
      orderBy: [{ photo_type: 'asc' }, { created_at: 'asc' }],
      include: {
        checklist_item: { select: { area_name: true, area_category: true, sort_order: true } },
      },
    });

    // Generate presigned URLs for each photo
    const photosWithUrls = await Promise.all(
      photos.map(async (p) => ({
        ...p,
        download_url: await presignedGetUrl(p.storage_key, 300),
      })),
    );

    res.json({ success: true, data: photosWithUrls });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/sessions/:id/photos/comparisons ─────────────────────────────────
// Must be registered BEFORE /:photoId to avoid being shadowed by the wildcard

router.get('/comparisons', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const sessionId = req.params.id;
    const comparisons = await prisma.photoComparison.findMany({
      where: { session_id: sessionId },
      include: {
        checklist_item: { select: { area_name: true, sort_order: true } },
        before_photo: { select: { id: true, storage_key: true, device_timestamp: true } },
        after_photo: { select: { id: true, storage_key: true, device_timestamp: true } },
      },
      orderBy: { created_at: 'asc' },
    });

    const withUrls = await Promise.all(
      comparisons.map(async (c) => ({
        ...c,
        before_photo_url: c.before_photo
          ? await presignedGetUrl(c.before_photo.storage_key, 300)
          : null,
        after_photo_url: c.after_photo
          ? await presignedGetUrl(c.after_photo.storage_key, 300)
          : null,
      })),
    );

    res.json({ success: true, data: withUrls });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/sessions/:id/photos/:photoId ─────────────────────────────────────

router.get('/:photoId', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const photo = await prisma.sessionPhoto.findUnique({
      where: { id: req.params.photoId },
      include: { checklist_item: true },
    });
    if (!photo || photo.session_id !== req.params.id) {
      throw new AppError(404, 'Photo not found', 'NOT_FOUND');
    }

    const url = await presignedGetUrl(photo.storage_key, 300);
    res.json({ success: true, data: { ...photo, download_url: url } });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/sessions/:id/compare-photos ─────────────────────────────────────
// Trigger AI comparison manually (also triggered automatically on session end)

router.post('/compare', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const sessionId = req.params.id;
    const session = await getSessionOrThrow(sessionId);

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

    if (!['active', 'completed'].includes(session.status)) {
      throw new AppError(400, 'AI comparison requires an active or completed session', 'INVALID_STATE');
    }

    const result = await runSessionComparisons(sessionId);

    await auditLog(req, 'session.ai_comparison_run', 'session', sessionId, {
      ...result,
      triggered_by: req.user!.id,
    });

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// ── Internal: update before/after/lockup completion flags on session ─────────

async function _updateSessionPhotoFlags(sessionId: string, totalChecklistItems: number): Promise<void> {
  const photos = await prisma.sessionPhoto.findMany({
    where: { session_id: sessionId },
    select: { checklist_item_id: true, photo_type: true },
  });

  const beforeItems = new Set(photos.filter((p) => p.photo_type === 'before').map((p) => p.checklist_item_id));
  const afterItems = new Set(photos.filter((p) => p.photo_type === 'after').map((p) => p.checklist_item_id));
  const lockupItems = new Set(photos.filter((p) => p.photo_type === 'lockup').map((p) => p.checklist_item_id));

  await prisma.session.update({
    where: { id: sessionId },
    data: {
      before_photos_complete: beforeItems.size >= totalChecklistItems,
      after_photos_complete: afterItems.size >= totalChecklistItems,
      lockup_complete: lockupItems.size >= totalChecklistItems,
    },
  });
}

export { _updateSessionPhotoFlags };
export default router;
