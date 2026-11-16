import { AccountStatus } from "@prisma/client";
import { getEffectiveAccountStatus } from "@/lib/accounts";
import { collectionTargetForRange } from "@/lib/collection-targets";
import { prisma } from "@/lib/prisma";

export type MonthlyStaffPerformanceRow = {
  staffId: string;
  staffCode: string;
  staffName: string;
  monthlyDeposits: number;
  monthlyTarget: number;
  targetAttainment: number;
  activeAccounts: number;
  newActiveAccounts: number;
  rank: number;
};

export function rankMonthlyStaffPerformance<
  T extends Pick<MonthlyStaffPerformanceRow, "staffCode" | "monthlyDeposits" | "monthlyTarget" | "activeAccounts" | "newActiveAccounts">
>(rows: T[]) {
  const ranked = rows
    .map((row) => {
      const targetAttainment = row.monthlyTarget > 0
        ? row.monthlyDeposits / row.monthlyTarget
        : 0;
      return { ...row, targetAttainment };
    })
    .sort((a, b) => b.activeAccounts - a.activeAccounts || b.targetAttainment - a.targetAttainment ||
      b.newActiveAccounts - a.newActiveAccounts || a.staffCode.localeCompare(b.staffCode))
    .map((row) => ({
      ...row,
      rank: 1 + rows.filter((other) => other.activeAccounts > row.activeAccounts).length,
    }));
  return ranked;
}

export async function getMonthlyStaffPerformanceReport(monthDate: Date) {
  const start = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const calendarEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0, 23, 59, 59, 999);
  const now = new Date();
  const end = start > now ? calendarEnd : calendarEnd > now ? now : calendarEnd;
  const [staff, accounts, deposits] = await Promise.all([
    prisma.staff.findMany({ orderBy: { code: "asc" }, select: { id: true, code: true, fullName: true } }),
    prisma.customerAccount.findMany({
      include: { customer: { select: { staffId: true } } },
    }),
    prisma.staffDeposit.findMany({
      where: { depositDate: { gte: start, lte: end } },
      select: { staffId: true, amount: true },
    }),
  ]);

  const rows = staff.map((member) => {
    const assigned = accounts.filter((account) => account.customer.staffId === member.id);
    const monthlyTarget = collectionTargetForRange(assigned, start, end);
    const monthlyDeposits = deposits
      .filter((deposit) => deposit.staffId === member.id)
      .reduce((total, deposit) => total + deposit.amount, 0);
    const newActiveAccounts = assigned.filter((account) =>
      account.createdAt >= start && account.createdAt <= end && account.balance > 0 &&
      getEffectiveAccountStatus(account) === AccountStatus.ACTIVE
    ).length;
    const activeAccounts = assigned.filter((account) =>
      getEffectiveAccountStatus(account) === AccountStatus.ACTIVE
    ).length;
    return {
      staffId: member.id,
      staffCode: member.code,
      staffName: member.fullName,
      monthlyDeposits,
      monthlyTarget,
      activeAccounts,
      newActiveAccounts,
    };
  });

  return { start, end, rows: rankMonthlyStaffPerformance(rows) };
}
