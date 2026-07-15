import { neonConfig } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@prisma/client";
import ws from "ws";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

neonConfig.webSocketConstructor = ws;

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
    // Remove pool_timeout if it was previously set
    url.searchParams.delete("pool_timeout");
    return url.toString();
  } catch {
    return connectionString;
  }
}

const adapter = new PrismaNeon({
  connectionString: getDatabaseUrl(),
});

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
