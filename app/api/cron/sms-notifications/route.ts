import { refreshAccountLifecycleStatuses } from "@/lib/account-lifecycle";
import { dispatchDueSms, queueMissedPaymentSms } from "@/lib/sms-notifications";
import { recordDailyStatusSnapshot } from "@/lib/status-snapshots";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  // The daily lifecycle sweep runs first, so reminders read today's statuses.
  // Pages only re-sweep every few minutes now, so this is the run that keeps
  // dormancy, closure and archiving moving on days nobody opens the app. A
  // sweep or snapshot failure is reported but does not hold back the SMS run.
  let lifecycle = "ok";
  try {
    await refreshAccountLifecycleStatuses();
    await recordDailyStatusSnapshot();
  } catch (error) {
    lifecycle = "failed";
    console.error("CRON_LIFECYCLE_SWEEP_ERROR", error);
  }
  try {
    const reminders = await queueMissedPaymentSms();
    const dispatch = await dispatchDueSms(100);
    return Response.json({ ok: true, lifecycle, reminders, dispatch });
  } catch {
    console.error("SMS scheduled run failed.");
    return Response.json({ error: "SMS scheduled run failed." }, { status: 500 });
  }
}
