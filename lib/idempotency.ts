import "server-only";

import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";

const KEY_PATTERN = /^[a-zA-Z0-9:_-]{8,200}$/;
const RETENTION_HOURS = 72;

export function readIdempotencyKey(formData: FormData) {
  return normalizeIdempotencyKey(formData.get("idempotencyKey"));
}

export function normalizeIdempotencyKey(value: unknown) {
  const key = String(value ?? "").trim();
  return KEY_PATTERN.test(key) ? key : null;
}

export async function claimIdempotencyKey({
  tx,
  userId,
  operation,
  key,
}: {
  tx: Prisma.TransactionClient;
  userId: string;
  operation: string;
  key: string;
}) {
  await tx.idempotencyKey.deleteMany({
    where: {
      userId,
      operation,
      key,
      expiresAt: { lt: new Date() },
    },
  });

  const id = randomUUID();
  const expiresAt = new Date(
    Date.now() + RETENTION_HOURS * 60 * 60 * 1000
  );
  const inserted = await tx.$queryRaw<Array<{ id: string }>>`
    INSERT INTO "IdempotencyKey"
      ("id", "key", "operation", "userId", "expiresAt")
    VALUES
      (${id}, ${key}, ${operation}, ${userId}, ${expiresAt})
    ON CONFLICT ("userId", "operation", "key") DO NOTHING
    RETURNING "id"
  `;

  if (inserted.length > 0) {
    return { claimed: true as const, id, resourceId: null };
  }

  const existing = await tx.idempotencyKey.findUnique({
    where: {
      userId_operation_key: {
        userId,
        operation,
        key,
      },
    },
    select: {
      id: true,
      resourceId: true,
    },
  });

  return {
    claimed: false as const,
    id: existing?.id ?? null,
    resourceId: existing?.resourceId ?? null,
  };
}

export async function completeIdempotencyKey(
  tx: Prisma.TransactionClient,
  id: string,
  resourceId: string
) {
  await tx.idempotencyKey.update({
    where: { id },
    data: { resourceId },
  });
}
