/**
 * Document expiry alert job.
 *
 * Runs daily at 08:00 SAST (06:00 UTC).
 * Checks for documents (food_cert, insurance) expiring within 30 days
 * that have not yet been alerted.
 *
 * Actions:
 *  1. Creates an in-app notification for the document owner.
 *  2. Sends an SMS via Twilio.
 *  3. Sets document.expiry_alerted_at so we don't spam daily.
 */

import { prisma } from '@zombietech/database';
import { DocumentType } from '@prisma/client';
import { sendSms } from '../services/sms';

const ALERT_DOCUMENT_TYPES: DocumentType[] = [
  DocumentType.food_cert,
  DocumentType.insurance,
];
const ALERT_DAYS_BEFORE = 30;

export async function runDocumentExpiryAlerts(): Promise<{
  checked: number;
  alerted: number;
  ids: string[];
}> {
  console.log('[doc-expiry] Running document expiry check...');

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + ALERT_DAYS_BEFORE);

  // Find documents expiring within 30 days that haven't been alerted yet
  const expiringDocs = await prisma.document.findMany({
    where: {
      document_type: { in: ALERT_DOCUMENT_TYPES },
      expires_at: { lte: cutoff, gte: new Date() },
      expiry_alerted_at: null,
    },
    select: {
      id: true,
      document_type: true,
      expires_at: true,
      owner_user_id: true,
      owner: {
        select: { id: true, full_name: true, mobile: true, email: true },
      },
    },
  });

  if (expiringDocs.length === 0) {
    console.log('[doc-expiry] No expiring documents found.');
    return { checked: 0, alerted: 0, ids: [] };
  }

  const alertedIds: string[] = [];

  for (const doc of expiringDocs) {
    const daysUntilExpiry = Math.ceil(
      (doc.expires_at!.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
    );

    const docLabel = doc.document_type === DocumentType.food_cert
      ? 'Food handler certificate'
      : 'Public liability insurance';

    try {
      // 1. Create in-app notification
      await prisma.notification.create({
        data: {
          user_id: doc.owner_user_id,
          notification_type: 'score_change', // nearest available enum — general alert
          related_entity_id: doc.id,
          related_entity_type: 'document',
          title: `${docLabel} expiring soon`,
          body: `Your ${docLabel} expires in ${daysUntilExpiry} day${daysUntilExpiry !== 1 ? 's' : ''}. Upload a renewed copy in the app to keep your account active.`,
          channel: 'in_app',
          status: 'pending',
        },
      });

      // 2. Send SMS alert
      const smsBody = `ZombieTech: Your ${docLabel} expires in ${daysUntilExpiry} day${daysUntilExpiry !== 1 ? 's' : ''}. Log in to upload a renewed copy.`;
      await sendSms(doc.owner.mobile, smsBody);

      // 3. Mark document as alerted
      await prisma.document.update({
        where: { id: doc.id },
        data: { expiry_alerted_at: new Date() },
      });

      alertedIds.push(doc.id);
      console.log(
        `[doc-expiry] Alerted ${doc.owner.full_name} — ${docLabel} expires in ${daysUntilExpiry} days`,
      );
    } catch (err) {
      console.error(`[doc-expiry] Failed to alert for document ${doc.id}:`, err);
    }
  }

  console.log(`[doc-expiry] Alerted ${alertedIds.length}/${expiringDocs.length} documents.`);
  return { checked: expiringDocs.length, alerted: alertedIds.length, ids: alertedIds };
}
