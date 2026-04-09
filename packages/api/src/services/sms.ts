/**
 * SMS service — Twilio integration.
 *
 * In development (isDev=true or missing Twilio credentials),
 * messages are logged to the console rather than sent.
 *
 * In production, all credentials must be set:
 *   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER
 */

import { config } from '../config';

// Lazily require Twilio so the server boots without credentials in dev.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _twilioClient: any | null = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getClient(): any {
  if (!config.twilio.accountSid || !config.twilio.authToken) {
    return null;
  }
  if (!_twilioClient) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const twilio = require('twilio');
    _twilioClient = twilio(config.twilio.accountSid, config.twilio.authToken);
  }
  return _twilioClient;
}

export interface SmsResult {
  success: boolean;
  sid?: string;
  error?: string;
  dev_mode?: boolean;
}

/**
 * Send an SMS message to a recipient.
 * Returns SmsResult — never throws.
 */
export async function sendSms(to: string, body: string): Promise<SmsResult> {
  // Dev mode or missing credentials: log only
  if (config.isDev || !config.twilio.accountSid) {
    console.log(`[SMS DEV] To: ${to} | Message: ${body}`);
    return { success: true, dev_mode: true };
  }

  const client = getClient();
  if (!client) {
    console.warn(`[sms] Cannot send SMS to ${to} — Twilio not configured`);
    return { success: false, error: 'SMS service not configured' };
  }

  try {
    const message = await client.messages.create({
      body,
      from: config.twilio.phoneNumber,
      to,
    });
    console.log(`[sms] Sent to ${to} — SID: ${message.sid}`);
    return { success: true, sid: message.sid as string };
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    console.error(`[sms] Failed to send to ${to}:`, error);
    return { success: false, error };
  }
}

/**
 * Send a 6-digit OTP via SMS.
 */
export async function sendOtpSms(mobile: string, otp: string): Promise<SmsResult> {
  const body = `Your ZombieTech verification code is: ${otp}. Valid for 10 minutes. Do not share this code.`;
  return sendSms(mobile, body);
}

/**
 * Send a settlement notification SMS.
 */
export async function sendSettlementSms(
  mobile: string,
  ref: string,
  payoutRands: number,
): Promise<SmsResult> {
  const body = `ZombieTech: Settlement ${ref} of R${payoutRands.toFixed(2)} has been released to your account.`;
  return sendSms(mobile, body);
}

/**
 * Send a booking approval/decline notification SMS.
 */
export async function sendBookingApprovalSms(
  mobile: string,
  siteName: string,
  approved: boolean,
): Promise<SmsResult> {
  const body = approved
    ? `ZombieTech: Your booking request for ${siteName} was approved! A contract is ready for your signature in the app.`
    : `ZombieTech: Your booking request for ${siteName} was not approved. Open the app for details.`;
  return sendSms(mobile, body);
}
