import { NextResponse } from "next/server";
import { UserPermission } from "@prisma/client";
import { auth } from "@/lib/auth";
import { getProcurementList } from "@/lib/procurement";
import { hasPermission } from "@/lib/roles";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const attention: Record<
    string,
    { count: number; label: string; href: string }
  > = {};

  if (
    hasPermission(
      session.user.role,
      session.user.permissions,
      UserPermission.MANAGE_PRODUCTS,
    )
  ) {
    const procurement = await getProcurementList();

    if (procurement.items.length > 0) {
      attention["/products"] = {
        count: procurement.items.length,
        label: `${procurement.items.length} product${
          procurement.items.length === 1 ? "" : "s"
        } ready for procurement`,
        href: "/products?tab=procurement",
      };
    }
  }

  return NextResponse.json({ attention });
}
