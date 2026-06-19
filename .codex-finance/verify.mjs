import fs from "node:fs/promises";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const input = await FileBlob.load("C:/Users/andre/glv-management-system/.codex-finance/GLV Financial Report.xlsx");
const workbook = await SpreadsheetFile.importXlsx(input);
const sheets = [
  ["Executive Summary", "A1:B24"],
  ["Staff Performance", "A1:L14"],
  ["Customer Accounts", "A1:O14"],
  ["Payment History", "A1:J14"],
  ["Product Profitability", "A1:O14"],
  ["Weekly Ledger", "A1:M14"],
];

for (const [sheetName, range] of sheets) {
  const inspection = await workbook.inspect({ kind: "table", range: `${sheetName}!${range}`, include: "values,formulas", tableMaxRows: 14, tableMaxCols: 15, maxChars: 10000 });
  console.log(inspection.ndjson);
  const preview = await workbook.render({ sheetName, range, scale: 1.1, format: "png" });
  await fs.writeFile(`.codex-finance/${sheetName.replaceAll(" ", "-").toLowerCase()}.png`, new Uint8Array(await preview.arrayBuffer()));
}

const errors = await workbook.inspect({ kind: "match", searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A", options: { useRegex: true, maxResults: 300 }, summary: "financial workbook error scan" });
console.log(errors.ndjson);
