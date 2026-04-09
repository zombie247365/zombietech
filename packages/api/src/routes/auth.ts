import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '@zombietech/database';
import { validate } from '../middleware/validate';
import { issueToken, authenticate, AuthRequest, PlatformRole } from '../middleware/auth';
import { auditLog } from '../middleware/auditLogger';
import { config } from '../config';
import { AppError } from '../middleware/errorHandler';
import { sendOtpSms } from '../services/sms';
import { OTP_EXPIRES_MINUTES } from '@zombietech/shared';

const router = Router();

// ── Schemas ──────────────────────────────────────────────────────────────────

const sendOtpSchema = z.object({
  mobile: z.string().regex(/^\+27[0-9]{9}$/, 'Must be a valid SA mobile number (+27XXXXXXXXX)'),
});

const verifyOtpSchema = z.object({
  mobile: z.string().regex(/^\+27[0-9]{9}$/),
  otp: z.string().length(6, 'OTP must be 6 digits'),
  // Registration fields — required only for new users
  full_name: z.string().min(2).max(255).optional(),
  email: z.string().email().optional(),
  role: z.enum(['site_owner', 'operator']).optional(),
});

// ── POST /auth/send-otp ────────────────────────────────────────────────────

/**
 * Sends a 6-digit OTP to the given mobile number.
 * Also aliased at /auth/request-otp for backwards compatibility.
 */
async function handleSendOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { mobile } = req.body as { mobile: string };

    const otp = config.isDev && config.otp.bypassInDev
      ? config.otp.devOtp
      : String(Math.floor(100000 + Math.random() * 900000));

    const expiresAt = new Date(Date.now() + OTP_EXPIRES_MINUTES * 60 * 1000);
    const hash = await bcrypt.hash(otp, 10);

    const existingUser = await prisma.user.findFirst({ where: { mobile } });

    if (existingUser) {
      await prisma.user.update({
        where: { id: existingUser.id },
        data: { otp_hash: hash, otp_expires_at: expiresAt },
      });
    }
    // If user doesn't exist yet, we store the OTP only after they provide registration
    // fields in verify-otp. Nothing to store here for new users.

    // Send OTP via Twilio SMS (dev mode logs to console, prod sends live SMS)
    await sendOtpSms(mobile, otp);

    res.json({
      success: true,
      data: {
        is_registered: !!existingUser,
        expires_in_seconds: OTP_EXPIRES_MINUTES * 60,
        ...(config.isDev ? { dev_otp: otp } : {}),
      },
    });
  } catch (err) {
    next(err);
  }
}

router.post('/send-otp', validate(sendOtpSchema), handleSendOtp);
router.post('/request-otp', validate(sendOtpSchema), handleSendOtp); // alias

// ── POST /auth/verify-otp ─────────────────────────────────────────────────

router.post(
  '/verify-otp',
  validate(verifyOtpSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { mobile, otp, full_name, email, role } = req.body as {
        mobile: string;
        otp: string;
        full_name?: string;
        email?: string;
        role?: 'site_owner' | 'operator';
      };

      let user = await prisma.user.findFirst({ where: { mobile } });

      if (!user) {
        // New user — registration fields required
        if (!full_name || !email || !role) {
          throw new AppError(
            422,
            'New user registration requires full_name, email, and role',
            'REGISTRATION_REQUIRED',
          );
        }
        // Check email uniqueness
        const emailExists = await prisma.user.findUnique({ where: { email } });
        if (emailExists) {
          throw new AppError(409, 'An account with this email already exists', 'EMAIL_TAKEN');
        }

        const hash = await bcrypt.hash(otp, 10);
        const expiresAt = new Date(Date.now() + OTP_EXPIRES_MINUTES * 60 * 1000);

        user = await prisma.user.create({
          data: { mobile, full_name, email, role, otp_hash: hash, otp_expires_at: expiresAt },
        });

        if (role === 'site_owner') {
          await prisma.siteOwner.create({
            data: { user_id: user.id, trading_name: full_name, business_category: 'Other' },
          });
        } else {
          await prisma.operator.create({
            data: {
              user_id: user.id,
              trading_concept: '',
              food_category: '',
              emergency_contact_name: '',
              emergency_contact_mobile: mobile,
              activation_fee_balance: 0,
            },
          });
        }
      }

      // OTP verification
      const isDevBypass = config.isDev && otp === config.otp.devOtp;

      if (!isDevBypass) {
        if (!user.otp_hash || !user.otp_expires_at) {
          throw new AppError(400, 'No OTP was requested for this number', 'NO_OTP');
        }
        if (new Date() > user.otp_expires_at) {
          throw new AppError(400, 'OTP has expired — request a new one', 'OTP_EXPIRED');
        }
        const valid = await bcrypt.compare(otp, user.otp_hash);
        if (!valid) throw new AppError(400, 'Invalid OTP', 'INVALID_OTP');
      }

      await prisma.user.update({
        where: { id: user.id },
        data: {
          otp_hash: null,
          otp_expires_at: null,
          mobile_verified_at: user.mobile_verified_at ?? new Date(),
        },
      });

      const token = issueToken({ sub: user.id, role: user.role as PlatformRole, email: user.email });
      const refreshToken = issueToken({ sub: user.id, role: user.role as PlatformRole, email: user.email });
      // Note: in prod, refreshToken would use a longer expiry and be stored/rotated.
      // For Phase 2 it mirrors the access token with the same expiry.

      await auditLog(req as AuthRequest, 'auth.login', 'user', user.id, {
        mobile,
        role: user.role,
        is_new_user: !user.mobile_verified_at,
      });

      res.json({
        success: true,
        data: {
          token,
          refresh_token: refreshToken,
          user: {
            id: user.id,
            email: user.email,
            mobile: user.mobile,
            full_name: user.full_name,
            role: user.role,
          },
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

// ── POST /auth/refresh ─────────────────────────────────────────────────────

router.post(
  '/refresh',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user!.id },
        select: { id: true, email: true, role: true, mobile_verified_at: true },
      });
      if (!user) throw new AppError(401, 'User not found', 'NOT_FOUND');

      const token = issueToken({ sub: user.id, role: user.role as PlatformRole, email: user.email });
      res.json({ success: true, data: { token } });
    } catch (err) {
      next(err);
    }
  },
);

// ── GET /auth/me ───────────────────────────────────────────────────────────

router.get('/me', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true, email: true, mobile: true, full_name: true, role: true,
        email_verified_at: true, mobile_verified_at: true, created_at: true,
        site_owner: { select: { id: true, trading_name: true, site_score: true, score_tier: true } },
        operator: { select: { id: true, trading_concept: true, trust_score: true, vetting_status: true, activation_fee_balance: true } },
      },
    });
    if (!user) throw new AppError(404, 'User not found', 'NOT_FOUND');
    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
});

export default router;
