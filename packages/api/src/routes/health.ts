import { Router, Request, Response } from 'express';
import { prisma } from '@zombietech/database';

const router = Router();

router.get('/health', async (_req: Request, res: Response) => {
  let dbStatus: 'ok' | 'error' = 'ok';
  let dbLatencyMs: number | null = null;

  try {
    const t0 = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    dbLatencyMs = Date.now() - t0;
  } catch {
    dbStatus = 'error';
  }

  const status = dbStatus === 'ok' ? 200 : 503;

  res.status(status).json({
    status: dbStatus === 'ok' ? 'healthy' : 'degraded',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
    services: {
      database: {
        status: dbStatus,
        latency_ms: dbLatencyMs,
      },
    },
  });
});

export default router;
