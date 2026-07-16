import { prisma } from "@/lib/prisma";

const maxLoginAttempts = 5;
const lockoutMinutes = 15;
const staleAttemptMinutes = 30;

export class LoginRateLimitError extends Error {
  constructor(public lockedUntil: Date) {
    super("Too many login attempts.");
  }
}

function normalizeIdentifier(email: string) {
  return email.trim().toLowerCase();
}

export async function assertLoginAllowed(email: string) {
  const identifier = normalizeIdentifier(email);
  if (!identifier) return;

  const record = await prisma.loginRateLimit.findUnique({
    where: { identifier },
  });

  if (!record?.lockedUntil) return;

  if (record.lockedUntil > new Date()) {
    throw new LoginRateLimitError(record.lockedUntil);
  }

  await prisma.loginRateLimit.update({
    where: { identifier },
    data: {
      attempts: 0,
      lockedUntil: null,
      lastAttemptAt: new Date(),
    },
  });
}

export async function recordFailedLogin(email: string) {
  const identifier = normalizeIdentifier(email);
  if (!identifier) return;

  const now = new Date();
  const staleBefore = new Date(now.getTime() - staleAttemptMinutes * 60_000);
  const existing = await prisma.loginRateLimit.findUnique({
    where: { identifier },
  });
  const attempts =
    existing && existing.lastAttemptAt > staleBefore ? existing.attempts + 1 : 1;
  const lockedUntil =
    attempts >= maxLoginAttempts
      ? new Date(now.getTime() + lockoutMinutes * 60_000)
      : null;

  await prisma.loginRateLimit.upsert({
    where: { identifier },
    update: {
      attempts,
      lockedUntil,
      lastAttemptAt: now,
    },
    create: {
      identifier,
      attempts,
      lockedUntil,
      lastAttemptAt: now,
    },
  });
}

export async function clearLoginRateLimit(email: string) {
  const identifier = normalizeIdentifier(email);
  if (!identifier) return;

  await prisma.loginRateLimit
    .delete({
      where: { identifier },
    })
    .catch(() => undefined);
}
