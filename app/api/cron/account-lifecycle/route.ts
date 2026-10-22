import { runAccountLifecycleSweepIfDue } from "@/lib/account-lifecycle";

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
    const result = await runAccountLifecycleSweepIfDue();
    return Response.json({ ok: true, ...result });
  } catch (error) {
    console.error("Account lifecycle scheduled run failed.", error);
    return Response.json(
      { error: "Account lifecycle scheduled run failed." },
      { status: 500 }
    );
  }
}
