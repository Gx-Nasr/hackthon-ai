import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../db.js';
import { hashToken, readSessionCookie } from '../lib/session.js';

export interface AuthRequest extends Request { userId?: string; user?: { id: string; studentId: string; name: string; email: string; onboardingComplete: boolean } }
export async function requireAuth(request: AuthRequest, response: Response, next: NextFunction) {
  try {
    const token = readSessionCookie(request.headers.cookie);
    if (!token) return response.status(401).json({ message: 'Please sign in to continue.', code: 'UNAUTHENTICATED' });
    const session = await prisma.session.findUnique({ where: { tokenHash: hashToken(token) }, include: { user: true } });
    if (!session || session.expiresAt <= new Date()) {
      if (session) await prisma.session.delete({ where: { id: session.id } });
      return response.status(401).json({ message: 'Your session has expired. Please sign in again.', code: 'SESSION_EXPIRED' });
    }
    let studentId = session.user.studentId;
    if (!studentId) studentId = (await prisma.user.update({ where: { id: session.user.id }, data: { studentId: `UR-${crypto.randomUUID().replaceAll('-', '').slice(0, 16).toUpperCase()}` }, select: { studentId: true } })).studentId ?? '';
    request.userId = session.user.id;
    request.user = { id: session.user.id, studentId, name: session.user.name, email: session.user.email, onboardingComplete: Boolean(session.user.onboardingCompletedAt) };
    return next();
  } catch (error) { return next(error); }
}
