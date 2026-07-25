import { auth } from "@/lib/auth";
import { getLatestAutomatedDatabaseBackup } from "@/lib/automated-database-backup";
import { isSuperAdminRole } from "@/lib/roles";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();

  if (!session?.user?.id || !isSuperAdminRole(session.user.role)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await getLatestAutomatedDatabaseBackup();

  if (!result) {
    return Response.json(
      { error: "No automatic backup is available yet." },
      { status: 404 }
    );
  }

  const date = result.backup.generatedAt.slice(0, 10);

  return new Response(JSON.stringify(result.backup, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="glv-automatic-database-backup-${date}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
