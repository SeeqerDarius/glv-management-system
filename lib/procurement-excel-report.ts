import ExcelJS from "exceljs";
import { formatMoney } from "@/lib/accounts";
import { getProcurementAccounts } from "@/lib/procurement";

function percent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

export async function buildProcurementWorkbook() {
  const procurement = await getProcurementAccounts();
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "GLV Management System";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Procurement Customers");
  const columns = [
    { label: "Product", key: "productName", width: 28 },
    { label: "Category", key: "category", width: 18 },
    { label: "Customer", key: "customerName", width: 28 },
    { label: "Customer ID", key: "customerCode", width: 22 },
    { label: "Staff Code", key: "staffCode", width: 14 },
    { label: "Staff Name", key: "staffName", width: 24 },
    { label: "Paid %", key: "progress", width: 12 },
    { label: "Total Paid", key: "totalPaid", width: 16 },
    { label: "Target Amount", key: "targetAmount", width: 16 },
    { label: "Balance", key: "balance", width: 16 },
    { label: "Cost Price", key: "unitCost", width: 16 },
    { label: "Transport", key: "transportCost", width: 16 },
    { label: "Total Unit Cost", key: "landedUnitCost", width: 16 },
    { label: "Layaway Price", key: "layawayPrice", width: 16 },
  ];
  sheet.columns = columns.map(({ key, width }) => ({ key, width }));

  sheet.addRow([
    `Products at or above ${procurement.thresholdPercent}% paid and pending delivery`,
  ]);
  sheet.mergeCells(1, 1, 1, sheet.columns.length);
  sheet.getRow(1).font = { bold: true, size: 14 };

  sheet.addRow([]);
  sheet.addRow(columns.map((column) => column.label));
  sheet.getRow(3).font = { bold: true };
  sheet.getRow(3).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFEFF6E8" },
  };

  procurement.items.forEach((item) => {
    sheet.addRow({
      productName: item.productName,
      category: item.category,
      customerName: item.customerName,
      customerCode: item.customerCode,
      staffCode: item.staffCode,
      staffName: item.staffName,
      progress: percent(item.progress),
      totalPaid: item.totalPaid,
      targetAmount: item.targetAmount,
      balance: item.balance,
      unitCost: item.unitCost,
      transportCost: item.transportCost,
      landedUnitCost: item.landedUnitCost,
      layawayPrice: item.layawayPrice,
    });
  });

  const totalRow = sheet.addRow({
    productName: "Total",
    customerName: `${procurement.items.length} customer account(s)`,
    unitCost: "",
    transportCost: "",
    landedUnitCost: procurement.items.reduce(
      (sum, item) => sum + item.landedUnitCost,
      0
    ),
  });
  totalRow.font = { bold: true };

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber >= 4) {
      [8, 9, 10, 11, 12, 13, 14].forEach((columnNumber) => {
        row.getCell(columnNumber).numFmt = '"GHS"#,##0.00';
      });
    }
  });

  sheet.views = [{ state: "frozen", ySplit: 3 }];
  sheet.autoFilter = {
    from: { row: 3, column: 1 },
    to: { row: 3, column: sheet.columns.length },
  };

  sheet.addRow([]);
  sheet.addRow([
    "Estimated procurement total",
    formatMoney(
      procurement.items.reduce((sum, item) => sum + item.landedUnitCost, 0)
    ),
  ]);

  return workbook;
}
