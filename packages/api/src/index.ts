import express from 'express';
import cors from 'cors';
import cron from 'node-cron';

// Allow BigInt to serialise to JSON as a number string.
// All monetary values are cents (bigint) — clients receive them as strings and must treat them as integers.
(BigInt.prototype as unknown as { toJSON: () => string }).toJSON = function () {
  return this.toString();
};


import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { config } from './config';
import routes from './routes';
import { notFound, errorHandler } from './middleware/errorHandler';
import { runAutoRelease } from './jobs/autoRelease';
import { runDocumentExpiryAlerts } from './jobs/documentExpiry';

const app = express();
app.set('trust proxy', 1);
app.use((req, res, next) => { console.log('[mw-0] entered express', req.method, req.url); next(); });

// ── Security & parsing middleware ────────────────────────────────────────────
app.use(helmet());
app.use((req, res, next) => { console.log('[mw-1] after helmet', req.method, req.url); next(); });
app.use(cors({
  origin: [
    'http://localhost:3000',  // site owner portal
    'http://localhost:3001',  // admin portal
    'exp://localhost:8081',   // Expo dev client
  ],
  credentials: true,
}));
app.use((req, res, next) => { console.log('[mw-2] after cors', req.method, req.url); next(); });
app.use((req, res, next) => {
  express.json({ limit: '10mb' })(req, res, (err) => {
    if (err) {
      console.error('[mw-3] express.json FAILED:', err.message, err.stack);
      res.status(400).json({ success: false, error: 'JSON parse error', detail: err.message });
      return;
    }
    console.log('[mw-3] after json (with parse check)', req.method, req.url);
    next();
  });
});
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use((req, res, next) => { console.log('[mw-4] after urlencoded', req.method, req.url); next(); });

// ── Logging ──────────────────────────────────────────────────────────────────
if (config.isDev) {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}
app.use((req, res, next) => { console.log('[mw-5] after morgan', req.method, req.url); next(); });

// ── Rate limiting ─────────────────────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests, please try again later.' },
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
app.use(limiter as any);
app.use((req, res, next) => { console.log('[mw-6] after limiter', req.method, req.url); next(); });

// OTP endpoint gets stricter limiting
const otpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 5,
  message: { success: false, error: 'Too many OTP requests, please wait before trying again.' },
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
app.use('/api/auth/request-otp', otpLimiter as any);
app.use('/api/auth/request-otp', (req, res, next) => { console.log('[mw-7] after otpLimiter', req.method, req.url); next(); });

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api', routes);

// ── 404 and error handling ────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

// ── Start server ──────────────────────────────────────────────────────────────
const server = app.listen(config.port, () => {
  console.log(`\n🧟 ZombieTech API DIAG-7 running on port ${config.port}`);
  console.log(`   Environment: ${config.nodeEnv}`);
  console.log(`   Health check: http://localhost:${config.port}/api/health\n`);
});

// ── Background jobs ───────────────────────────────────────────────────────────
// Auto-release settlements: Monday 10:00 UTC = Monday 12:00 SAST
cron.schedule('0 10 * * 1', () => {
  runAutoRelease().catch((err) => console.error('[auto-release] Error:', err));
}, { timezone: 'UTC' });

// Document expiry alerts: daily 06:00 UTC = 08:00 SAST
cron.schedule('0 6 * * *', () => {
  runDocumentExpiryAlerts().catch((err) => console.error('[doc-expiry] Error:', err));
}, { timezone: 'UTC' });

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received — shutting down gracefully');
  server.close(() => process.exit(0));
});

process.on('SIGINT', () => {
  console.log('SIGINT received — shutting down gracefully');
  server.close(() => process.exit(0));
});

export default app;
