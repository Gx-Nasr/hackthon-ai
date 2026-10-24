import { Router } from 'express';
import multer from 'multer';
import { prisma } from '../db.js';
import { requireAuth, type AuthRequest } from '../middleware/requireAuth.js';

export const campusRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 12 * 1024 * 1024, files: 4 } });
const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

campusRouter.use(requireAuth);
campusRouter.use(upload.fields([{ name: 'file', maxCount: 1 }, { name: 'images', maxCount: 4 }]));
campusRouter.use(async (request: AuthRequest, response, next) => {
  try {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: request.userId! }, include: { interests: true, unavailableBlocks: true } });
    const profile = {
      student_id: user.studentId ?? user.id, name: user.name, home_campus: user.homeCampus ?? 'Rabat',
      school: user.school ?? 'UM6P', interests: user.interests.map((item) => item.value),
      busy_slots: user.unavailableBlocks.map((block) => ({ day_of_week: weekdays[block.dayOfWeek - 1],
        start_time: block.startTime, end_time: block.endTime, title: block.activityName ?? 'Class', campus: user.homeCampus ?? 'Rabat', location: '' })),
    };
    const headers = { 'X-Student-Profile': Buffer.from(JSON.stringify(profile)).toString('base64') };
    let body: FormData | undefined;
    if (request.method === 'POST') {
      body = new FormData();
      for (const [key, value] of Object.entries(request.body ?? {})) if (typeof value === 'string') body.append(key, value);
      const files = request.files as Record<string, Express.Multer.File[]> | undefined;
      for (const [key, values] of Object.entries(files ?? {})) for (const file of values) {
        body.append(key, new Blob([new Uint8Array(file.buffer)], { type: file.mimetype }), file.originalname);
      }
    }
    const upstream = await fetch(`${process.env.PYTHON_API_URL ?? 'http://127.0.0.1:8000'}${request.originalUrl}`, {
      method: request.method, headers, body, signal: AbortSignal.timeout(120_000),
    });
    response.status(upstream.status);
    for (const key of ['content-type', 'content-disposition']) {
      const value = upstream.headers.get(key);
      if (value) response.setHeader(key, value);
    }
    response.send(Buffer.from(await upstream.arrayBuffer()));
  } catch (error) { next(error); }
});
