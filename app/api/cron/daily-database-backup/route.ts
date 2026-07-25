import { createAutomatedDatabaseBackup } from "@/lib/automated-database-backup";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;

  if (
    !cronSecret ||
    request.headers.get("authorization") !== `Bearer ${cronSecret}`
  ) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await createAutomatedDatabaseBackup();
    return Response.json({ ok: true, ...result });
  } catch (error) {
    console.error("Daily database backup failed", error);
    return Response.json(
      { error: "Daily database backup failed." },
      { status: 500 }
    );
  }
}
