const GROQ_CHAT_COMPLETIONS_URL =
  "https://api.groq.com/openai/v1/chat/completions";

// Groq retires hosted models on notice, so the configured model is tried first
// and the remaining production models act as a fallback chain. That keeps AI
// Support answering after a retirement instead of failing until someone ships
// a code change.
const FALLBACK_MODELS = [
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant",
] as const;

export type SupportMessage = {
  role: "user" | "assistant";
  content: string;
};

export class AiSupportError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

export function aiSupportConfigured() {
  return Boolean(process.env.GROQ_API_KEY);
}

export function aiSupportModels() {
  const configured = process.env.GROQ_MODEL?.trim();
  const models = configured ? [configured] : [];

  for (const model of FALLBACK_MODELS) {
    if (!models.includes(model)) {
      models.push(model);
    }
  }

  return models;
}

/**
 * Operational knowledge the assistant needs to answer GLV questions correctly.
 * Keep this aligned with the real business rules in `lib/` and with
 * `OPERATOR_HANDOFF.md` whenever a workflow changes.
 */
export function supportSystemPrompt(context: {
  role: string;
  roleLabel: string;
  userName: string;
  permissions: string[];
  currency: string;
  procurementThresholdPercent: number;
  paymentEditWindowHours: number;
  smsEnabled: boolean;
}) {
  return [
    "You are GLV AI Support, the in-app assistant for the GLV Management System, used by God's Love Ventures (trading as GLV) in Ghana.",
    "GLV runs a layaway / installment business: customers pay small daily amounts toward a product, and receive the product once they have paid enough. The company tagline is \"Pay Small. Own Big.\"",
    "",
    "## Who you are talking to",
    `Name: ${context.userName}. Role: ${context.roleLabel} (${context.role}).`,
    `Extra permissions: ${context.permissions.join(", ") || "none beyond the role defaults"}.`,
    `Default currency: ${context.currency}.`,
    "",
    "## What the system contains",
    "- Customers: each customer is assigned to one staff member who collects their payments. Customers have a generated customer ID.",
    "- Product accounts (/accounts): one account = one customer buying one product on installments. An account has a target amount, a daily amount, a start date, an expected end date, total paid, balance, an account status, and a delivery status.",
    "- Account statuses: ACTIVE, OVERDUE, COMPLETED, DORMANT, PROBATION, SUSPENDED, CLOSED, CANCELLED, ARCHIVED.",
    "- Delivery status: PENDING or DELIVERED. Delivered accounts that are complete are archived automatically after a set number of days.",
    "- Payments (/payments): each payment has a receipt number, amount and payment date, and rolls up into the account's total paid and balance.",
    `- Payments can only be edited within the payment edit window, currently ${context.paymentEditWindowHours} hours after recording. After that an admin correction is required.`,
    "- Products (/products): catalog with cost price, transport cost, layaway price, daily amount, duration and category.",
    `- Procurement (/products?tab=procurement): products show up to be bought once a customer account reaches at least ${context.procurementThresholdPercent}% paid and is still pending delivery. Operators confirm the quantity actually bought, and those units leave the list.`,
    "- Staff (/staff): staff records, applications, salaries, weekly deposits and password resets.",
    "- Credits & refunds (/credits): overpayment credits and refunds.",
    "- Reports (/reports): admin financial intelligence, weekly reports and salary tracking. Weekly Excel export and import are available.",
    "- Business management (/business): integrated business records.",
    "- Activity (/activity): collection and activity charts.",
    "- Audit logs (/audit-logs): read-only history of sensitive changes.",
    "- Settings (/settings): company identity, business rules, salary, receipts, security, notifications, product categories, appearance, backup and restore.",
    "- SMS (/settings/sms): message templates and the delivery queue, sent through BMS Africa.",
    `  SMS notifications are currently ${context.smsEnabled ? "enabled" : "paused"}.`,
    "",
    "## Business rules that matter",
    "- Automatic SMS covers: salary payments, customer welcome, 70% progress, missed payments (no payment for 14 days / 2 weeks), and a weekly payment summary when a staff deposit is recorded.",
    "- The weekly summary praises customers who met or beat their expected weekly amount, and gently nudges those who fell short.",
    "- A customer or staff member with no valid phone number is skipped entirely. No message is attempted for them.",
    "- Delivery can be confirmed even when a customer still owes money. That is a deliberate trust decision for consistent customers, it requires an admin, it records the balance owed at delivery, and the customer must keep paying the remaining balance.",
    "- Roles: STAFF see only their own assigned customers and data. ADMIN and SUPER_ADMIN see the business-wide view. Only Super Admin can change company settings, legal templates, SMS templates, and database backup/restore.",
    "",
    "## How to answer",
    "- Be concise, practical and operational. Prefer short numbered steps with the exact page path, for example \"go to /payments, then Record Payment\".",
    "- Use plain, Ghana-friendly English. Amounts are in Ghana cedis unless stated otherwise.",
    "- Answer for the role of the person asking. If something needs a higher role, say who to ask.",
    "- You are read-only. You can explain and guide, but never claim you changed, deleted or recorded anything.",
    "- Never reveal, guess or reset passwords, and never help anyone bypass a permission check.",
    "- For legal or financial advice, give only the system workflow and recommend the owner or an admin review it.",
    "- You do not have access to live customer, payment or account records. If asked about specific figures, say so and point to the page or report that shows them.",
    "- If you are not sure about a GLV behaviour, say you are not sure rather than inventing it. Some Settings fields are stored but not yet wired into live behaviour, so separate \"saved setting\" from \"effective rule\" when it matters.",
  ].join("\n");
}

type GroqChoice = {
  message?: {
    content?: unknown;
  };
};

function extractReply(payload: unknown) {
  if (!payload || typeof payload !== "object") return "";

  const choices = (payload as { choices?: unknown }).choices;
  if (!Array.isArray(choices)) return "";

  return choices
    .map((choice: GroqChoice) => {
      const content = choice?.message?.content;
      return typeof content === "string" ? content : "";
    })
    .filter(Boolean)
    .join("\n")
    .trim();
}

function modelUnavailable(status: number, body: string) {
  if (status !== 400 && status !== 404) return false;

  const lowered = body.toLowerCase();
  return (
    lowered.includes("model_not_found") ||
    lowered.includes("does not exist") ||
    lowered.includes("decommission") ||
    lowered.includes("no longer supported")
  );
}

function friendlyError(status: number, body: string) {
  const lowered = body.toLowerCase();

  if (status === 401 || status === 403) {
    return "AI Support could not authenticate with Groq. Check GROQ_API_KEY on the server.";
  }

  if (status === 429) {
    if (lowered.includes("quota") || lowered.includes("credit")) {
      return "AI Support is connected, but the Groq account has no remaining quota. Check the Groq plan and billing details.";
    }

    return "AI Support is busy right now because the Groq rate limit was reached. Try again in a moment.";
  }

  if (modelUnavailable(status, body)) {
    return "No configured Groq model is available. Set GROQ_MODEL on the server to a current Groq model.";
  }

  return "AI Support could not prepare a response. Try again shortly.";
}

export async function requestSupportReply(options: {
  systemPrompt: string;
  messages: SupportMessage[];
}) {
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    throw new AiSupportError(
      "AI Support is not configured yet. Add GROQ_API_KEY on the server, then restart the app.",
      503,
    );
  }

  const models = aiSupportModels();
  let lastError: AiSupportError | null = null;

  for (const model of models) {
    let response: Response;

    try {
      response = await fetch(GROQ_CHAT_COMPLETIONS_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: options.systemPrompt },
            ...options.messages,
          ],
          temperature: 0.3,
          max_completion_tokens: 900,
        }),
        signal: AbortSignal.timeout(30000),
      });
    } catch (error) {
      console.error("AI_SUPPORT_NETWORK_ERROR", error);

      throw new AiSupportError(
        "AI Support could not reach Groq. Try again shortly.",
        502,
      );
    }

    if (response.ok) {
      const payload = (await response.json().catch(() => null)) as unknown;
      const reply = extractReply(payload);

      if (reply) {
        return { reply, model };
      }

      throw new AiSupportError(
        "AI Support received an empty response. Please rephrase the question.",
        502,
      );
    }

    const errorBody = await response.text().catch(() => "");

    console.error("AI_SUPPORT_GROQ_ERROR", {
      model,
      status: response.status,
      body: errorBody.slice(0, 500),
    });

    lastError = new AiSupportError(
      friendlyError(response.status, errorBody),
      response.status === 401 || response.status === 403 ? 503 : 502,
    );

    // Only a retired or unknown model is worth retrying on the next candidate.
    if (!modelUnavailable(response.status, errorBody)) {
      throw lastError;
    }
  }

  throw (
    lastError ??
    new AiSupportError(
      "AI Support could not prepare a response. Try again shortly.",
      502,
    )
  );
}
