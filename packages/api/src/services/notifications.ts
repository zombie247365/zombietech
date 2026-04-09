/**
 * Push notification service — Expo + FCM.
 *
 * Expo Push Notifications handle delivery to both iOS (APNs) and Android (FCM)
 * via the Expo push notification service. For web and direct Android FCM,
 * firebase-admin is used as a fallback.
 *
 * Flow:
 *  1. Look up the user's push token from the operators/users table.
 *  2. Send via Expo Push API (handles iOS + Android).
 *  3. Also create an in-app notification record in the DB.
 *  4. For web/FCM-only targets, fall back to firebase-admin.
 *
 * Tokens are stored in a separate push_tokens concept (using
 * the notifications table for in-app + a simple push token registry).
 * For Phase 8, push tokens are stored in a JSON field on operator/user records
 * or a future push_tokens table.
 */

import { prisma } from '@zombietech/database';
import { config } from '../config';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface NotificationPayload {
  userId: string;
  mobile: string;
  title: string;
  body: string;
  type: string;
  entityId: string;
  entityType: string;
  pushToken?: string | null;  // Expo push token, if known
  data?: Record<string, string>;
}

export interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  sound?: 'default';
  badge?: number;
  channelId?: string;
}

// ── Notification type → DB enum mapping ──────────────────────────────────────

type DbNotificationType =
  | 'booking_request'
  | 'booking_approved'
  | 'session_reminder'
  | 'handover_due'
  | 'report_ready'
  | 'settlement_released'
  | 'dispute_opened'
  | 'dispute_resolved'
  | 'vetting_complete'
  | 'score_change';

const TYPE_MAP: Record<string, DbNotificationType> = {
  booking_request: 'booking_request',
  booking_approved: 'booking_approved',
  session_reminder: 'session_reminder',
  handover_due: 'handover_due',
  report_ready: 'report_ready',
  settlement_released: 'settlement_released',
  dispute_opened: 'dispute_opened',
  dispute_resolved: 'dispute_resolved',
  vetting_complete: 'vetting_complete',
  score_change: 'score_change',
};

// ── Main notification sender ──────────────────────────────────────────────────

export async function sendNotification(payload: NotificationPayload): Promise<void> {
  const dbType = TYPE_MAP[payload.type] ?? 'score_change';

  try {
    // 1. Persist in-app notification
    await prisma.notification.create({
      data: {
        user_id: payload.userId,
        notification_type: dbType,
        related_entity_id: payload.entityId,
        related_entity_type: payload.entityType,
        title: payload.title,
        body: payload.body,
        channel: 'in_app',
        status: 'pending',
      },
    });

    // 2. Send Expo push notification if token available
    if (payload.pushToken && isValidExpoToken(payload.pushToken)) {
      await sendExpoPush({
        to: payload.pushToken,
        title: payload.title,
        body: payload.body,
        data: payload.data ?? { type: payload.type, entityId: payload.entityId },
        sound: 'default',
        channelId: 'default',
      });
    }
  } catch (err) {
    console.error('[notifications] Failed to send notification:', err);
  }
}

// ── Expo Push API ─────────────────────────────────────────────────────────────

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

function isValidExpoToken(token: string): boolean {
  return token.startsWith('ExponentPushToken[') || token.startsWith('ExpoPushToken[');
}

async function sendExpoPush(message: ExpoPushMessage): Promise<void> {
  if (config.isDev) {
    console.log('[expo-push] DEV:', JSON.stringify(message));
    return;
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Accept-Encoding': 'gzip, deflate',
  };

  if (config.expo.accessToken) {
    headers['Authorization'] = `Bearer ${config.expo.accessToken}`;
  }

  try {
    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(message),
    });

    const data = await res.json() as { data?: { status: string; message?: string } };

    if (data.data?.status === 'error') {
      console.error('[expo-push] Push error:', data.data.message);
    } else {
      console.log('[expo-push] Sent to:', message.to);
    }
  } catch (err) {
    console.error('[expo-push] Network error:', err);
  }
}

// ── Batch notification sender ─────────────────────────────────────────────────

/**
 * Send the same notification to multiple users.
 * Batches Expo push messages (max 100 per request).
 */
export async function sendBatchNotifications(
  payloads: NotificationPayload[],
): Promise<void> {
  // Persist all in-app notifications
  await prisma.notification.createMany({
    data: payloads.map((p) => ({
      user_id: p.userId,
      notification_type: TYPE_MAP[p.type] ?? 'score_change' as DbNotificationType,
      related_entity_id: p.entityId,
      related_entity_type: p.entityType,
      title: p.title,
      body: p.body,
      channel: 'in_app' as const,
      status: 'pending' as const,
    })),
  });

  // Batch Expo pushes
  const pushMessages = payloads
    .filter((p) => p.pushToken && isValidExpoToken(p.pushToken))
    .map((p) => ({
      to: p.pushToken!,
      title: p.title,
      body: p.body,
      data: p.data ?? { type: p.type, entityId: p.entityId },
      sound: 'default' as const,
    }));

  if (pushMessages.length === 0) return;

  // Send in chunks of 100
  const CHUNK_SIZE = 100;
  for (let i = 0; i < pushMessages.length; i += CHUNK_SIZE) {
    const chunk = pushMessages.slice(i, i + CHUNK_SIZE);
    if (config.isDev) {
      console.log(`[expo-push] DEV batch: ${chunk.length} messages`);
      continue;
    }
    try {
      await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(chunk),
      });
    } catch (err) {
      console.error('[expo-push] Batch send error:', err);
    }
  }
}

// ── FCM direct (fallback for web push) ───────────────────────────────────────

/**
 * Send a push notification directly via Firebase Cloud Messaging.
 * Used for web admin portal browser push notifications.
 * Requires GOOGLE_APPLICATION_CREDENTIALS or FCM_SERVICE_ACCOUNT_PATH env var.
 */
export async function sendFcmNotification(
  fcmToken: string,
  title: string,
  body: string,
  data?: Record<string, string>,
): Promise<void> {
  if (config.isDev || !config.fcm.serviceAccountPath) {
    console.log(`[fcm] DEV: ${title} → ${fcmToken.slice(0, 20)}...`);
    return;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const admin = require('firebase-admin');

    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
      });
    }

    await admin.messaging().send({
      token: fcmToken,
      notification: { title, body },
      data: data ?? {},
      android: { priority: 'high' },
      webpush: { notification: { title, body, icon: '/icon.png' } },
    });

    console.log(`[fcm] Sent to ${fcmToken.slice(0, 20)}...`);
  } catch (err) {
    console.error('[fcm] Send error:', err);
  }
}

// ── Convenience helpers ───────────────────────────────────────────────────────

export async function notifySessionReminder(
  userId: string,
  mobile: string,
  sessionRef: string,
  siteName: string,
  scheduledStart: Date,
  pushToken?: string | null,
): Promise<void> {
  const hoursUntil = Math.round((scheduledStart.getTime() - Date.now()) / 3600000);
  await sendNotification({
    userId,
    mobile,
    title: 'Session reminder',
    body: `Your session at ${siteName} starts in ${hoursUntil} hour${hoursUntil !== 1 ? 's' : ''} (${sessionRef}).`,
    type: 'session_reminder',
    entityId: sessionRef,
    entityType: 'session',
    pushToken,
  });
}

export async function notifyBookingApproved(
  userId: string,
  mobile: string,
  bookingId: string,
  siteName: string,
  approved: boolean,
  pushToken?: string | null,
): Promise<void> {
  await sendNotification({
    userId,
    mobile,
    title: approved ? 'Booking approved!' : 'Booking update',
    body: approved
      ? `Your booking for ${siteName} was approved. A contract is ready to sign.`
      : `Your booking for ${siteName} was not approved. Tap to see details.`,
    type: approved ? 'booking_approved' : 'booking_request',
    entityId: bookingId,
    entityType: 'booking',
    pushToken,
  });
}

export async function notifyVettingComplete(
  userId: string,
  mobile: string,
  operatorId: string,
  approved: boolean,
  pushToken?: string | null,
): Promise<void> {
  await sendNotification({
    userId,
    mobile,
    title: approved ? 'Vetting approved!' : 'Vetting update',
    body: approved
      ? 'Your vetting is complete. You can now browse and book zombie kitchen sites.'
      : 'Your vetting requires attention. Open the app to see what is needed.',
    type: 'vetting_complete',
    entityId: operatorId,
    entityType: 'operator',
    pushToken,
  });
}

export async function notifyDisputeUpdate(
  userId: string,
  mobile: string,
  disputeId: string,
  disputeRef: string,
  resolved: boolean,
  pushToken?: string | null,
): Promise<void> {
  await sendNotification({
    userId,
    mobile,
    title: resolved ? 'Dispute resolved' : 'New dispute opened',
    body: resolved
      ? `Dispute ${disputeRef} has been resolved. Open the app to see the outcome.`
      : `A dispute (${disputeRef}) has been opened. Please respond within the deadline.`,
    type: resolved ? 'dispute_resolved' : 'dispute_opened',
    entityId: disputeId,
    entityType: 'dispute',
    pushToken,
  });
}
