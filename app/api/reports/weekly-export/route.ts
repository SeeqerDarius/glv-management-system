import ExcelJS from "exceljs";
import { AccountStatus, Prisma, UserPermission, UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getCurrentWeekRange } from "@/lib/reports";
import { hasPermission, isAdminRole } from "@/lib/roles";
import { buildWeeklyReportWorkbook } from "@/lib/weekly-excel-report";
import { prisma } from "@/lib/prisma";
import { getMonthlyStaffPerformanceReport } from "@/lib/monthly-staff-performance";
import { buildTextPdf } from "@/lib/simple-pdf";

export const dynamic = "force-dynamic";

function resolveReportDate(weekParam: string | null) {
  const now = new Date();
  if (!weekParam) return now;

  const parsed = new Date(`${weekParam}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return now;

  const { start: currentWeekStart } = getCurrentWeekRange(now);
  const { start: requestedWeekStart } = getCurrentWeekRange(parsed);
  return requestedWeekStart > currentWeekStart ? now : parsed;
}

export async function GET(request: NextRequest) {
  const session = await auth();
  const canViewReports =
    isAdminRole(session?.user?.role) ||
    hasPermission(
      session?.user?.role,
      session?.user?.permissions,
      UserPermission.VIEW_REPORTS
    );

  const requestedKind = request.nextUrl.searchParams.get("kind");
  const canExportCustomers = isAdminRole(session?.user?.role) ||
    session?.user?.role === UserRole.STAFF ||
    hasPermission(session?.user?.role, session?.user?.permissions, UserPermission.MANAGE_CUSTOMERS);
  if (!session?.user?.id || (requestedKind === "customers" ? !canExportCustomers : !canViewReports)) {
    return NextResponse.json(
      { error: requestedKind === "customers" ? "Customer export access is required." : "Report access is required." },
      { status: 403 }
    );
  }

  try {
    const params = request.nextUrl.searchParams;
    const kind = params.get("kind");
    const format = params.get("format") ?? "xlsx";

    if (kind === "customers") {
      if (!session?.user?.id) return NextResponse.json({ error: "Sign in to export customer data." }, { status: 401 });
      if (format !== "xlsx" && format !== "pdf") return NextResponse.json({ error: "Choose xlsx or pdf." }, { status: 400 });
      const canManageAll = hasPermission(session.user.role, session.user.permissions, UserPermission.MANAGE_CUSTOMERS);
      const isStaff = session.user.role === UserRole.STAFF;
      if (isStaff && !canManageAll && !session.user.staffId) return NextResponse.json({ error: "A staff profile is required to export customer data." }, { status: 403 });
      const selectedStaff = params.get("staffId")?.trim() ?? "";
      const staffId = isStaff && !canManageAll ? session.user.staffId! : selectedStaff;
      const q = params.get("q")?.trim() ?? "";
      const sortValue = params.get("sort") ?? "name-az";
      const sort = ({ "name-az": { fullName: "asc" }, "name-za": { fullName: "desc" }, newest: { createdAt: "desc" }, oldest: { createdAt: "asc" }, "id-az": { customerId: "asc" } } as const)[sortValue as "name-az" | "name-za" | "newest" | "oldest" | "id-az"] ?? { fullName: "asc" as const };
      const where: Prisma.CustomerWhereInput = { AND: [
        ...(staffId ? [{ staffId }] : []),
        ...(q ? [{ OR: [
          { fullName: { contains: q, mode: "insensitive" as const } },
          { customerId: { contains: q, mode: "insensitive" as const } },
          { phone: { contains: q, mode: "insensitive" as const } },
        ] }] : []),
      ] };
      const customers = await prisma.customer.findMany({ where, orderBy: sort, select: {
        customerId: true, fullName: true, phone: true,
        staff: { select: { code: true, fullName: true } },
        accounts: { select: { balance: true, status: true, product: { select: { name: true } } } },
      } });
      const title = staffId ? `Customers - ${customers[0]?.staff.code ?? "Staff"} ${customers[0]?.staff.fullName ?? ""}` : "GLV Customer Directory";
      const rows = customers.map((customer) => ({
        customerId: customer.customerId, name: customer.fullName, phone: customer.phone ?? "",
        staffCode: customer.staff.code, staffName: customer.staff.fullName,
        accounts: customer.accounts.length,
        activeAccounts: customer.accounts.filter((account) => account.status === AccountStatus.ACTIVE).length,
        balance: customer.accounts.reduce((sum, account) => sum + account.balance, 0),
        products: customer.accounts.map((account) => account.product.name).join(", "),
      }));
      const fileSuffix = staffId ? `${customers[0]?.staff.code ?? "Staff"}-Customers` : "All-Staff-Customers";
      if (format === "pdf") {
        const lines = [`${customers.length} customers${q ? ` | Search: ${q}` : ""}`, "", ...rows.flatMap((row) => [
          `${row.customerId} | ${row.name} | ${row.phone || "No phone"} | ${row.staffCode} - ${row.staffName}`,
          `Accounts: ${row.accounts} (${row.activeAccounts} active) | Outstanding: GHS ${row.balance.toFixed(2)} | Products: ${row.products || "-"}`, "",
        ])];
        return new NextResponse(buildTextPdf(title, lines), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="GLV-${fileSuffix}.pdf"`, "Cache-Control": "no-store" } });
      }
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("Customers");
      sheet.columns = [
        { header: "Customer ID", key: "customerId", width: 20 }, { header: "Name", key: "name", width: 28 },
        { header: "Phone", key: "phone", width: 18 }, { header: "Staff Code", key: "staffCode", width: 14 },
        { header: "Staff Name", key: "staffName", width: 24 }, { header: "Accounts", key: "accounts", width: 12 },
        { header: "Active Accounts", key: "activeAccounts", width: 16 },
        { header: "Outstanding Balance (GHS)", key: "balance", width: 26, style: { numFmt: '"GHS" #,##0.00' } },
        { header: "Products", key: "products", width: 42 },
      ];
      sheet.addRows(rows); sheet.views = [{ state: "frozen", ySplit: 1 }]; sheet.autoFilter = "A1:I1";
      sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
      sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF17351F" } };
      const buffer = await workbook.xlsx.writeBuffer();
      return new NextResponse(Buffer.from(buffer), { headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="GLV-${fileSuffix}.xlsx"`, "Cache-Control": "no-store",
      } });
    }

    if (kind === "monthly-staff") {
      const monthValue = params.get("month") ?? "";
      const match = /^(\d{4})-(\d{2})$/.exec(monthValue);
      const reportDate = match ? new Date(Number(match[1]), Number(match[2]) - 1, 1) : new Date();
      if (match && (reportDate.getMonth() + 1 !== Number(match[2]) || reportDate > new Date())) return NextResponse.json({ error: "Choose a valid past or current month." }, { status: 400 });
      const monthly = await getMonthlyStaffPerformanceReport(reportDate);
      const monthLabel = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" }).format(monthly.start);
      const lines = ["Monthly deposits are compared with assigned active/overdue plans' expected collections for eligible days.", "Overall score = 80% target attainment (capped at 120%) + 20% relative share of new active accounts.", "Historic target and new-account eligibility use current account status because status history is not stored.", "", ...monthly.rows.map((row) => `#${row.rank} ${row.staffCode} ${row.staffName} | Deposits GHS ${row.monthlyDeposits.toFixed(2)} | Collection target GHS ${row.monthlyTarget.toFixed(2)} | Deposits/target ${row.monthlyTarget > 0 ? `${(row.targetAttainment * 100).toFixed(1)}%` : "N/A"} | New active accounts ${row.newActiveAccounts} | Score ${row.score.toFixed(2)}/100`)];
      if (format === "pdf") return new NextResponse(buildTextPdf(`GLV Monthly Staff Performance - ${monthLabel}`, lines), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="GLV-Staff-Performance-${monthValue}.pdf"`, "Cache-Control": "no-store" } });
      if (format !== "xlsx") return NextResponse.json({ error: "Choose xlsx or pdf." }, { status: 400 });
      const workbook = new ExcelJS.Workbook(); const sheet = workbook.addWorksheet("Monthly Staff Performance");
      sheet.addRow([`GLV Monthly Staff Performance - ${monthLabel}`]); sheet.mergeCells("A1:H1");
      sheet.addRow(["Deposits compared with expected collections for active assigned plans. Score: 80% target attainment (capped at 120%) + 20% share of new active accounts."]); sheet.mergeCells("A2:H2");
      sheet.addRow(["Rank", "Staff Code", "Staff Name", "Monthly Deposits (GHS)", "Monthly Target (GHS)", "Target Attainment", "New Active Accounts", "Overall Score / 100"]);
      monthly.rows.forEach((row) => sheet.addRow([row.rank, row.staffCode, row.staffName, row.monthlyDeposits, row.monthlyTarget, row.monthlyTarget > 0 ? row.targetAttainment : null, row.newActiveAccounts, row.score]));
      sheet.columns = [{ width: 10 }, { width: 14 }, { width: 28 }, { width: 24 }, { width: 23 }, { width: 20 }, { width: 21 }, { width: 22 }];
      sheet.views = [{ state: "frozen", ySplit: 3 }]; sheet.autoFilter = { from: "A3", to: "H3" };
      sheet.getRow(1).font = { bold: true, size: 16 }; sheet.getRow(3).font = { bold: true, color: { argb: "FFFFFFFF" } };
      sheet.getRow(3).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF17351F" } };
      [4, 5].forEach((column) => { sheet.getColumn(column).numFmt = '"GHS" #,##0.00'; });
      sheet.getColumn(6).numFmt = "0.0%"; sheet.getColumn(8).numFmt = "0.00";
      const buffer = await workbook.xlsx.writeBuffer();
      return new NextResponse(Buffer.from(buffer), { headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="GLV-Staff-Performance-${monthValue}.xlsx"`, "Cache-Control": "no-store",
      } });
    }

    const reportDate = resolveReportDate(request.nextUrl.searchParams.get("week"));
    const workbook = await buildWeeklyReportWorkbook(reportDate);
    const buffer = await workbook.xlsx.writeBuffer();
    const { start } = getCurrentWeekRange(reportDate);
    const filenameDate = new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
      .format(start)
      .replace(/\s/g, "-");

    return new NextResponse(Buffer.from(buffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition":
          `attachment; filename="GLV Weekly Report ${filenameDate}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Unable to generate weekly Excel report.", error);
    return NextResponse.json(
      { error: "Unable to generate the weekly report. Please try again." },
      { status: 500 }
    );
  }
}
