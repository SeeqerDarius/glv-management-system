import { readFile } from "node:fs/promises";
import { parseWeeklyReport } from "../lib/weekly-report-import";

async function main() {
  const workbookPath = process.argv[2];
  if (!workbookPath) {
    throw new Error("Pass the path to an XLSX weekly report.");
  }

  const buffer = await readFile(workbookPath);
  const report = await parseWeeklyReport(
    buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
  );

  console.log(
    JSON.stringify(
      {
        accounts: report.accounts.length,
        payments: report.payments.length,
        products: report.products.length,
        staffCodes: report.staffCodes,
        warnings: report.warnings,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
