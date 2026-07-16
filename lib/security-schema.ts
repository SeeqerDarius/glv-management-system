import { prisma } from "@/lib/prisma";

const globalSecuritySchema = globalThis as unknown as {
  glvSecuritySchemaReady?: boolean;
};

export type TwoFactorState = {
  enabled: boolean;
  secret: string | null;
  confirmedAt: Date | null;
};

export async function ensureSecuritySchema() {
  if (globalSecuritySchema.glvSecuritySchemaReady) {
    return;
  }

  await prisma.$executeRawUnsafe(`
    ALTER TABLE "User"
    ADD COLUMN IF NOT EXISTS "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS "twoFactorSecret" TEXT,
    ADD COLUMN IF NOT EXISTS "twoFactorConfirmedAt" TIMESTAMP(3)
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "LoginRateLimit" (
      "id" TEXT NOT NULL,
      "identifier" TEXT NOT NULL,
      "attempts" INTEGER NOT NULL DEFAULT 0,
      "lockedUntil" TIMESTAMP(3),
      "lastAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "LoginRateLimit_pkey" PRIMARY KEY ("id")
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "LoginRateLimit_identifier_key"
    ON "LoginRateLimit"("identifier")
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "LoginRateLimit_lockedUntil_idx"
    ON "LoginRateLimit"("lockedUntil")
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "LoginRateLimit_lastAttemptAt_idx"
    ON "LoginRateLimit"("lastAttemptAt")
  `);

  globalSecuritySchema.glvSecuritySchemaReady = true;
}

export async function getTwoFactorState(userId: string): Promise<TwoFactorState> {
  try {
    await ensureSecuritySchema();
    const rows = await prisma.$queryRaw<
      Array<{
        twoFactorEnabled: boolean;
        twoFactorSecret: string | null;
        twoFactorConfirmedAt: Date | null;
      }>
    >`
      select "twoFactorEnabled", "twoFactorSecret", "twoFactorConfirmedAt"
      from "User"
      where id = ${userId}
      limit 1
    `;
    const row = rows[0];

    return {
      enabled: Boolean(row?.twoFactorEnabled),
      secret: row?.twoFactorSecret ?? null,
      confirmedAt: row?.twoFactorConfirmedAt ?? null,
    };
  } catch (error) {
    console.error("SECURITY_SCHEMA_TWO_FACTOR_READ_FAILED", error);
    return {
      enabled: false,
      secret: null,
      confirmedAt: null,
    };
  }
}
