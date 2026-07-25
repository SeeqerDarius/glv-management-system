import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSuperAdminRole } from "@/lib/roles";
import { parseWeeklyReport } from "@/lib/weekly-report-import";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id || !isSuperAdminRole(session.user.role)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File) || !file.name.toLowerCase().endsWith(".xlsx")) {
    return Response.json({ error: "Choose a valid XLSX weekly report." }, { status: 400 });
  }
  if (file.size > 10 * 1024 * 1024) {
    return Response.json({ error: "The workbook must be 10MB or smaller." }, { status: 400 });
  }

  try {
    const report = await parseWeeklyReport(await file.arrayBuffer());
    const currentStaff = await prisma.staff.findMany({
      where: { active: true },
      select: { id: true, code: true, fullName: true },
      orderBy: { fullName: "asc" },
    });
    const autoMapping = Object.fromEntries(
      report.staffCodes.map((code) => [
        code,
        currentStaff.find(
          (staff) => staff.code.toUpperCase() === code.toUpperCase()
        )?.id ?? "",
      ])
    );

    return Response.json({
      counts: {
        accounts: report.accounts.length,
        customers: new Set(report.accounts.map((row) => row.customerId)).size,
        payments: report.payments.length,
        products: new Set(report.accounts.map((row) => row.productName)).size,
      },
      staffCodes: report.staffCodes,
      currentStaff,
      autoMapping,
      warnings: report.warnings,
    });
  } catch (error) {
    console.error("WEEKLY_REPORT_PREVIEW_FAILED", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Unable to read workbook." },
      { status: 400 }
    );
  }
}
