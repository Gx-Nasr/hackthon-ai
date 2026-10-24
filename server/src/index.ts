import 'dotenv/config';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import express, { type ErrorRequestHandler } from 'express';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { prisma } from './db.js';
import { authRouter } from './routes/auth.js';
import { profileRouter } from './routes/profile.js';

const app = express();
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const clientOutput = path.join(projectRoot, 'dist/client');
const allowedOrigins = new Set((process.env.ALLOWED_ORIGINS ?? 'http://localhost:3000,http://127.0.0.1:3000')
  .split(',').map((origin) => origin.trim()).filter(Boolean));

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use((_, response, next) => {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  // Do not set X-Frame-Options or a self-only frame-ancestors policy: Preview runs in a cross-site iframe.
  next();
});
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) return callback(null, true);
    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
}));
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());

app.get('/api/health', (_request, response) => response.json({ status: 'ok', service: 'uniradar' }));
app.use('/api/auth', authRouter);
app.use('/api', profileRouter);
app.use('/api', (_request, response) => response.status(404).json({ message: 'This API route is not connected yet.', code: 'API_NOT_CONFIGURED' }));

const isProduction = process.env.NODE_ENV === 'production';
if (!isProduction) {
  const { createServer: createViteServer } = await import('vite');
  const vite = await createViteServer({ configFile: path.join(projectRoot, 'vite.config.ts'), server: { middlewareMode: true }, appType: 'spa', logLevel: 'info' });
  app.use(vite.middlewares as unknown as import('express').RequestHandler);
} else {
  if (!existsSync(path.join(clientOutput, 'index.html'))) throw new Error('Built client files were not found. Run pnpm build first.');
  app.use(express.static(clientOutput, { index: false, etag: true, maxAge: '1h' }));
  app.get('*', (request, response, next) => {
    if (request.method !== 'GET' || !request.accepts('html')) return next();
    return response.sendFile(path.join(clientOutput, 'index.html'));
  });
}

const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  console.error('Request failed:', error instanceof Error ? error.message : 'unknown error');
  if (response.headersSent) return;
  response.status(500).json({ message: 'Something went wrong on our side. Please try again.', code: 'INTERNAL_ERROR' });
};
app.use(errorHandler);

const port = Number.parseInt(process.env.PORT ?? '3000', 10);
try {
  await prisma.$connect();
  app.listen(port, '0.0.0.0', () => console.log(`UniRadar listening on 0.0.0.0:${port}`));
} catch (error) {
  console.error('Could not start UniRadar. Ensure database migrations are applied.', error);
  process.exitCode = 1;
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, async () => { await prisma.$disconnect(); process.exit(0); });
}
