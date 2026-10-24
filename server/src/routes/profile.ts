import { randomBytes } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireAuth, type AuthRequest } from '../middleware/requireAuth.js';

const profileRouter = Router();
const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const blockSchema = z.object({
  dayOfWeek: z.number().int().min(1).max(7),
  startTime: z.string().regex(timePattern, 'Use a valid 24-hour time (HH:mm).'),
  endTime: z.string().regex(timePattern, 'Use a valid 24-hour time (HH:mm).'),
  activityName: z.string().trim().max(80).optional().nullable(),
}).superRefine((block, context) => {
  if (block.startTime >= block.endTime) context.addIssue({ code: z.ZodIssueCode.custom, path: ['endTime'], message: 'End time must be later than start time.' });
});
const profileSchema = z.object({
  fullName: z.string().trim().min(2).max(80),
  homeCampus: z.enum(['Rabat', 'Ben Guerir']),
  school: z.string().trim().min(1, 'Enter your school or college.').max(120),
  interests: z.array(z.string().trim().min(1).max(60)).min(1, 'Choose at least one interest.').max(30),
  unavailableBlocks: z.array(blockSchema).max(84),
}).superRefine((profile, context) => {
  const uniqueInterests = new Set(profile.interests.map((value) => value.toLocaleLowerCase()));
  if (uniqueInterests.size !== profile.interests.length) context.addIssue({ code: z.ZodIssueCode.custom, path: ['interests'], message: 'Remove duplicate interests.' });
  profile.unavailableBlocks.forEach((block, index) => {
    profile.unavailableBlocks.slice(index + 1).forEach((other) => {
      if (block.dayOfWeek === other.dayOfWeek && block.startTime < other.endTime && other.startTime < block.endTime) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: ['unavailableBlocks'], message: 'Busy time blocks on the same day cannot overlap.' });
      }
    });
  });
});

function newStudentId() { return `UR-${randomBytes(8).toString('hex').toUpperCase()}`; }
async function ensureStudentId(userId: string, existing: string | null) {
  if (existing) return existing;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const candidate = newStudentId();
    try { const user = await prisma.user.update({ where: { id: userId }, data: { studentId: candidate }, select: { studentId: true } }); return user.studentId ?? candidate; }
    catch (error) { if (attempt === 2) throw error; }
  }
  throw new Error('Could not assign a student ID.');
}

async function serializeProfile(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    include: { interests: { orderBy: { createdAt: 'asc' } }, unavailableBlocks: { orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }] } },
  });
  const studentId = await ensureStudentId(user.id, user.studentId);
  return {
    studentId, fullName: user.name, homeCampus: user.homeCampus, school: user.school ?? '',
    interests: user.interests.map((item) => item.value),
    unavailableBlocks: user.unavailableBlocks.map(({ id, dayOfWeek, startTime, endTime, activityName }) => ({ id, dayOfWeek, startTime, endTime, activityName })),
    onboardingComplete: Boolean(user.onboardingCompletedAt),
  };
}

profileRouter.get('/profile', requireAuth, async (request: AuthRequest, response, next) => {
  try { return response.json({ profile: await serializeProfile(request.userId!) }); }
  catch (error) { return next(error); }
});

profileRouter.put('/profile', requireAuth, async (request: AuthRequest, response, next) => {
  const parsed = profileSchema.safeParse(request.body);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0] ?? 'form')] ??= issue.message;
    return response.status(400).json({ message: 'Please review your profile and weekly busy times.', fieldErrors });
  }
  try {
    const data = parsed.data;
    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: request.userId! }, data: { name: data.fullName, homeCampus: data.homeCampus, school: data.school, onboardingCompletedAt: new Date() } });
      await tx.studentInterest.deleteMany({ where: { userId: request.userId! } });
      await tx.unavailableTimeBlock.deleteMany({ where: { userId: request.userId! } });
      if (data.interests.length) await tx.studentInterest.createMany({ data: data.interests.map((value) => ({ userId: request.userId!, value })) });
      if (data.unavailableBlocks.length) await tx.unavailableTimeBlock.createMany({ data: data.unavailableBlocks.map((block) => ({ ...block, activityName: block.activityName || null, userId: request.userId! })) });
    });
    return response.json({ profile: await serializeProfile(request.userId!) });
  } catch (error) { return next(error); }
});

export { profileRouter };
