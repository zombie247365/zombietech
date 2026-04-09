import { Router } from 'express';
import healthRouter from './health';
import authRouter from './auth';
import sitesRouter from './sites';
import documentsRouter from './documents';
import operatorsRouter from './operators';
import bookingsRouter from './bookings';
import contractsRouter from './contracts';
import sessionsRouter from './sessions';
import photosRouter from './photos';
import checklistRouter from './checklist';
import settlementsRouter from './settlements';
import disputesRouter from './disputes';
import webhooksRouter from './webhooks';

const router = Router();

router.use('/', healthRouter);
router.use('/auth', authRouter);
router.use('/sites', sitesRouter);
router.use('/documents', documentsRouter);
router.use('/operators', operatorsRouter);
router.use('/bookings', bookingsRouter);
router.use('/contracts', contractsRouter);
router.use('/sessions', sessionsRouter);

// Session sub-routes (mergeParams so :id flows down)
router.use('/sessions/:id/photos', photosRouter);
router.use('/sessions/:id/checklist', checklistRouter);

router.use('/settlements', settlementsRouter);
router.use('/disputes', disputesRouter);
router.use('/webhooks', webhooksRouter);

export default router;
