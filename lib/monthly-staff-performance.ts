import { AccountStatus } from "@prisma/client";
import { getEffectiveAccountStatus } from "@/lib/accounts";
import { prisma } from "@/lib/prisma";

export type MonthlyStaffPerformanceRow = {
  staffId: string;
  staffCode: string;
  staffName: string;
  monthlyDeposits: number;
  monthlyTarget: number;
  targetAttainment: number;
  newActiveAccounts: number;
  score: number;
  rank: number;
};

export function rankMonthlyStaffPerformance<
  T extends Pick<MonthlyStaffPerformanceRow, "staffCode" | "monthlyDeposits" | "monthlyTarget" | "newActiveAccounts">
>(rows: T[]) {
  const maxNewAccounts = Math.max(0, ...rows.map((row) => row.newActiveAccounts));
  const ranked = rows
    .map((row) => {
      const targetAttainment = row.monthlyTarget > 0
        ? row.monthlyDeposits / row.monthlyTarget
        : 0;
      // Target delivery contributes 80 points (capped at 120% attainment); new
      // active accounts contribute 20 points relative to the month's top count.
      const score =
        (Math.min(targetAttainment, 1.2) / 1.2) * 80 +
        (maxNewAccounts > 0 ? row.newActiveAccounts / maxNewAccounts : 0) * 20;
      return { ...row, targetAttainment, score: Math.round(score * 100) / 100 };
    })
    .sort((a, b) => b.score - a.score || b.targetAttainment - a.targetAttainment ||
      b.newActiveAccounts - a.newActiveAccounts || a.staffCode.localeCompare(b.staffCode))
    .map((row, index) => ({
      ...row,
      rank: index + 1,
    }));
  let previousScore: number | undefined;
  let previousRank = 0;
  return ranked.map((row) => {
    const rank = row.score === previousScore ? previousRank : row.rank;
    previousScore = row.score;
    previousRank = rank;
    return { ...row, rank };
  });
}

export async function getMonthlyStaffPerformanceReport(monthDate: Date) {
  const start = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const calendarEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0, 23, 59, 59, 999);
  const now = new Date();
  const end = calendarEnd > now ? now : calendarEnd;
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
    const monthlyTarget = assigned.reduce((total, account) => {
      const status = getEffectiveAccountStatus(account);
      if (account.balance <= 0 || (status !== AccountStatus.ACTIVE && status !== AccountStatus.OVERDUE) || account.startDate > end) return total;
      const activeStart = account.startDate > start ? account.startDate : start;
      const activeEnd = status === AccountStatus.OVERDUE
        ? end
        : account.expectedEndDate < end ? account.expectedEndDate : end;
      if (activeEnd < activeStart) return total;
      const activeDays = Math.floor((activeEnd.getTime() - activeStart.getTime()) / 86_400_000) + 1;
      return total + account.dailyAmount * activeDays;
    }, 0);
    const monthlyDeposits = deposits
      .filter((deposit) => deposit.staffId === member.id)
      .reduce((total, deposit) => total + deposit.amount, 0);
    const newActiveAccounts = assigned.filter((account) =>
      account.createdAt >= start && account.createdAt <= end && account.balance > 0 &&
      getEffectiveAccountStatus(account) === AccountStatus.ACTIVE
    ).length;
    return {
      staffId: member.id,
      staffCode: member.code,
      staffName: member.fullName,
      monthlyDeposits,
      monthlyTarget,
      newActiveAccounts,
    };
  });

  return { start, end, rows: rankMonthlyStaffPerformance(rows) };
}
