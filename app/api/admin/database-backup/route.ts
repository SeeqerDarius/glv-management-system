import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { buildDatabaseBackup } from "@/lib/database-backup";
import { isSuperAdminRole } from "@/lib/roles";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();

  if (!session?.user?.id || !isSuperAdminRole(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const backup = await buildDatabaseBackup();
  const filename = `glv-database-backup-${new Date()
    .toISOString()
    .slice(0, 10)}.json`;

  return new NextResponse(JSON.stringify(backup, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
