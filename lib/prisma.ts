import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function databaseUrlWithTimeouts() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    return undefined;
  }

  try {
    const url = new URL(databaseUrl);
    url.searchParams.set("connect_timeout", url.searchParams.get("connect_timeout") ?? "30");
    url.searchParams.set("pool_timeout", url.searchParams.get("pool_timeout") ?? "30");
    return url.toString();
  } catch {
    return databaseUrl;
  }
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: {
      db: {
        url: databaseUrlWithTimeouts(),
      },
    },
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
