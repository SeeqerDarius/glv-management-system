import { AccountStatus, DeliveryStatus, type Prisma } from "@prisma/client";
import {
  getDeliveryWait,
  getLifecycleBusinessRules,
  getPaidOffDate,
} from "@/lib/account-lifecycle";
import { prisma } from "@/lib/prisma";

/**
 * Paid off and not handed over yet. Archived plans are included on purpose:
 * one still owed its product must never drop out of the delivery queue. Every
 * view of the queue (the Accounts filter, the dashboards, the sidebar alert)
 * reads this one definition.
 */
export const awaitingDeliveryWhere: Prisma.CustomerAccountWhereInput = {
  status: { in: [AccountStatus.COMPLETED, AccountStatus.ARCHIVED] },
  balance: { lte: 0 },
  deliveryStatus: DeliveryStatus.PENDING,
};

/**
 * The delivery queue in numbers: how many paid-off plans are waiting, how many
 * have passed the delivery target, and the longest wait. `scope` narrows it,
 * for example to one staff member's customers.
 */
export async function getAwaitingDeliverySummary(
  scope: Prisma.CustomerAccountWhereInput = {},
  now = new Date()
) {
  const [{ deliveryTargetDays }, accounts] = await Promise.all([
    getLifecycleBusinessRules(),
    prisma.customerAccount.findMany({
      where: { AND: [awaitingDeliveryWhere, scope] },
      select: {
        startDate: true,
        payments: {
          orderBy: { paymentDate: "desc" },
          take: 1,
          select: { paymentDate: true },
        },
      },
    }),
  ]);

  const waits = accounts.map((account) =>
    getDeliveryWait(getPaidOffDate(account), deliveryTargetDays, now)
  );

  return {
    count: accounts.length,
    late: waits.filter((wait) => wait.late).length,
    longestWaitDays: waits.reduce(
      (longest, wait) => Math.max(longest, wait.daysWaiting),
      0
    ),
    deliveryTargetDays,
  };
}
