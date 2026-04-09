import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '@zombietech/database';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { auditLog } from '../middleware/auditLogger';
import { AppError } from '../middleware/errorHandler';
import { notifyBookingApproved } from '../services/notifications';
import { sendBookingApprovalSms } from '../services/sms';

const router = Router();

// ── Schemas ───────────────────────────────────────────────────────────────────

const createBookingSchema = z.object({
  site_slot_id: z.string().uuid(),
  concept_summary: z.string().min(20).max(2000),
  requested_start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format YYYY-MM-DD'),
  recurring: z.boolean().optional().default(false),
});

// ── POST /api/bookings ────────────────────────────────────────────────────

router.post('/', authenticate, requireRole('operator'), validate(createBookingSchema), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = req.body as z.infer<typeof createBookingSchema>;

    // Get operator profile
    const operator = await prisma.operator.findUnique({ where: { user_id: req.user!.id } });
    if (!operator) throw new AppError(403, 'Operator profile not found', 'NO_PROFILE');
    if (operator.vetting_status !== 'approved') {
      throw new AppError(403, 'Operator must be approved before booking', 'VETTING_REQUIRED');
    }

    // Check slot exists and is open
    const slot = await prisma.siteSlot.findUnique({
      where: { id: body.site_slot_id },
      include: { site: { select: { trading_name: true, is_listed: true } } },
    });
    if (!slot) throw new AppError(404, 'Slot not found', 'NOT_FOUND');
    if (!slot.site.is_listed) throw new AppError(400, 'Site is not listed', 'SITE_NOT_LISTED');
    if (slot.status !== 'open') throw new AppError(400, 'This slot is not available for booking', 'SLOT_NOT_AVAILABLE');

    // Check for duplicate pending request from same operator on same slot
    const existing = await prisma.bookingRequest.findFirst({
      where: {
        site_slot_id: body.site_slot_id,
        operator_id: operator.id,
        status: 'pending',
      },
    });
    if (existing) throw new AppError(409, 'You already have a pending request for this slot', 'DUPLICATE_REQUEST');

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 3); // 3-day expiry

    const booking = await prisma.bookingRequest.create({
      data: {
        site_slot_id: body.site_slot_id,
        operator_id: operator.id,
        concept_summary: body.concept_summary,
        requested_start_date: new Date(body.requested_start_date),
        recurring: body.recurring ?? false,
        status: 'pending',
        expires_at: expiresAt,
      },
    });

    // Notify site owner
    const siteOwnerUser = await prisma.user.findFirst({
      where: { site_owner: { sites: { some: { site_slots: { some: { id: body.site_slot_id } } } } } },
    });
    if (siteOwnerUser) {
      await prisma.notification.create({
        data: {
          user_id: siteOwnerUser.id,
          notification_type: 'booking_request',
          related_entity_id: booking.id,
          related_entity_type: 'booking_request',
          title: 'New booking request',
          body: `${operator.trading_concept ? operator.trading_concept.slice(0, 50) + '...' : 'An operator'} wants to book your ${slot.site.trading_name} slot.`,
          channel: 'push',
          status: 'pending',
        },
      });
    }

    await auditLog(req, 'booking.created', 'booking_request', booking.id, {
      site_slot_id: body.site_slot_id,
      operator_id: operator.id,
      requested_start_date: body.requested_start_date,
    });

    res.status(201).json({ success: true, data: booking });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/bookings  (operator: own requests; site owner: requests on their slots) ──

router.get('/', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { status } = req.query as { status?: string };

    let bookings;
    if (req.user!.role === 'operator') {
      const operator = await prisma.operator.findUnique({ where: { user_id: req.user!.id } });
      if (!operator) throw new AppError(403, 'No operator profile', 'NO_PROFILE');

      bookings = await prisma.bookingRequest.findMany({
        where: {
          operator_id: operator.id,
          ...(status ? { status: status as 'pending' | 'approved' | 'declined' | 'expired' } : {}),
        },
        include: {
          site_slot: {
            include: {
              site: { select: { trading_name: true, address_line1: true, suburb: true, city: true } },
            },
          },
        },
        orderBy: { created_at: 'desc' },
      });
    } else if (req.user!.role === 'site_owner') {
      const siteOwner = await prisma.siteOwner.findUnique({ where: { user_id: req.user!.id } });
      if (!siteOwner) throw new AppError(403, 'No site owner profile', 'NO_PROFILE');

      bookings = await prisma.bookingRequest.findMany({
        where: {
          site_slot: { site: { site_owner_id: siteOwner.id } },
          ...(status ? { status: status as 'pending' | 'approved' | 'declined' | 'expired' } : {}),
        },
        include: {
          site_slot: { include: { site: { select: { trading_name: true } } } },
          operator: {
            include: {
              user: { select: { full_name: true, email: true, mobile: true } },
            },
          },
        },
        orderBy: { created_at: 'desc' },
      });
    } else {
      // Admin — see all
      bookings = await prisma.bookingRequest.findMany({
        where: status ? { status: status as 'pending' | 'approved' | 'declined' | 'expired' } : {},
        include: {
          site_slot: { include: { site: { select: { trading_name: true, city: true } } } },
          operator: { include: { user: { select: { full_name: true } } } },
        },
        orderBy: { created_at: 'desc' },
        take: 100,
      });
    }

    res.json({ success: true, data: bookings });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/bookings/:id ─────────────────────────────────────────────────

router.get('/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const booking = await prisma.bookingRequest.findUnique({
      where: { id: req.params.id },
      include: {
        site_slot: { include: { site: true } },
        operator: { include: { user: { select: { full_name: true, email: true, mobile: true } } } },
        contracts: { take: 1 },
      },
    });
    if (!booking) throw new AppError(404, 'Booking request not found', 'NOT_FOUND');

    // Access control
    const operator = req.user!.role === 'operator'
      ? await prisma.operator.findUnique({ where: { user_id: req.user!.id } })
      : null;
    const siteOwner = req.user!.role === 'site_owner'
      ? await prisma.siteOwner.findUnique({ where: { user_id: req.user!.id } })
      : null;

    const isOwner = operator && booking.operator_id === operator.id;
    const isSiteOwner = siteOwner && booking.site_slot.site.site_owner_id === siteOwner.id;
    if (!isOwner && !isSiteOwner && req.user!.role !== 'admin') {
      throw new AppError(403, 'Access denied', 'FORBIDDEN');
    }

    res.json({ success: true, data: booking });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/bookings/:id/approve ────────────────────────────────────────

router.post('/:id/approve', authenticate, requireRole('site_owner'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const siteOwner = await prisma.siteOwner.findUnique({ where: { user_id: req.user!.id } });
    if (!siteOwner) throw new AppError(403, 'No site owner profile', 'NO_PROFILE');

    const booking = await prisma.bookingRequest.findUnique({
      where: { id: req.params.id },
      include: { site_slot: { include: { site: true } }, operator: true },
    });
    if (!booking) throw new AppError(404, 'Booking request not found', 'NOT_FOUND');
    if (booking.site_slot.site.site_owner_id !== siteOwner.id) throw new AppError(403, 'Not your site', 'FORBIDDEN');
    if (booking.status !== 'pending') throw new AppError(400, `Cannot approve a ${booking.status} booking`, 'INVALID_STATE');
    if (new Date() > booking.expires_at) throw new AppError(400, 'Booking request has expired', 'EXPIRED');

    const updated = await prisma.bookingRequest.update({
      where: { id: booking.id },
      data: { status: 'approved', site_owner_response_at: new Date() },
    });

    // Notify operator
    await prisma.notification.create({
      data: {
        user_id: booking.operator.user_id,
        notification_type: 'booking_approved',
        related_entity_id: booking.id,
        related_entity_type: 'booking_request',
        title: 'Booking approved!',
        body: `Your request for ${booking.site_slot.site.trading_name} has been approved. Sign your contract to confirm.`,
        channel: 'push',
        status: 'pending',
      },
    });

    // Fire push + SMS (non-blocking — failures don't fail the request)
    const operatorUser = await prisma.user.findUnique({ where: { id: booking.operator.user_id }, select: { mobile: true } });
    if (operatorUser) {
      notifyBookingApproved(booking.operator.user_id, operatorUser.mobile, booking.id, booking.site_slot.site.trading_name, true).catch(console.error);
      sendBookingApprovalSms(operatorUser.mobile, booking.site_slot.site.trading_name, true).catch(console.error);
    }

    await auditLog(req, 'booking.approved', 'booking_request', booking.id, { approved_by: req.user!.id });
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/bookings/:id/decline ────────────────────────────────────────

router.post('/:id/decline', authenticate, requireRole('site_owner'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { reason } = req.body as { reason?: string };
    const siteOwner = await prisma.siteOwner.findUnique({ where: { user_id: req.user!.id } });
    if (!siteOwner) throw new AppError(403, 'No site owner profile', 'NO_PROFILE');

    const booking = await prisma.bookingRequest.findUnique({
      where: { id: req.params.id },
      include: { site_slot: { include: { site: true } }, operator: true },
    });
    if (!booking) throw new AppError(404, 'Not found', 'NOT_FOUND');
    if (booking.site_slot.site.site_owner_id !== siteOwner.id) throw new AppError(403, 'Not your site', 'FORBIDDEN');
    if (booking.status !== 'pending') throw new AppError(400, `Cannot decline a ${booking.status} booking`, 'INVALID_STATE');

    const updated = await prisma.bookingRequest.update({
      where: { id: booking.id },
      data: { status: 'declined', site_owner_response_at: new Date() },
    });

    await prisma.notification.create({
      data: {
        user_id: booking.operator.user_id,
        notification_type: 'booking_request',
        related_entity_id: booking.id,
        related_entity_type: 'booking_request',
        title: 'Booking request declined',
        body: reason ?? 'Your booking request was not accepted. Try another slot.',
        channel: 'push',
        status: 'pending',
      },
    });

    // Fire push + SMS (non-blocking)
    const operatorUserDeclined = await prisma.user.findUnique({ where: { id: booking.operator.user_id }, select: { mobile: true } });
    if (operatorUserDeclined) {
      notifyBookingApproved(booking.operator.user_id, operatorUserDeclined.mobile, booking.id, booking.site_slot.site.trading_name, false).catch(console.error);
      sendBookingApprovalSms(operatorUserDeclined.mobile, booking.site_slot.site.trading_name, false).catch(console.error);
    }

    await auditLog(req, 'booking.declined', 'booking_request', booking.id, { declined_by: req.user!.id, reason });
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

export default router;
