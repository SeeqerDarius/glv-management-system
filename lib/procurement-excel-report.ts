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
    { label: "Stock Status", key: "stockStatus", width: 14 },
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

  const toBuy = procurement.items.filter((item) => !item.coveredByStock);
  const toBuyCost = toBuy.reduce((sum, item) => sum + item.landedUnitCost, 0);

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
      stockStatus: item.coveredByStock ? "In stock" : "To buy",
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
    productName: "Total to buy",
    customerName: `${toBuy.length} of ${procurement.items.length} customer account(s)`,
    unitCost: "",
    transportCost: "",
    // Units the store room already covers are not bought again, so only the
    // shortfall is costed here.
    landedUnitCost: toBuyCost,
  });
  totalRow.font = { bold: true };

  // Derived from the column list so inserting a column never silently moves
  // the currency formatting onto the wrong cells.
  const moneyColumnNumbers = columns
    .map((column, index) =>
      (
        [
          "totalPaid",
          "targetAmount",
          "balance",
          "unitCost",
          "transportCost",
          "landedUnitCost",
          "layawayPrice",
        ] as string[]
      ).includes(column.key)
        ? index + 1
        : 0
    )
    .filter((columnNumber) => columnNumber > 0);

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber >= 4) {
      moneyColumnNumbers.forEach((columnNumber) => {
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
    formatMoney(toBuyCost),
  ]);

  return workbook;
}
