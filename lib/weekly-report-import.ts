import ExcelJS from "exceljs";

export type RecoveredAccountRow = {
  customerId: string;
  customerName: string;
  phone: string | null;
  staffCode: string;
  productName: string;
  dailyAmount: number;
  targetAmount: number;
  totalPaid: number;
  balance: number;
  daysPaid: number;
  daysLeft: number;
  status: string;
  startDate: Date;
  expectedEndDate: Date;
};

export type RecoveredPaymentRow = {
  receiptNo: string;
  paymentDate: Date;
  customerId: string;
  customerName: string;
  staffCode: string;
  productName: string;
  amount: number;
  method: string;
  notes: string | null;
};

export type RecoveredProductRow = {
  category: string;
  name: string;
  costPrice: number;
  transportCost: number;
  dailyAmount: number;
  duration: number;
  layawayPrice: number;
};

export type ParsedWeeklyReport = {
  accounts: RecoveredAccountRow[];
  payments: RecoveredPaymentRow[];
  products: RecoveredProductRow[];
  staffCodes: string[];
  warnings: string[];
};

function text(value: ExcelJS.CellValue) {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object" && value) {
    if ("text" in value) return String(value.text ?? "").trim();
    if ("result" in value) return String(value.result ?? "").trim();
  }
  return String(value ?? "").trim();
}

function number(value: ExcelJS.CellValue) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const parsed = Number(text(value).replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function date(value: ExcelJS.CellValue) {
  if (value instanceof Date) return value;
  if (typeof value === "number") {
    return new Date(Math.round((value - 25569) * 86400 * 1000));
  }
  const parsed = new Date(text(value));
  return parsed;
}

function rowsByHeader(workbook: ExcelJS.Workbook, sheetName: string) {
  const sheet = workbook.getWorksheet(sheetName);
  if (!sheet) throw new Error(`Missing worksheet: ${sheetName}`);

  const headers = new Map<string, number>();
  sheet.getRow(4).eachCell((cell, column) => {
    headers.set(text(cell.value), column);
  });

  return Array.from({ length: Math.max(sheet.rowCount - 4, 0) }, (_, index) => {
    const row = sheet.getRow(index + 5);
    return {
      value(header: string) {
        const column = headers.get(header);
        return column ? row.getCell(column).value : null;
      },
    };
  });
}

export async function parseWeeklyReport(
  input: ArrayBuffer
): Promise<ParsedWeeklyReport> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(input);

  const accountRows = rowsByHeader(workbook, "Customer Accounts");
  const paymentRows = rowsByHeader(workbook, "Payment History");
  const productRows = rowsByHeader(workbook, "Product Profitability");
  const warnings: string[] = [];

  const accounts = accountRows
    .map((row) => ({
      customerId: text(row.value("Customer ID")),
      customerName: text(row.value("Customer Name")),
      phone:
        text(row.value("Phone Number")) === "-"
          ? null
          : text(row.value("Phone Number")) || null,
      staffCode: text(row.value("Staff Code")).toUpperCase(),
      productName: text(row.value("Product Name")),
      dailyAmount: number(row.value("Daily Amount")),
      targetAmount: number(row.value("Target Amount")),
      totalPaid: number(row.value("Total Paid")),
      balance: number(row.value("Balance")),
      daysPaid: number(row.value("Days Paid")),
      daysLeft: number(row.value("Days Left")),
      status: text(row.value("Account Status")).toUpperCase(),
      startDate: date(row.value("Start Date")),
      expectedEndDate: date(row.value("Expected End Date")),
    }))
    .filter((row) => row.customerId && row.customerName && row.productName);

  const payments = paymentRows
    .map((row) => ({
      receiptNo: text(row.value("Receipt Number")),
      paymentDate: date(row.value("Payment Date")),
      customerId: text(row.value("Customer ID")),
      customerName: text(row.value("Customer Name")),
      staffCode: text(row.value("Staff Code")).toUpperCase(),
      productName: text(row.value("Product / Account")),
      amount: number(row.value("Amount Paid")),
      method: text(row.value("Payment Method")) || "Recovered Import",
      notes: text(row.value("Notes")) || null,
    }))
    .filter((row) => row.receiptNo && row.customerId && row.productName);

  const products = productRows
    .map((row) => ({
      category: text(row.value("Category")) || "Recovered",
      name: text(row.value("Description / Name")),
      costPrice: number(row.value("Cost Price")),
      transportCost: number(row.value("Transport Cost")),
      dailyAmount: number(row.value("Daily Amount")),
      duration: Math.max(1, Math.round(number(row.value("Duration Days")))),
      layawayPrice: number(row.value("Layaway Price")),
    }))
    .filter((row) => row.name);

  for (const account of accounts) {
    if (
      Number.isNaN(account.startDate.getTime()) ||
      Number.isNaN(account.expectedEndDate.getTime())
    ) {
      warnings.push(
        `Account ${account.customerId} / ${account.productName} has an invalid date.`
      );
    }
  }

  const accountKeyCounts = new Map<string, number>();
  for (const account of accounts) {
    const key = `${account.customerId.trim().toUpperCase()}::${account.productName
      .trim()
      .toUpperCase()}`;
    accountKeyCounts.set(key, (accountKeyCounts.get(key) ?? 0) + 1);
  }
  const warnedKeys = new Set<string>();
  for (const payment of payments) {
    const key = `${payment.customerId.trim().toUpperCase()}::${payment.productName
      .trim()
      .toUpperCase()}`;
    if ((accountKeyCounts.get(key) ?? 0) > 1 && !warnedKeys.has(key)) {
      warnings.push(
        `Multiple accounts use ${payment.customerId} / ${payment.productName}; weekly payments cannot be assigned safely.`
      );
      warnedKeys.add(key);
    }
  }

  const staffCodes = Array.from(
    new Set(
      [...accounts, ...payments]
        .map((row) => row.staffCode)
        .filter(Boolean)
    )
  ).sort();

  return { accounts, payments, products, staffCodes, warnings };
}
