import { prisma, Prisma } from '@zombietech/database';
import { AuthRequest } from './auth';

/**
 * Append an entry to the audit_log table. Fire-and-forget — never throws.
 */
export async function auditLog(
  req: AuthRequest,
  eventType: string,
  entityType: string,
  entityId: string,
  payload: Prisma.InputJsonValue,
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actor_user_id: req.user?.id ?? null,
        event_type: eventType,
        entity_type: entityType,
        entity_id: entityId,
        ip_address: (req.ip ?? '').slice(0, 45),
        user_agent: req.headers['user-agent'] ?? null,
        payload,
      },
    });
  } catch (err) {
    // Never propagate audit failures — log to stderr only
    console.error('[audit] Failed to write audit log:', err);
  }
}
