import { OTP_LENGTH } from '../constants';

/**
 * Generate a numeric OTP of the configured length.
 */
export function generateOtp(): string {
  const max = Math.pow(10, OTP_LENGTH);
  const min = Math.pow(10, OTP_LENGTH - 1);
  return String(Math.floor(Math.random() * (max - min)) + min);
}

/**
 * Check if an OTP expiry timestamp is still valid.
 */
export function isOtpValid(expiresAt: Date | null): boolean {
  if (!expiresAt) return false;
  return new Date() < expiresAt;
}
