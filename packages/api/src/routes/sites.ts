import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '@zombietech/database';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { auditLog } from '../middleware/auditLogger';
import { AppError } from '../middleware/errorHandler';
import { calcHourlyRate, calcSessionFee } from '@zombietech/shared';

const router = Router();

// ── Schemas ──────────────────────────────────────────────────────────────────

const createSiteSchema = z.object({
  trading_name: z.string().min(2).max(255),
  business_category: z.string().min(2).max(100),
  address_line1: z.string().min(5).max(255),
  suburb: z.string().min(2).max(100),
  city: z.string().min(2).max(100),
  latitude: z.number().min(-35).max(-22), // SA bounds
  longitude: z.number().min(16).max(33),
  site_opens_time: z.string().regex(/^\d{2}:\d{2}$/, 'Format HH:MM'),
  site_closes_time: z.string().regex(/^\d{2}:\d{2}$/, 'Format HH:MM'),
  zombie_end_time: z.string().regex(/^\d{2}:\d{2}$/, 'Format HH:MM'),
  monthly_rent_cents: z.number().int().positive(),
  monthly_utilities_cents: z.number().int().positive(),
  site_operating_hours_per_month: z.number().int().min(1).max(744),
});

const updateSiteSchema = createSiteSchema.partial();

const createSlotSchema = z.object({
  day_of_week: z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']).nullable().optional(),
  is_closed_day: z.boolean().optional().default(false),
  slot_start_time: z.string().regex(/^\d{2}:\d{2}$/),
  slot_end_time: z.string().regex(/^\d{2}:\d{2}$/),
  slot_hours: z.number().positive().max(24),
  upside_model: z.enum(['fixed', 'variable']),
  upside_fixed_pct: z.number().min(0).max(100).optional().nullable(),
  upside_variable_pct: z.number().min(0).max(100).optional().nullable(),
});

const createChecklistItemSchema = z.object({
  area_name: z.string().min(2).max(255),
  area_category: z.enum(['kitchen', 'equipment', 'security', 'custom']),
  sort_order: z.number().int().min(1),
  is_required: z.boolean().optional().default(true),
  description: z.string().min(5),
});

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getSiteOwnerProfile(userId: string) {
  const profile = await prisma.siteOwner.findUnique({ where: { user_id: userId } });
  if (!profile) throw new AppError(403, 'Site owner profile not found', 'NO_PROFILE');
  return profile;
}

// ── GET /api/sites  (public, list live sites) ─────────────────────────────

router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { city, category, page = '1', limit = '20' } = req.query as Record<string, string>;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where: Record<string, unknown> = { is_listed: true };
    if (city) where.city = { contains: city, mode: 'insensitive' };
    if (category) where.business_category = { contains: category, mode: 'insensitive' };

    const [sites, total] = await Promise.all([
      prisma.site.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { site_score: 'desc' },
        include: {
          site_slots: { where: { status: 'open' }, select: { id: true, day_of_week: true, slot_start_time: true, slot_end_time: true, base_fee_cents_per_session: true, upside_model: true } },
          _count: { select: { site_slots: true } },
        },
      }),
      prisma.site.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        items: sites,
        total,
        page: parseInt(page),
        page_size: parseInt(limit),
        total_pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/sites/mine  (site owner's own sites) ─────────────────────────

router.get('/mine', authenticate, requireRole('site_owner'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const siteOwner = await getSiteOwnerProfile(req.user!.id);
    const sites = await prisma.site.findMany({
      where: { site_owner_id: siteOwner.id },
      orderBy: { created_at: 'desc' },
      include: {
        site_slots: true,
        site_checklist_items: { orderBy: { sort_order: 'asc' } },
        _count: { select: { site_slots: true } },
      },
    });
    res.json({ success: true, data: sites });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/sites ───────────────────────────────────────────────────────

router.post('/', authenticate, requireRole('site_owner'), validate(createSiteSchema), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const siteOwner = await getSiteOwnerProfile(req.user!.id);
    const body = req.body as z.infer<typeof createSiteSchema>;

    const hourlyRate = calcHourlyRate(
      BigInt(body.monthly_rent_cents),
      BigInt(body.monthly_utilities_cents),
      body.site_operating_hours_per_month,
    );

    const site = await prisma.site.create({
      data: {
        site_owner_id: siteOwner.id,
        ...body,
        monthly_rent_cents: BigInt(body.monthly_rent_cents),
        monthly_utilities_cents: BigInt(body.monthly_utilities_cents),
        hourly_rate_cents: hourlyRate,
        is_listed: false,
        consent_status: 'pending',
      },
    });

    await auditLog(req, 'site.created', 'site', site.id, { trading_name: site.trading_name, city: site.city });
    res.status(201).json({ success: true, data: site });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/sites/:id ────────────────────────────────────────────────────

router.get('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const site = await prisma.site.findUnique({
      where: { id: req.params.id },
      include: {
        site_owner: { include: { user: { select: { full_name: true, email: true } } } },
        site_slots: { where: { status: { not: 'suspended' } }, orderBy: { day_of_week: 'asc' } },
        site_checklist_items: { orderBy: { sort_order: 'asc' } },
      },
    });
    if (!site) throw new AppError(404, 'Site not found', 'NOT_FOUND');
    res.json({ success: true, data: site });
  } catch (err) {
    next(err);
  }
});

// ── PUT /api/sites/:id ────────────────────────────────────────────────────

router.put('/:id', authenticate, requireRole('site_owner'), validate(updateSiteSchema), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const siteOwner = await getSiteOwnerProfile(req.user!.id);
    const site = await prisma.site.findUnique({ where: { id: req.params.id } });
    if (!site) throw new AppError(404, 'Site not found', 'NOT_FOUND');
    if (site.site_owner_id !== siteOwner.id) throw new AppError(403, 'Not your site', 'FORBIDDEN');

    const body = req.body as z.infer<typeof updateSiteSchema>;
    const updateData: Record<string, unknown> = { ...body };

    // Recompute hourly rate if cost components changed
    const newRent = body.monthly_rent_cents ? BigInt(body.monthly_rent_cents) : site.monthly_rent_cents;
    const newUtils = body.monthly_utilities_cents ? BigInt(body.monthly_utilities_cents) : site.monthly_utilities_cents;
    const newHours = body.site_operating_hours_per_month ?? site.site_operating_hours_per_month;

    if (body.monthly_rent_cents) updateData.monthly_rent_cents = BigInt(body.monthly_rent_cents);
    if (body.monthly_utilities_cents) updateData.monthly_utilities_cents = BigInt(body.monthly_utilities_cents);
    updateData.hourly_rate_cents = calcHourlyRate(newRent, newUtils, newHours);

    const updated = await prisma.site.update({ where: { id: site.id }, data: updateData });
    await auditLog(req, 'site.updated', 'site', site.id, { fields: Object.keys(body) });
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/sites/:id/list  (toggle listing) ────────────────────────────

router.post('/:id/list', authenticate, requireRole('site_owner'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const siteOwner = await getSiteOwnerProfile(req.user!.id);
    const site = await prisma.site.findUnique({ where: { id: req.params.id } });
    if (!site) throw new AppError(404, 'Site not found', 'NOT_FOUND');
    if (site.site_owner_id !== siteOwner.id) throw new AppError(403, 'Not your site', 'FORBIDDEN');
    if (site.consent_status !== 'landlord_verified') {
      throw new AppError(400, 'Landlord consent must be verified before going live', 'CONSENT_REQUIRED');
    }

    const updated = await prisma.site.update({ where: { id: site.id }, data: { is_listed: !site.is_listed } });
    await auditLog(req, updated.is_listed ? 'site.listed' : 'site.unlisted', 'site', site.id, {});
    res.json({ success: true, data: { is_listed: updated.is_listed } });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/sites/:id/slots ─────────────────────────────────────────────

router.post('/:id/slots', authenticate, requireRole('site_owner'), validate(createSlotSchema), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const siteOwner = await getSiteOwnerProfile(req.user!.id);
    const site = await prisma.site.findUnique({ where: { id: req.params.id } });
    if (!site) throw new AppError(404, 'Site not found', 'NOT_FOUND');
    if (site.site_owner_id !== siteOwner.id) throw new AppError(403, 'Not your site', 'FORBIDDEN');

    const body = req.body as z.infer<typeof createSlotSchema>;

    // Validate upside model fields
    if (body.upside_model === 'fixed' && !body.upside_fixed_pct) {
      throw new AppError(422, 'upside_fixed_pct is required for fixed upside model', 'VALIDATION');
    }
    if (body.upside_model === 'variable' && !body.upside_variable_pct) {
      throw new AppError(422, 'upside_variable_pct is required for variable upside model', 'VALIDATION');
    }

    const sessionFee = calcSessionFee(site.hourly_rate_cents, body.slot_hours);

    const slot = await prisma.siteSlot.create({
      data: {
        site_id: site.id,
        day_of_week: body.day_of_week ?? null,
        is_closed_day: body.is_closed_day ?? false,
        slot_start_time: body.slot_start_time,
        slot_end_time: body.slot_end_time,
        slot_hours: body.slot_hours,
        base_fee_cents_per_session: sessionFee,
        upside_model: body.upside_model,
        upside_fixed_pct: body.upside_fixed_pct ?? null,
        upside_variable_pct: body.upside_variable_pct ?? null,
        status: 'open',
      },
    });

    await auditLog(req, 'slot.created', 'site_slot', slot.id, { site_id: site.id, day: body.day_of_week });
    res.status(201).json({ success: true, data: slot });
  } catch (err) {
    next(err);
  }
});

// ── PUT /api/sites/:id/slots/:slotId ──────────────────────────────────────

router.put('/:id/slots/:slotId', authenticate, requireRole('site_owner'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const siteOwner = await getSiteOwnerProfile(req.user!.id);
    const site = await prisma.site.findUnique({ where: { id: req.params.id } });
    if (!site || site.site_owner_id !== siteOwner.id) throw new AppError(403, 'Not your site', 'FORBIDDEN');

    const slot = await prisma.siteSlot.findUnique({ where: { id: req.params.slotId } });
    if (!slot || slot.site_id !== site.id) throw new AppError(404, 'Slot not found', 'NOT_FOUND');
    if (slot.status === 'booked') throw new AppError(400, 'Cannot edit a booked slot — terminate the contract first', 'SLOT_BOOKED');

    const updated = await prisma.siteSlot.update({ where: { id: slot.id }, data: req.body });
    await auditLog(req, 'slot.updated', 'site_slot', slot.id, { fields: Object.keys(req.body) });
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/sites/:id/checklist ─────────────────────────────────────────

router.post('/:id/checklist', authenticate, requireRole('site_owner'), validate(createChecklistItemSchema), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const siteOwner = await getSiteOwnerProfile(req.user!.id);
    const site = await prisma.site.findUnique({ where: { id: req.params.id } });
    if (!site) throw new AppError(404, 'Site not found', 'NOT_FOUND');
    if (site.site_owner_id !== siteOwner.id) throw new AppError(403, 'Not your site', 'FORBIDDEN');

    // Checklist items are immutable once a contract is signed on this site
    const activeContract = await prisma.contract.findFirst({
      where: {
        site_slot: { site_id: site.id },
        status: { in: ['active', 'in_notice'] },
        operator_signed_at: { not: null },
        site_owner_signed_at: { not: null },
      },
    });
    if (activeContract) {
      throw new AppError(400, 'Checklist is locked — an active contract exists for this site', 'CHECKLIST_LOCKED');
    }

    const body = req.body as z.infer<typeof createChecklistItemSchema>;
    const item = await prisma.siteChecklistItem.create({
      data: { site_id: site.id, ...body },
    });

    await auditLog(req, 'checklist.item_added', 'site_checklist_item', item.id, { site_id: site.id, area_name: item.area_name });
    res.status(201).json({ success: true, data: item });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/sites/:id/checklist ──────────────────────────────────────────

router.get('/:id/checklist', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const site = await prisma.site.findUnique({ where: { id: req.params.id } });
    if (!site) throw new AppError(404, 'Site not found', 'NOT_FOUND');

    const items = await prisma.siteChecklistItem.findMany({
      where: { site_id: site.id },
      orderBy: { sort_order: 'asc' },
    });
    res.json({ success: true, data: items });
  } catch (err) {
    next(err);
  }
});

// ── DELETE /api/sites/:id/checklist/:itemId ───────────────────────────────

router.delete('/:id/checklist/:itemId', authenticate, requireRole('site_owner'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const siteOwner = await getSiteOwnerProfile(req.user!.id);
    const site = await prisma.site.findUnique({ where: { id: req.params.id } });
    if (!site || site.site_owner_id !== siteOwner.id) throw new AppError(403, 'Not your site', 'FORBIDDEN');

    const activeContract = await prisma.contract.findFirst({
      where: {
        site_slot: { site_id: site.id },
        status: { in: ['active', 'in_notice'] },
        operator_signed_at: { not: null },
      },
    });
    if (activeContract) throw new AppError(400, 'Checklist is locked due to active contract', 'CHECKLIST_LOCKED');

    await prisma.siteChecklistItem.delete({ where: { id: req.params.itemId } });
    await auditLog(req, 'checklist.item_removed', 'site_checklist_item', req.params.itemId, { site_id: site.id });
    res.json({ success: true, data: null });
  } catch (err) {
    next(err);
  }
});

export default router;
