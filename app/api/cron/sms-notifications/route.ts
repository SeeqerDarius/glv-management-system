import { dispatchDueSms, queueMissedPaymentSms, queueWeeklyStaffPerformanceSms } from "@/lib/sms-notifications";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const reminders = await queueMissedPaymentSms();
    const weeklyStaffPerformance = await prisma.$transaction((tx) => queueWeeklyStaffPerformanceSms(tx));
    const dispatch = await dispatchDueSms(100);
    return Response.json({ ok: true, reminders, weeklyStaffPerformance, dispatch });
  } catch {
    console.error("SMS scheduled run failed.");
    return Response.json({ error: "SMS scheduled run failed." }, { status: 500 });
  }
}
