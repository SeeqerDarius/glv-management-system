import { dispatchDueSms, queueMissedPaymentSms } from "@/lib/sms-notifications";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const reminders = await queueMissedPaymentSms();
    const dispatch = await dispatchDueSms(100);
    return Response.json({ ok: true, reminders, dispatch });
  } catch {
    console.error("SMS scheduled run failed.");
    return Response.json({ error: "SMS scheduled run failed." }, { status: 500 });
  }
}
