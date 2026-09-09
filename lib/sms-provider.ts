import { normalizeSmsPhone } from "./sms-rules";

export class SmsSendError extends Error {
  constructor(message: string, public readonly outcome: "FAILED" | "PENDING" | "UNKNOWN") {
    super(message);
  }
}

export function smsProviderConfigured() {
  return Boolean(process.env.MNOTIFY_API_KEY && process.env.MNOTIFY_SENDER_ID);
}

export async function sendSms(recipient: string, body: string) {
  const to = normalizeSmsPhone(recipient);
  if (!to?.startsWith("+233")) throw new SmsSendError("A valid Ghana phone number is required.", "FAILED");
  if (!smsProviderConfigured()) throw new SmsSendError("SMS provider is not configured.", "PENDING");
  const sender = process.env.MNOTIFY_SENDER_ID!;
  if (sender.length > 11) throw new SmsSendError("Sender ID must be at most 11 characters.", "FAILED");
  let response: Response;
  try {
    response = await fetch(`https://api.mnotify.com/api/sms/quick?key=${encodeURIComponent(process.env.MNOTIFY_API_KEY!)}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ recipient: [`0${to.slice(4)}`], sender, message: body, is_schedule: false, schedule_date: "" }),
      redirect: "error",
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    // A timeout may follow provider acceptance. Never blindly resend it.
    throw new SmsSendError("Provider outcome unknown. Check provider logs before retrying.", "UNKNOWN");
  }
  if (!response.ok) {
    throw new SmsSendError(`SMS provider HTTP ${response.status}.`,
      response.status === 429 ? "PENDING" : response.status >= 500 ? "UNKNOWN" : "FAILED");
  }
  const result = await response.json().catch(() => null) as {
    status?: string; code?: string; summary?: { _id?: string; total_sent?: number; total_rejected?: number };
  } | null;
  if (result?.status === "error") throw new SmsSendError("BMS rejected the SMS. Check credit, API key and sender approval.", "FAILED");
  if (result?.status !== "success" || !result.summary?._id ||
      result.summary.total_sent !== 1 || result.summary.total_rejected !== 0) {
    throw new SmsSendError("Provider acceptance could not be verified. Check BMS campaign history.", "UNKNOWN");
  }
  return result.summary._id;
}
