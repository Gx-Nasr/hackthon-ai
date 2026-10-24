import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

if (process.env.NODE_ENV === 'production') throw new Error('Demo seeding is disabled in production.');
const email = process.env.DEMO_EMAIL?.trim().toLowerCase();
const password = process.env.DEMO_PASSWORD;
const name = process.env.DEMO_NAME?.trim();
if (!email || !password || !name) throw new Error('Set DEMO_EMAIL, DEMO_PASSWORD and DEMO_NAME in the server environment before seeding.');
if (Buffer.byteLength(password, 'utf8') < 8 || Buffer.byteLength(password, 'utf8') > 72) throw new Error('DEMO_PASSWORD must be 8–72 bytes.');

const prisma = new PrismaClient();
try {
  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.upsert({ where: { email }, update: { name, passwordHash }, create: { email, name, passwordHash } });
  console.log(`Seeded development account: ${email}`);
} finally { await prisma.$disconnect(); }
