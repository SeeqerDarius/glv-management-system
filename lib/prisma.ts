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

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasourceUrl: getDatabaseUrl(),
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
