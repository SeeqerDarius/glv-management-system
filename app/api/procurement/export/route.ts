import { NextResponse } from "next/server";
import { UserPermission } from "@prisma/client";
import { auth } from "@/lib/auth";
import { buildProcurementWorkbook } from "@/lib/procurement-excel-report";
import { hasPermission, isAdminRole } from "@/lib/roles";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();

  if (
    !session?.user?.id ||
    (!isAdminRole(session.user.role) &&
      !hasPermission(
        session.user.role,
        session.user.permissions,
        UserPermission.MANAGE_PRODUCTS
      ))
  ) {
    return NextResponse.json(
      { error: "Product management access is required." },
      { status: 403 }
    );
  }

  try {
    const workbook = await buildProcurementWorkbook();
    const buffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(Buffer.from(buffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition":
          'attachment; filename="GLV Procurement Customers.xlsx"',
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Unable to generate procurement Excel report.", error);
    return NextResponse.json(
      { error: "Unable to generate procurement export. Please try again." },
      { status: 500 }
    );
  }
}
