import { dispatchDueSms } from "@/lib/sms-notifications";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const dispatch = await dispatchDueSms(100, "WEEKLY_STAFF_PERFORMANCE");
    return Response.json({ ok: true, dispatch });
  } catch {
    console.error("Weekly staff performance SMS job failed.");
    return Response.json({ error: "Weekly staff performance SMS job failed." }, { status: 500 });
  }
}
