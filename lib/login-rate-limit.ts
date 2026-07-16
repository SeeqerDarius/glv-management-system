import { prisma } from "@/lib/prisma";
import { ensureSecuritySchema } from "@/lib/security-schema";

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

  const record = await withRateLimitSchema(() =>
    prisma.loginRateLimit.findUnique({
      where: { identifier },
    })
  );

  if (!record) return;

  if (!record?.lockedUntil) return;

  if (record.lockedUntil > new Date()) {
    throw new LoginRateLimitError(record.lockedUntil);
  }

  await withRateLimitSchema(() =>
    prisma.loginRateLimit.update({
      where: { identifier },
      data: {
        attempts: 0,
        lockedUntil: null,
        lastAttemptAt: new Date(),
      },
    })
  );
}

export async function recordFailedLogin(email: string) {
  const identifier = normalizeIdentifier(email);
  if (!identifier) return;

  const now = new Date();
  const staleBefore = new Date(now.getTime() - staleAttemptMinutes * 60_000);
  const existing = await withRateLimitSchema(() =>
    prisma.loginRateLimit.findUnique({
      where: { identifier },
    })
  );
  const attempts =
    existing && existing.lastAttemptAt > staleBefore ? existing.attempts + 1 : 1;
  const lockedUntil =
    attempts >= maxLoginAttempts
      ? new Date(now.getTime() + lockoutMinutes * 60_000)
      : null;

  await withRateLimitSchema(() =>
    prisma.loginRateLimit.upsert({
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
    })
  );
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

async function withRateLimitSchema<T>(operation: () => Promise<T>) {
  try {
    await ensureSecuritySchema();
    return await operation();
  } catch (error) {
    console.error("LOGIN_RATE_LIMIT_UNAVAILABLE", error);
    return null;
  }
}
