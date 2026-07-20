import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getCurrentWeekRange } from "@/lib/reports";
import { isAdminRole } from "@/lib/roles";
import { buildWeeklyReportWorkbook } from "@/lib/weekly-excel-report";

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

  if (!session?.user?.id || !isAdminRole(session.user.role)) {
    return NextResponse.json(
      { error: "Admin access is required." },
      { status: 403 }
    );
  }

  try {
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
