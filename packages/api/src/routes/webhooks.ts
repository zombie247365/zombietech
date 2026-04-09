/**
 * Webhook routes — mounted at /api/webhooks
 *
 * POST /api/webhooks/peach  — Peach Payments payment/payout status updates
 */

import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '@zombietech/database';
import { config } from '../config';
import { verifyPeachWebhook, PeachWebhookPayload } from '../services/payments';
import { sendNotification } from '../services/notifications';

const router = Router();

// ── POST /api/webhooks/peach ──────────────────────────────────────────────────
//
// Called by Peach Payments when a payment or payout changes status.
// Raw body buffering is needed for signature verification — we use express.raw()
// on this specific route (see routes/index.ts where it's mounted before json()).

router.post(
  '/peach',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Raw body for HMAC verification
      const rawBody = req.body instanceof Buffer
        ? req.body.toString('utf8')
        : JSON.stringify(req.body);

      const signature = req.headers['x-peach-signature'] as string ?? '';

      // Verify signature in production
      if (!config.isDev && config.peach.webhookSecret) {
        const valid = verifyPeachWebhook(rawBody, signature, config.peach.webhookSecret);
        if (!valid) {
          console.warn('[webhook/peach] Invalid signature — rejected');
          res.status(403).json({ success: false, error: 'Invalid webhook signature' });
          return;
        }
      }

      const payload: PeachWebhookPayload = typeof req.body === 'string'
        ? JSON.parse(rawBody)
        : req.body;

      const ref = payload.merchantTransactionId;
      const resultCode = payload.result?.code ?? '';
      const isSuccess = resultCode.startsWith('000');

      console.log(`[webhook/peach] ${ref} → ${resultCode} (${payload.result?.description})`);

      // Handle settlement payout confirmation
      if (payload.paymentType === 'CD') {
        // Credit = payout to operator
        const settlement = await prisma.settlement.findFirst({
          where: { settlement_ref: ref },
          include: { operator: { include: { user: true } } },
        });

        if (settlement) {
          if (isSuccess && settlement.status !== 'released') {
            await prisma.settlement.update({
              where: { id: settlement.id },
              data: {
                status: 'released',
                released_at: new Date(),
                payment_provider_ref: payload.id,
              },
            });

            // Notify operator
            if (settlement.operator?.user) {
              await sendNotification({
                userId: settlement.operator.user.id,
                mobile: settlement.operator.user.mobile,
                title: 'Settlement released',
                body: `R${(Number(settlement.operator_payout_cents) / 100).toFixed(2)} has been paid to your bank account (ref: ${settlement.settlement_ref}).`,
                type: 'settlement_released',
                entityId: settlement.id,
                entityType: 'settlement',
              });
            }

            await prisma.auditLog.create({
              data: {
                actor_user_id: null,
                event_type: 'settlement.payment_confirmed',
                entity_type: 'settlement',
                entity_id: settlement.id,
                payload: { peach_id: payload.id, result_code: resultCode, ref },
              },
            });
          } else if (!isSuccess) {
            await prisma.settlement.update({
              where: { id: settlement.id },
              data: { status: 'failed' },
            });
          }
        }
      }

      // Handle incoming payment (DB = debit, collecting from operators for fees)
      if (payload.paymentType === 'DB') {
        console.log(`[webhook/peach] Incoming payment ${ref}: ${isSuccess ? 'SUCCESS' : 'FAILED'}`);
        // Future: link to payment_intents table if we add card-on-file for operators
      }

      // Always 200 to prevent Peach from retrying
      res.json({ success: true, received: true });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
