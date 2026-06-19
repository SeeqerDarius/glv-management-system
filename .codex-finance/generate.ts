import { buildWeeklyReportWorkbook } from "../lib/weekly-excel-report";
import { getAdminReportSummary, getWeeklyStaffPerformanceReport } from "../lib/reports";

async function main() {
  const summary = await getAdminReportSummary();
  const report = await getWeeklyStaffPerformanceReport();
  const workbook = await buildWeeklyReportWorkbook();
  await workbook.xlsx.writeFile(".codex-finance/GLV Financial Report.xlsx");
  console.log(JSON.stringify({
    summary: {
      totalCollected: summary.totalPaymentsCollected,
      productCost: summary.totalProductCost,
      salaryPaid: summary.totalSalaryPaid,
      projectedNetProfit: summary.projectedNetProfit,
    },
    staffRows: report.rows.length,
    salaryPayments: report.salaryPayments.length,
    products: report.products.length,
  }));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
