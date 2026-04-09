import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export const COOKIE_NAME = 'zt_admin_token';

export function getToken(): string | undefined {
  return cookies().get(COOKIE_NAME)?.value;
}

export function requireAdmin(): string {
  const token = getToken();
  if (!token) redirect('/login');
  return token;
}
