import { prisma } from "@/lib/prisma";

const presenceTouchIntervalMs = 2 * 60 * 1000;

export async function touchUserPresence(userId: string, lastSeenAt?: Date | null) {
  const now = new Date();
  const shouldTouch =
    !lastSeenAt || now.getTime() - lastSeenAt.getTime() > presenceTouchIntervalMs;

  if (!shouldTouch) {
    return;
  }

  await prisma.user.update({
    where: {
      id: userId,
    },
    data: {
      lastSeenAt: now,
      online: true,
    },
  });
}

export async function markUserOffline(userId: string) {
  await prisma.user.update({
    where: {
      id: userId,
    },
    data: {
      lastSeenAt: new Date(),
      online: false,
    },
  });
}
