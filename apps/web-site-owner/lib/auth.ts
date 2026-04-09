/**
 * Server-side auth helpers.
 * Reads the JWT from the `zt_token` httpOnly cookie.
 * This file must only be imported by server components or server actions.
 */
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
export { COOKIE_NAME } from './constants';

/** Get the JWT token from cookies (server components only). */
export function getToken(): string | undefined {
  return cookies().get(COOKIE_NAME)?.value;
}

/** Get token or redirect to /register. */
export function requireAuth(): string {
  const token = getToken();
  if (!token) redirect('/register');
  return token;
}

/** Decode the JWT payload without verification (display only). */
export function decodeToken(token: string): Record<string, unknown> | null {
  try {
    const payload = token.split('.')[1];
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8'));
  } catch {
    return null;
  }
}

/** Get the current user id from the JWT (no DB call). */
export function getTokenUser(token: string): { id: string; role: string } | null {
  const payload = decodeToken(token);
  if (!payload || typeof payload.sub !== 'string') return null;
  return { id: payload.sub, role: payload.role as string };
}
