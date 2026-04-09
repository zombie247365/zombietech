import dotenv from 'dotenv';
import path from 'path';

// Load .env from monorepo root
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

function required(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
}

export const config = {
  port: parseInt(process.env.API_PORT ?? '4000', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  isDev: (process.env.NODE_ENV ?? 'development') === 'development',

  jwt: {
    secret: process.env.JWT_SECRET ?? 'zombietech-dev-secret-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  },

  database: {
    url: process.env.DATABASE_URL ?? '',
  },

  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID ?? '',
    authToken: process.env.TWILIO_AUTH_TOKEN ?? '',
    phoneNumber: process.env.TWILIO_PHONE_NUMBER ?? '',
  },

  aws: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? '',
    region: process.env.AWS_REGION ?? 'af-south-1',
    s3Bucket: process.env.AWS_S3_BUCKET ?? 'zombietech-documents',
  },

  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY ?? '',
  },

  otp: {
    expiresMinutes: 10,
    bypassInDev: true, // In dev, accept '123456' as valid OTP
    devOtp: '123456',
  },

  peach: {
    apiKey: process.env.PEACH_PAYMENTS_API_KEY ?? '',
    merchantId: process.env.PEACH_PAYMENTS_MERCHANT_ID ?? '',
    webhookSecret: process.env.PEACH_PAYMENTS_WEBHOOK_SECRET ?? '',
    sandboxMode: (process.env.NODE_ENV ?? 'development') !== 'production',
  },

  expo: {
    accessToken: process.env.EXPO_ACCESS_TOKEN ?? '',
  },

  fcm: {
    serviceAccountPath: process.env.FCM_SERVICE_ACCOUNT_PATH ?? '',
  },
} as const;
