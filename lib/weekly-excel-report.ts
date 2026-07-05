import ExcelJS from "exceljs";
import { AccountStatus } from "@prisma/client";
import { getEffectiveAccountStatus } from "@/lib/accounts";
import { refreshAccountLifecycleStatuses } from "@/lib/account-lifecycle";
import { prisma } from "@/lib/prisma";
import { getProcurementList } from "@/lib/procurement";

const palette = {
  ink: "17351F",
  green: "176B3A",
  lime: "B7EB55",
  limeSoft: "EFF9DD",
  border: "DCE5DF",
  muted: "64736A",
  white: "FFFFFF",
  danger: "FDE2E2",
};

const currencyFormat = '"GHS" #,##0.00;[Red]("GHS" #,##0.00);-';
const dateFormat = "dd mmm yyyy";

export function getCurrentWeekRange(now = new Date()) {
  const start = new Date(now);
  const day = start.getDay();
  start.setDate(start.getDate() + (day === 0 ? -6 : 1 - day));
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function formatPeriod(start: Date, end: Date) {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  return `${formatter.format(start)} - ${formatter.format(end)}`;
}

function initializeSheet(
  sheet: ExcelJS.Worksheet,
  title: string,
  subtitle: string,
  headers: string[]
) {
  sheet.views = [{ state: "frozen", ySplit: 4, showGridLines: false }];
  sheet.properties.defaultRowHeight = 19;
  sheet.mergeCells(1, 1, 1, headers.length);
  const titleCell = sheet.getCell(1, 1);
  titleCell.value = title;
  titleCell.font = {
    name: "Aptos Display",
    size: 18,
    bold: true,
    color: { argb: palette.white },
  };
  titleCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: palette.ink },
  };
  titleCell.alignment = { vertical: "middle", horizontal: "left" };
  sheet.getRow(1).height = 34;

  sheet.mergeCells(2, 1, 2, headers.length);
  const subtitleCell = sheet.getCell(2, 1);
  subtitleCell.value = subtitle;
  subtitleCell.font = { name: "Aptos", size: 10, color: { argb: palette.muted } };
  subtitleCell.alignment = { vertical: "middle", wrapText: true };
  sheet.getRow(2).height = 30;

  const headerRow = sheet.getRow(4);
  headerRow.values = headers;
  headerRow.height = 30;
  headerRow.font = {
    name: "Aptos",
    size: 10,
    bold: true,
    color: { argb: palette.ink },
  };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: palette.lime },
  };
  headerRow.alignment = {
    vertical: "middle",
    horizontal: "center",
    wrapText: true,
  };
  headerRow.eachCell((cell) => {
    cell.border = {
      bottom: { style: "medium", color: { argb: palette.green } },
    };
  });
  sheet.autoFilter = {
    from: { row: 4, column: 1 },
    to: { row: 4, column: headers.length },
  };
}

function finishSheet(
  sheet: ExcelJS.Worksheet,
  widths: number[],
  options: {
    currencyColumns?: number[];
    dateColumns?: number[];
    percentageColumns?: number[];
  } = {}
) {
  widths.forEach((width, index) => {
    sheet.getColumn(index + 1).width = Math.min(Math.max(width, 11), 34);
  });
  options.currencyColumns?.forEach((column) => {
    sheet.getColumn(column).numFmt = currencyFormat;
  });
  options.dateColumns?.forEach((column) => {
    sheet.getColumn(column).numFmt = dateFormat;
  });
  options.percentageColumns?.forEach((column) => {
    sheet.getColumn(column).numFmt = "0.0%";
  });

  for (let rowNumber = 5; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    row.font = { name: "Aptos", size: 10, color: { argb: "24342B" } };
    row.alignment = { vertical: "middle" };
    if (rowNumber % 2 === 0) {
      row.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "F7FAF8" },
      };
    }
    row.eachCell((cell) => {
      cell.border = {
        bottom: { style: "hair", color: { argb: palette.border } },
      };
    });
  }
}

export async function buildWeeklyReportWorkbook(now = new Date()) {
  await refreshAccountLifecycleStatuses(now);

  const { start, end } = getCurrentWeekRange(now);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  const staff = await prisma.staff.findMany({ orderBy: { code: "asc" } });
  const customers = await prisma.customer.findMany({
    select: { id: true, staffId: true },
  });
  const accounts = await prisma.customerAccount.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      customer: { include: { staff: true } },
      product: true,
      payments: { orderBy: { paymentDate: "asc" } },
    },
  });
  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      staff: { select: { code: true } },
    },
  });
  const salaryPayments = await prisma.staffSalaryPayment.findMany();
  const products = await prisma.product.findMany({
    orderBy: [{ category: "asc" }, { name: "asc" }],
    include: { _count: { select: { accounts: true } } },
  });

  const userNames = new Map(
    users.map((user) => [
      user.id,
      user.staff?.code ? `${user.name} (${user.staff.code})` : user.name,
    ])
  );
  const allPayments = accounts.flatMap((account) =>
    account.payments.map((payment) => ({ payment, account }))
  );
  const weeklyPayments = allPayments.filter(
    ({ payment }) => payment.paymentDate >= start && payment.paymentDate <= end
  );
  const effectiveAccounts = accounts.map((account) => ({
    account,
    status: getEffectiveAccountStatus(account),
  }));
  const statusCount = (status: AccountStatus) =>
    effectiveAccounts.filter((item) => item.status === status).length;
  const totalCollected = allPayments.reduce(
    (sum, item) => sum + item.payment.amount,
    0
  );
  const expectedReceivables = effectiveAccounts
    .filter(
      (item) =>
        item.status === AccountStatus.ACTIVE ||
        item.status === AccountStatus.OVERDUE
    )
    .reduce((sum, item) => sum + item.account.balance, 0);
  const reportableAccounts = accounts.filter(
    (account) =>
      account.status !== AccountStatus.CANCELLED &&
      account.status !== AccountStatus.CLOSED
  );
  const outstandingBalance = reportableAccounts.reduce(
    (sum, account) => sum + account.balance,
    0
  );
  const totalProductCost = reportableAccounts.reduce(
    (sum, account) => sum + account.product.costPrice + account.product.transportCost,
    0
  );
  const totalExpectedProfit = reportableAccounts
    .reduce(
      (sum, account) =>
        sum + account.targetAmount - account.product.costPrice - account.product.transportCost,
      0
    );
  const salaryPaidThisMonth = salaryPayments
    .filter((payment) => payment.paymentDate >= monthStart && payment.paymentDate <= monthEnd)
    .reduce((sum, payment) => sum + payment.amount, 0);
  const totalSalariesPaid = salaryPayments.reduce((sum, payment) => sum + payment.amount, 0);
  const currentMonthPayroll = staff
    .filter((member) => member.active)
    .reduce((sum, member) => sum + member.monthlySalary, 0);
  const outstandingSalaries = Math.max(currentMonthPayroll - salaryPaidThisMonth, 0);
  const monthlyIncome = allPayments
    .filter(({ payment }) => payment.paymentDate >= monthStart && payment.paymentDate <= monthEnd)
    .reduce((sum, item) => sum + item.payment.amount, 0);
  const payrollVsIncome = monthlyIncome - salaryPaidThisMonth;
  const payrollPercentageOfRevenue =
    monthlyIncome > 0 ? salaryPaidThisMonth / monthlyIncome : 0;
  const netProfitSoFar = totalCollected - totalProductCost - salaryPaidThisMonth;
  const projectedNetProfit = totalExpectedProfit - currentMonthPayroll;
  const period = formatPeriod(start, end);
  const procurement = await getProcurementList();

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "GLV Management System";
  workbook.subject = `Weekly operational report: ${period}`;
  workbook.created = now;
  workbook.modified = now;

  const summary = workbook.addWorksheet("Executive Summary", {
    properties: { tabColor: { argb: palette.lime } },
  });
  initializeSheet(
    summary,
    "GLV WEEKLY REPORT",
    `Executive summary | Week: ${period} | Currency: Ghana Cedi (GHS)`,
    ["Metric", "Value"]
  );
  summary.addRows([
    ["Week start date", start],
    ["Week end date", end],
    ["Total customers", customers.length],
    ["Total staff", staff.length],
    ["Total accounts", accounts.length],
    ["Active accounts", statusCount(AccountStatus.ACTIVE)],
    ["Completed accounts", statusCount(AccountStatus.COMPLETED)],
    ["Overdue accounts", statusCount(AccountStatus.OVERDUE)],
    ["Dormant accounts", statusCount(AccountStatus.DORMANT)],
    ["Probation accounts", statusCount(AccountStatus.PROBATION)],
    ["Closed accounts", statusCount(AccountStatus.CLOSED)],
    ["Cancelled accounts", statusCount(AccountStatus.CANCELLED)],
    ["Suspended accounts", statusCount(AccountStatus.SUSPENDED)],
    ["Total collected", totalCollected],
    ["Expected receivables", expectedReceivables],
    ["Outstanding balance", outstandingBalance],
    ["Product cost exposure", totalProductCost],
    ["Procurement products ready", procurement.items.length],
    ["Procurement units ready", procurement.totalQuantity],
    ["Procurement estimated cost", procurement.totalCost],
    ["Current month payroll", currentMonthPayroll],
    ["Salary paid this month", salaryPaidThisMonth],
    ["Total salaries paid", totalSalariesPaid],
    ["Outstanding salaries", outstandingSalaries],
    ["Payroll vs income", payrollVsIncome],
    ["Payroll percentage of revenue", payrollPercentageOfRevenue],
    ["Net profit so far", netProfitSoFar],
    ["Projected profit / loss", projectedNetProfit],
  ]);
  for (let row = 5; row <= 22; row += 1) {
    summary.getCell(row, 1).font = {
      name: "Aptos",
      size: 10,
      bold: true,
      color: { argb: palette.ink },
    };
  }
  summary.getCell("B5").numFmt = dateFormat;
  summary.getCell("B6").numFmt = dateFormat;
  [15, 16, 17, 18, 21, 22, 23, 24, 25, 26, 28, 29].forEach((row) => {
    summary.getCell(row, 2).numFmt = currencyFormat;
  });
  summary.getCell("B27").numFmt = "0.0%";
  finishSheet(summary, [30, 23]);

  const staffRows = staff
    .map((member) => {
      const memberAccounts = accounts.filter(
        (account) => account.customer.staffId === member.id
      );
      return {
        code: member.code,
        name: member.fullName,
        customers: customers.filter(
          (customer) => customer.staffId === member.id
        ).length,
        opened: memberAccounts.filter(
          (account) => account.createdAt >= start && account.createdAt <= end
        ).length,
        totalCollected: memberAccounts
          .flatMap((account) => account.payments)
          .reduce((sum, payment) => sum + payment.amount, 0),
        weeklyCollection: memberAccounts
          .flatMap((account) => account.payments)
          .filter((payment) => payment.paymentDate >= start && payment.paymentDate <= end)
          .reduce((sum, payment) => sum + payment.amount, 0),
        completed: memberAccounts.filter(
          (account) =>
            account.status === AccountStatus.COMPLETED &&
            account.payments.length > 0
        ).length,
        outstanding: memberAccounts.reduce(
          (sum, account) => sum + account.balance,
          0
        ),
        salaryPaid: salaryPayments
          .filter((payment) => payment.staffId === member.id)
          .reduce((sum, payment) => sum + payment.amount, 0),
        monthlySalary: member.monthlySalary,
        salaryPaidThisMonth: salaryPayments
          .filter(
            (payment) =>
              payment.staffId === member.id &&
              payment.paymentDate >= monthStart &&
              payment.paymentDate <= monthEnd
          )
          .reduce((sum, payment) => sum + payment.amount, 0),
        projectedProfitAfterSalary:
          memberAccounts
            .filter((account) => account.status !== AccountStatus.CANCELLED)
            .reduce(
              (sum, account) =>
                sum + account.targetAmount - account.product.costPrice - account.product.transportCost,
              0
            ) - member.monthlySalary,
      };
    })
    .sort(
      (a, b) =>
        b.weeklyCollection - a.weeklyCollection ||
        b.totalCollected - a.totalCollected ||
        b.opened - a.opened ||
        b.customers - a.customers
    );
  const staffSheet = workbook.addWorksheet("Staff Performance");
  initializeSheet(
    staffSheet,
    "STAFF PERFORMANCE",
    `Weekly staff performance | ${period}`,
    [
      "Staff Code",
      "Staff Name",
      "Assigned Customers",
      "Accounts Opened This Week",
      "Total Collected",
      "Weekly Collection",
      "Outstanding Balance",
      "Salary Paid This Month",
      "Monthly Salary",
      "Salary Balance This Month",
      "Net After Salary",
      "Projected Profit After Salary",
      "Performance Ranking",
    ]
  );
  staffRows.forEach((row, index) => {
    staffSheet.addRow([
      row.code,
      row.name,
      row.customers,
      row.opened,
      row.totalCollected,
      row.weeklyCollection,
      row.outstanding,
      row.salaryPaidThisMonth,
      row.monthlySalary,
      Math.max(row.monthlySalary - row.salaryPaidThisMonth, 0),
      row.totalCollected - row.salaryPaidThisMonth,
      row.projectedProfitAfterSalary,
      index + 1,
    ]);
  });
  finishSheet(
    staffSheet,
    [14, 24, 19, 21, 20, 20, 20, 18, 18, 18, 25, 20],
    { currencyColumns: [5, 6, 7, 8, 9, 10, 11] }
  );

  const accountsSheet = workbook.addWorksheet("Customer Accounts");
  initializeSheet(
    accountsSheet,
    "CUSTOMER ACCOUNTS",
    `Complete account position as of ${period}`,
    [
      "Customer ID",
      "Customer Name",
      "Phone Number",
      "Staff Code",
      "Product Name",
      "Daily Amount",
      "Target Amount",
      "Total Paid",
      "Balance",
      "Days Paid",
      "Days Left",
      "Progress Percentage",
      "Account Status",
      "Start Date",
      "Expected End Date",
    ]
  );
  effectiveAccounts.forEach(({ account, status }) => {
    const daysPaid =
      account.dailyAmount > 0
        ? Math.floor(account.totalPaid / account.dailyAmount)
        : 0;
    const daysLeft = account.product.duration - daysPaid;
    const progress =
      account.targetAmount > 0
        ? account.totalPaid / account.targetAmount
        : 0;
    accountsSheet.addRow([
      account.customer.customerId,
      account.customer.fullName,
      account.customer.phone || "-",
      account.customer.staff.code,
      account.product.name,
      account.dailyAmount,
      account.targetAmount,
      account.totalPaid,
      account.balance,
      daysPaid,
      daysLeft,
      progress,
      status,
      account.startDate,
      account.expectedEndDate,
    ]);
  });
  finishSheet(
    accountsSheet,
    [18, 25, 17, 13, 25, 16, 17, 17, 17, 13, 13, 20, 17, 16, 18],
    {
      currencyColumns: [6, 7, 8, 9],
      dateColumns: [14, 15],
      percentageColumns: [12],
    }
  );

  const paymentsSheet = workbook.addWorksheet("Payment History");
  initializeSheet(
    paymentsSheet,
    "PAYMENT HISTORY",
    `Payments received during ${period}`,
    [
      "Receipt Number",
      "Payment Date",
      "Customer ID",
      "Customer Name",
      "Staff Code",
      "Product / Account",
      "Amount Paid",
      "Payment Method",
      "Received By",
      "Notes",
    ]
  );
  weeklyPayments
    .sort(
      (a, b) =>
        a.payment.paymentDate.getTime() - b.payment.paymentDate.getTime()
    )
    .forEach(({ payment, account }) => {
      paymentsSheet.addRow([
        payment.receiptNo,
        payment.paymentDate,
        account.customer.customerId,
        account.customer.fullName,
        account.customer.staff.code,
        account.product.name,
        payment.amount,
        payment.method,
        userNames.get(payment.receivedBy) ?? "System User",
        payment.notes ?? "",
      ]);
    });
  finishSheet(
    paymentsSheet,
    [22, 16, 18, 25, 13, 25, 17, 17, 22, 32],
    { currencyColumns: [7], dateColumns: [2] }
  );

  const procurementSheet = workbook.addWorksheet("Product Profitability");
  initializeSheet(
    procurementSheet,
    "PROCUREMENT / PRODUCT PROFITABILITY",
    `Layaway pricing and expected returns as of ${period}`,
    [
      "Category",
      "Description / Name",
      "Cost Price",
      "Transport Cost",
      "Daily Amount",
      "Duration Days",
      "Layaway Price",
      "Account Count",
      "Layaway Profit",
      "Layaway Profit %",
      "Expected Layaway Revenue",
      "Expected Layaway Profit",
    ]
  );
  products.forEach((product) => {
    const layawayProfit =
      product.layawayPrice - product.costPrice - product.transportCost;
    const accountCount = product._count.accounts;
    procurementSheet.addRow([
      product.category,
      product.description || product.name,
      product.costPrice,
      product.transportCost,
      product.dailyAmount,
      product.duration,
      product.layawayPrice,
      accountCount,
      layawayProfit,
      product.costPrice > 0 ? layawayProfit / product.costPrice : 0,
      product.layawayPrice * accountCount,
      layawayProfit * accountCount,
    ]);
  });
  finishSheet(
    procurementSheet,
    [18, 30, 16, 16, 16, 15, 16, 15, 17, 17, 24, 23],
    {
      currencyColumns: [3, 4, 5, 7, 9, 11, 12],
      percentageColumns: [10],
    }
  );

  const readyProcurementSheet = workbook.addWorksheet("Procurement List", {
    properties: { tabColor: { argb: palette.lime } },
  });
  initializeSheet(
    readyProcurementSheet,
    "PROCUREMENT LIST",
    `Products ready to buy | ${period} | Threshold: ${procurement.thresholdPercent}% paid`,
    [
      "Product Name",
      "Category",
      "Units To Buy",
      "Cost Price",
      "Transport Cost",
      "Landed Unit Cost",
      "Estimated Total Cost",
      "Layaway Price",
      "Average Paid %",
      "Highest Paid %",
    ]
  );
  procurement.items.forEach((item) => {
    readyProcurementSheet.addRow([
      item.productName,
      item.category,
      item.quantity,
      item.unitCost,
      item.transportCost,
      item.landedUnitCost,
      item.totalCost,
      item.layawayPrice,
      item.averageProgress,
      item.highestProgress,
    ]);
  });
  if (procurement.items.length > 0) {
    readyProcurementSheet.addRow([
      "Total",
      "",
      procurement.totalQuantity,
      "",
      "",
      "",
      procurement.totalCost,
      "",
      "",
      "",
    ]);
    readyProcurementSheet.lastRow!.font = {
      name: "Aptos",
      size: 10,
      bold: true,
      color: { argb: palette.ink },
    };
  }
  finishSheet(
    readyProcurementSheet,
    [28, 18, 14, 16, 16, 18, 20, 16, 16, 16],
    {
      currencyColumns: [4, 5, 6, 7, 8],
      percentageColumns: [9, 10],
    }
  );

  const ledgerSheet = workbook.addWorksheet("Weekly Ledger", {
    properties: { tabColor: { argb: palette.green } },
  });
  initializeSheet(
    ledgerSheet,
    "GLV WEEKLY LEDGER",
    `Operational ledger inspired by the legacy GLV workbook | ${period}`,
    [
      "Staff Code",
      "Customer Name",
      "Phone Number",
      "Product / Account",
      "Daily Amount",
      "Week Payment Total",
      "Days Paid",
      "Days Left",
      "Amount Paid",
      "Amount Left",
      "Contract Total",
      "Account Status",
      "Collection / Release Status",
    ]
  );
  effectiveAccounts.forEach(({ account, status }) => {
    const daysPaid =
      account.dailyAmount > 0
        ? Math.floor(account.totalPaid / account.dailyAmount)
        : 0;
    const daysLeft = account.product.duration - daysPaid;
    const releaseStatus =
      status === AccountStatus.COMPLETED
        ? "READY FOR RELEASE"
        : status === AccountStatus.CANCELLED
          ? "CANCELLED"
          : status === AccountStatus.CLOSED
            ? "CLOSED"
          : status === AccountStatus.SUSPENDED
            ? "SUSPENDED"
            : "NOT READY";
    ledgerSheet.addRow([
      account.customer.staff.code,
      account.customer.fullName,
      account.customer.phone || "-",
      account.product.name,
      account.dailyAmount,
      account.payments
        .filter(
          (payment) => payment.paymentDate >= start && payment.paymentDate <= end
        )
        .reduce((sum, payment) => sum + payment.amount, 0),
      daysPaid,
      daysLeft,
      account.totalPaid,
      account.balance,
      account.targetAmount,
      status,
      releaseStatus,
    ]);
  });
  finishSheet(
    ledgerSheet,
    [13, 25, 17, 26, 16, 21, 13, 13, 17, 17, 17, 17, 24],
    { currencyColumns: [5, 6, 9, 10, 11] }
  );
  ledgerSheet.getColumn(13).eachCell((cell, rowNumber) => {
    if (rowNumber < 5) return;
    if (cell.value === "READY FOR RELEASE") {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: palette.limeSoft },
      };
    }
    if (
      cell.value === "CANCELLED" ||
      cell.value === "SUSPENDED" ||
      cell.value === "CLOSED"
    ) {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: palette.danger },
      };
    }
  });

  return workbook;
}
