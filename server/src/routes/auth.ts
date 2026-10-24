import { randomBytes } from 'node:crypto';
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireAuth, type AuthRequest } from '../middleware/requireAuth.js';
import { clearSessionCookie, hashToken, issueSession, readSessionCookie } from '../lib/session.js';

const authRouter = Router();
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 12, standardHeaders: 'draft-7', legacyHeaders: false, message: { message: 'Too many attempts. Please wait a few minutes and try again.' } });
const passwordSchema = z.string().min(8, 'Use at least 8 characters.').max(72, 'Password must be 72 characters or fewer.').refine((value) => Buffer.byteLength(value, 'utf8') <= 72, 'Password must be 72 bytes or fewer.');
const signupSchema = z.object({ name: z.string().trim().min(2, 'Enter your full name.').max(80, 'Name is too long.'), email: z.string().trim().email('Enter a valid university email.').max(254).transform((value) => value.toLowerCase()), password: passwordSchema, termsAccepted: z.literal(true, { errorMap: () => ({ message: 'Accept the terms to create an account.' }) }) });
const loginSchema = z.object({ email: z.string().trim().email('Enter a valid email.').max(254).transform((value) => value.toLowerCase()), password: z.string().min(1, 'Enter your password.').max(72), rememberMe: z.boolean().optional().default(false) });
const publicUser = (user: { id: string; name: string; email: string; studentId: string | null; onboardingCompletedAt: Date | null }) => ({ id: user.id, name: user.name, email: user.email, studentId: user.studentId ?? '', onboardingComplete: Boolean(user.onboardingCompletedAt) });
function validationError(error: z.ZodError) { const fieldErrors: Record<string, string> = {}; for (const issue of error.issues) if (issue.path[0]) fieldErrors[String(issue.path[0])] ??= issue.message; return fieldErrors; }
authRouter.post('/signup', limiter, async (request, response, next) => {
  const parsed = signupSchema.safeParse(request.body);
  if (!parsed.success) return response.status(400).json({ message: 'Please check the highlighted fields.', fieldErrors: validationError(parsed.error) });
  try {
    const { name, email, password } = parsed.data;
    if (await prisma.user.findUnique({ where: { email } })) return response.status(409).json({ message: 'An account with this email already exists.', code: 'EMAIL_EXISTS' });
    const user = await prisma.user.create({ data: { name, email, studentId: `UR-${randomBytes(8).toString('hex').toUpperCase()}`, passwordHash: await bcrypt.hash(password, 12) } });
    await issueSession(user.id, false, response);
    return response.status(201).json({ user: publicUser(user) });
  } catch (error) { return next(error); }
});
authRouter.post('/login', limiter, async (request, response, next) => {
  const parsed = loginSchema.safeParse(request.body);
  if (!parsed.success) return response.status(400).json({ message: 'Please check your email and password.', fieldErrors: validationError(parsed.error) });
  try {
    const { email, password, rememberMe } = parsed.data;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) return response.status(401).json({ message: 'The email or password is incorrect.', code: 'INVALID_CREDENTIALS' });
    if (!user.studentId) await prisma.user.update({ where: { id: user.id }, data: { studentId: `UR-${randomBytes(8).toString('hex').toUpperCase()}` } });
    const refreshedUser = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    await issueSession(user.id, rememberMe, response);
    return response.json({ user: publicUser(refreshedUser) });
  } catch (error) { return next(error); }
});
authRouter.get('/me', requireAuth, (request: AuthRequest, response) => response.json({ user: request.user }));
authRouter.post('/logout', async (request, response, next) => {
  try { const token = readSessionCookie(request.headers.cookie); if (token) await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } }); clearSessionCookie(response); return response.json({ success: true }); }
  catch (error) { return next(error); }
});
export { authRouter };
