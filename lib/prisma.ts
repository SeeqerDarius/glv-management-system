import { neonConfig } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@prisma/client";
import ws from "ws";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

neonConfig.webSocketConstructor = ws;

function databaseUrlWithTimeouts() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not configured.");
  }

  try {
    const url = new URL(databaseUrl);
    url.searchParams.set("connect_timeout", url.searchParams.get("connect_timeout") ?? "30");
    url.searchParams.set("pool_timeout", url.searchParams.get("pool_timeout") ?? "30");
    url.searchParams.set("connection_limit", url.searchParams.get("connection_limit") ?? "1");
    return url.toString();
  } catch {
    return databaseUrl;
  }
}

const adapter = new PrismaNeon({
  connectionString: databaseUrlWithTimeouts(),
});

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
