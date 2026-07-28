import { createAutomatedDatabaseBackup } from "@/lib/automated-database-backup";
import { dispatchDueCustomerMessages } from "@/lib/customer-communications";

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
    const [result, messages] = await Promise.all([
      createAutomatedDatabaseBackup(),
      dispatchDueCustomerMessages(100),
    ]);
    return Response.json({ ok: true, ...result, messages });
  } catch (error) {
    console.error("Daily database backup failed", error);
    return Response.json(
      { error: "Daily database backup failed." },
      { status: 500 }
    );
  }
}
