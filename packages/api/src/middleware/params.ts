import { Request } from 'express';

/**
 * Safely extract a route param as a plain string.
 * @types/express v5 types params as `string | string[]` — this narrows it.
 */
export function param(req: Request, key: string): string {
  const val = req.params[key];
  if (Array.isArray(val)) return val[0];
  return val ?? '';
}
