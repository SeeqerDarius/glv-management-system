import path from "node:path";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function getDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL?.replace(/^"|"$/g, "").trim();
  const unpooledUrl = process.env.DATABASE_URL_UNPOOLED
    ?.replace(/^"|"$/g, "")
    .trim();
  const connectionString = databaseUrl || unpooledUrl;

  if (!connectionString) {
    throw new Error("DATABASE_URL is not configured.");
  }

  try {
    const url = new URL(connectionString);
    // Only set connect_timeout — do NOT set pool_timeout on Neon serverless,
    // it conflicts with the pooler and causes connection exhaustion errors.
    if (!url.searchParams.has("connect_timeout")) {
      url.searchParams.set("connect_timeout", "15");
    }
    url.searchParams.delete("pool_timeout");
    url.searchParams.set("sslmode", "require");
    url.searchParams.set(
      "sslcert",
      path.join(process.cwd(), "prisma", "prod-ca-2021.crt")
    );
    return url.toString();
  } catch {
    return connectionString;
  }
}

let client: PrismaClient | undefined;

function getClient() {
  if (!client) {
    client = globalForPrisma.prisma ?? new PrismaClient({
      datasourceUrl: getDatabaseUrl(),
    });

    if (process.env.NODE_ENV !== "production") {
      globalForPrisma.prisma = client;
    }
  }

  return client;
}

/**
 * The client is created on first real use rather than at import time.
 *
 * `getDatabaseUrl()` throws when no connection string is configured, and
 * `app/layout.tsx` imports this module, so building used to require live
 * database credentials: `next build` evaluates the module while collecting page
 * data for `/_not-found` and died with "DATABASE_URL is not configured." That
 * broke every Vercel preview deployment, where the variable is not set.
 *
 * Deferring construction keeps the credential check where it belongs — the
 * first query — so a build needs no database while a request still fails loudly
 * if the environment is genuinely misconfigured.
 *
 * Only `get` and `has` are trapped. Prisma's delegates rely on dynamic property
 * descriptors, and forwarding `ownKeys`/`getOwnPropertyDescriptor` through a
 * proxy over an empty target risks violating the proxy invariants; nothing in
 * this codebase enumerates or spreads the client.
 */
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const target = getClient();
    const value = Reflect.get(target, property, target);

    // Methods such as $transaction must keep the real client as `this`.
    return typeof value === "function" ? value.bind(target) : value;
  },
  has(_target, property) {
    return Reflect.has(getClient(), property);
  },
});
