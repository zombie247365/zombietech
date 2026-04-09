/**
 * Server-side auth helpers.
 * This file must only be imported by server components or server actions.
 */
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
export { COOKIE_NAME } from './constants';

export function getToken(): string | undefined {
  return cookies().get(COOKIE_NAME)?.value;
}

export function requireAdmin(): string {
  const token = getToken();
  if (!token) redirect('/login');
  return token;
}
