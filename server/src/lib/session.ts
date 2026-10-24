import { createHash, randomBytes } from 'node:crypto';
import type { CookieOptions, Response } from 'express';
import { prisma } from '../db.js';

export const SESSION_COOKIE = 'uniradar_sid';
const cookieMode = process.env.COOKIE_MODE === 'local' ? 'local' : 'preview';

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function cookieOptions(maxAge?: number): CookieOptions {
  const isPreview = cookieMode === 'preview';
  return {
    httpOnly: true,
    secure: isPreview,
    sameSite: isPreview ? 'none' : 'lax',
    path: '/',
    ...(maxAge ? { maxAge } : {}),
  };
}

export async function issueSession(userId: string, rememberMe: boolean, response: Response): Promise<void> {
  const token = randomBytes(32).toString('base64url');
  const configuredHours = Math.max(1, Number(process.env.SESSION_TTL_HOURS) || 24);
  const lifetimeMs = (rememberMe ? 30 * 24 : configuredHours) * 60 * 60 * 1000;
  const expiresAt = new Date(Date.now() + lifetimeMs);
  await prisma.session.create({ data: { userId, tokenHash: hashToken(token), expiresAt } });
  response.cookie(SESSION_COOKIE, token, cookieOptions(lifetimeMs));
}

export function clearSessionCookie(response: Response): void {
  response.clearCookie(SESSION_COOKIE, cookieOptions());
}

export function readSessionCookie(cookieHeader?: string): string | null {
  if (!cookieHeader) return null;
  const item = cookieHeader.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${SESSION_COOKIE}=`));
  if (!item) return null;
  try { return decodeURIComponent(item.slice(SESSION_COOKIE.length + 1)); } catch { return null; }
}
