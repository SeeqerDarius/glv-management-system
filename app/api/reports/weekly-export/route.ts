import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdminRole } from "@/lib/roles";
import { buildWeeklyReportWorkbook } from "@/lib/weekly-excel-report";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();

  if (!session?.user?.id || !isAdminRole(session.user.role)) {
    return NextResponse.json(
      { error: "Admin access is required." },
      { status: 403 }
    );
  }

  try {
    const workbook = await buildWeeklyReportWorkbook();
    const buffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(Buffer.from(buffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition":
          'attachment; filename="GLV Weekly Report.xlsx"',
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
