import { prisma } from "@/lib/prisma";

function monthStart(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export async function getBusinessManagementOverview(expenseFrom?: Date, expenseTo?: Date) {
  const start = monthStart();
  const chartStart = new Date(start);
  chartStart.setMonth(chartStart.getMonth() - 5);
  const chartEnd = new Date(start);
  chartEnd.setMonth(chartEnd.getMonth() + 1);
  const expenseDate: { gte?: Date; lt?: Date } = {};
  if (expenseFrom) expenseDate.gte = expenseFrom;
  if (expenseTo) {
    const exclusiveEnd = new Date(expenseTo);
    exclusiveEnd.setDate(exclusiveEnd.getDate() + 1);
    expenseDate.lt = exclusiveEnd;
  }
  const [
    staff,
    pendingLeave,
    recentLeave,
    recentReviews,
    salaryPayments,
    customerPayments,
    expenses,
    monthlyExpenseTotal,
    allTimePayments,
    allTimeSalaries,
    allTimeExpenses,
    chartPayments,
    chartSalaries,
    chartExpenses,
    currentMonthExpenses,
  ] = await Promise.all([
    prisma.staff.findMany({
      orderBy: { fullName: "asc" },
      include: {
        _count: { select: { customers: true } },
        performanceReviews: { orderBy: { reviewDate: "desc" }, take: 1 },
      },
    }),
    prisma.staffLeaveRequest.count({ where: { status: "PENDING" } }),
    prisma.staffLeaveRequest.findMany({
      include: { staff: { select: { code: true, fullName: true } } },
      orderBy: { createdAt: "desc" },
      take: 12,
    }),
    prisma.staffPerformanceReview.findMany({
      include: { staff: { select: { code: true, fullName: true } } },
      orderBy: { reviewDate: "desc" },
      take: 12,
    }),
    prisma.staffSalaryPayment.findMany({
      where: { paymentDate: { gte: start } },
      include: { staff: { select: { code: true, fullName: true } } },
      orderBy: { paymentDate: "desc" },
    }),
    prisma.payment.aggregate({ where: { paymentDate: { gte: start } }, _sum: { amount: true } }),
    prisma.businessExpense.findMany({ where: Object.keys(expenseDate).length ? { expenseDate } : undefined, orderBy: [{ expenseDate: "desc" }, { createdAt: "desc" }] }),
    prisma.businessExpense.aggregate({ where: { expenseDate: { gte: start } }, _sum: { amount: true } }),
    prisma.payment.aggregate({ _sum: { amount: true } }),
    prisma.staffSalaryPayment.aggregate({ _sum: { amount: true } }),
    prisma.businessExpense.aggregate({ _sum: { amount: true } }),
    prisma.payment.findMany({ where: { paymentDate: { gte: chartStart, lt: chartEnd } }, select: { amount: true, paymentDate: true } }),
    prisma.staffSalaryPayment.findMany({ where: { paymentDate: { gte: chartStart, lt: chartEnd } }, select: { amount: true, paymentDate: true } }),
    prisma.businessExpense.findMany({ where: { expenseDate: { gte: chartStart, lt: chartEnd } }, select: { amount: true, expenseDate: true } }),
    prisma.businessExpense.findMany({ where: { expenseDate: { gte: start, lt: chartEnd } }, select: { amount: true, category: true } }),
  ]);

  const activeStaff = staff.filter((member) => member.active);
  const monthlyRevenue = customerPayments._sum.amount ?? 0;
  const monthlyPayrollPaid = salaryPayments.reduce((sum, row) => sum + row.amount, 0);
  const monthlyExpenses = monthlyExpenseTotal._sum.amount ?? 0;
  const monthlyNetCash = monthlyRevenue - monthlyPayrollPaid - monthlyExpenses;
  const payrollCommitment = activeStaff.reduce((sum, member) => sum + member.monthlySalary, 0);
  const allTimeCashPosition =
    (allTimePayments._sum.amount ?? 0) -
    (allTimeSalaries._sum.amount ?? 0) -
    (allTimeExpenses._sum.amount ?? 0);
  const monthlyBuckets = Array.from({ length: 6 }, (_, index) => {
    const month = new Date(chartStart);
    month.setMonth(month.getMonth() + index);
    return {
      label: new Intl.DateTimeFormat("en", { month: "short" }).format(month),
      values: {
        collections: chartPayments.filter((row) => row.paymentDate.getFullYear() === month.getFullYear() && row.paymentDate.getMonth() === month.getMonth()).reduce((sum, row) => sum + row.amount, 0),
        payroll: chartSalaries.filter((row) => row.paymentDate.getFullYear() === month.getFullYear() && row.paymentDate.getMonth() === month.getMonth()).reduce((sum, row) => sum + row.amount, 0),
        expenses: chartExpenses.filter((row) => row.expenseDate.getFullYear() === month.getFullYear() && row.expenseDate.getMonth() === month.getMonth()).reduce((sum, row) => sum + row.amount, 0),
      },
      isSelected: month.getFullYear() === start.getFullYear() && month.getMonth() === start.getMonth(),
    };
  });
  const categoryColors = ["var(--chart-blue)", "var(--chart-good)", "var(--chart-warning)", "var(--chart-critical)", "var(--chart-serious)", "var(--chart-muted)"];
  const categoryTotals = new Map<string, number>();
  for (const row of currentMonthExpenses) categoryTotals.set(row.category, (categoryTotals.get(row.category) ?? 0) + row.amount);
  const expenseBreakdown = Array.from(categoryTotals, ([label, value], index) => ({ key: label, label, value, color: categoryColors[index % categoryColors.length] }));

  return {
    start,
    staff,
    activeStaffCount: activeStaff.length,
    pendingLeave,
    recentLeave,
    recentReviews,
    salaryPayments,
    expenses,
    monthlyRevenue,
    monthlyPayrollPaid,
    monthlyExpenses,
    monthlyNetCash,
    cashflowTrend: monthlyBuckets,
    expenseBreakdown,
    payrollCommitment,
    payrollOutstanding: Math.max(payrollCommitment - monthlyPayrollPaid, 0),
    allTimeCashPosition,
    averageRating:
      recentReviews.length > 0
        ? recentReviews.reduce((sum, row) => sum + row.rating, 0) / recentReviews.length
        : 0,
  };
}
