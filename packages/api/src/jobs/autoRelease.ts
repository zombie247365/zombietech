/**
 * Auto-release job — runs on Monday at 12:00 SAST (UTC+2 = 10:00 UTC).
 *
 * Business rule §6: If a site owner has not confirmed or raised a dispute
 * by Monday 12:00 SAST, the settlement is automatically released to the operator.
 *
 * This function is called by the scheduler in index.ts.
 * It can also be triggered manually via POST /api/settlements/auto-release (admin only).
 */

import { prisma } from '@zombietech/database';

export async function runAutoRelease(): Promise<{ released: number; ids: string[] }> {
  console.log('[auto-release] Running settlement auto-release check...');

  // Find all "ready" settlements whose period_end is before the current Monday 12:00 SAST.
  // We also release any "pending" settlements that have been sitting for over 7 days.
  const now = new Date();

  // Monday 12:00 SAST deadline: settlements whose period ended in the PREVIOUS week
  // (i.e., period_end <= last Monday 12:00 SAST)
  const lastMonday = getMostRecentMonday1200SAST(now);

  const eligibleSettlements = await prisma.settlement.findMany({
    where: {
      status: { in: ['ready', 'pending'] },
      period_end: { lte: lastMonday },
    },
    select: {
      id: true,
      settlement_ref: true,
      operator_id: true,
      operator_payout_cents: true,
    },
  });

  if (eligibleSettlements.length === 0) {
    console.log('[auto-release] No settlements eligible for auto-release.');
    return { released: 0, ids: [] };
  }

  const ids = eligibleSettlements.map((s) => s.id);

  await prisma.settlement.updateMany({
    where: { id: { in: ids } },
    data: {
      status: 'released',
      released_at: now,
      payment_provider_ref: 'AUTO_RELEASE',
    },
  });

  // Audit log for each released settlement
  for (const s of eligibleSettlements) {
    await prisma.auditLog.create({
      data: {
        actor_user_id: null, // system event
        event_type: 'settlement.auto_released',
        entity_type: 'settlement',
        entity_id: s.id,
        payload: {
          settlement_ref: s.settlement_ref,
          operator_id: s.operator_id,
          operator_payout_cents: s.operator_payout_cents.toString(),
          triggered_at: now.toISOString(),
        },
      },
    });

    console.log(`[auto-release] Released ${s.settlement_ref} (R${Number(s.operator_payout_cents) / 100})`);
  }

  console.log(`[auto-release] Released ${ids.length} settlement(s).`);
  return { released: ids.length, ids };
}

/**
 * Returns the most recent Monday at 12:00 SAST (UTC+2 = 10:00 UTC) relative to `now`.
 * If `now` IS a Monday after 12:00 SAST, it returns today's deadline.
 */
function getMostRecentMonday1200SAST(now: Date): Date {
  // Work in UTC. SAST = UTC+2, so 12:00 SAST = 10:00 UTC.
  const SAST_OFFSET_HOURS = 2;
  const DEADLINE_HOUR_SAST = 12;
  const DEADLINE_HOUR_UTC = DEADLINE_HOUR_SAST - SAST_OFFSET_HOURS; // 10

  const utcDay = now.getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const utcHour = now.getUTCHours();

  // Days since last Monday
  let daysSinceMonday = (utcDay === 0 ? 6 : utcDay - 1);

  // If today IS Monday but before 10:00 UTC (12:00 SAST), the deadline hasn't passed yet
  if (daysSinceMonday === 0 && utcHour < DEADLINE_HOUR_UTC) {
    daysSinceMonday = 7; // use previous Monday
  }

  const deadline = new Date(now);
  deadline.setUTCDate(now.getUTCDate() - daysSinceMonday);
  deadline.setUTCHours(DEADLINE_HOUR_UTC, 0, 0, 0);

  return deadline;
}
