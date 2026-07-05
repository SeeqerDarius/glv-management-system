import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdminRole } from "@/lib/roles";

export const dynamic = "force-dynamic";

type IncomingMessage = {
  role: "user" | "assistant";
  content: string;
};

function cleanMessages(value: unknown): IncomingMessage[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((message): message is IncomingMessage => {
      if (!message || typeof message !== "object") return false;
      const candidate = message as Partial<IncomingMessage>;
      return (
        (candidate.role === "user" || candidate.role === "assistant") &&
        typeof candidate.content === "string" &&
        candidate.content.trim().length > 0
      );
    })
    .slice(-10)
    .map((message) => ({
      role: message.role,
      content: message.content.trim().slice(0, 2000),
    }));
}

function extractText(response: unknown) {
  if (!response || typeof response !== "object") return "";

  const direct = (response as { output_text?: unknown }).output_text;
  if (typeof direct === "string") return direct.trim();

  const output = (response as { output?: unknown }).output;
  if (!Array.isArray(output)) return "";

  return output
    .flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const content = (item as { content?: unknown }).content;
      return Array.isArray(content) ? content : [];
    })
    .map((contentItem) => {
      if (!contentItem || typeof contentItem !== "object") return "";
      const text = (contentItem as { text?: unknown }).text;
      return typeof text === "string" ? text : "";
    })
    .filter(Boolean)
    .join("\n")
    .trim();
}

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isAdminRole(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "AI Support is not configured yet. Add OPENAI_API_KEY on the server, then restart the app.",
      },
      { status: 503 },
    );
  }

  const body = (await request.json().catch(() => null)) as {
    messages?: unknown;
  } | null;
  const messages = cleanMessages(body?.messages);
  const latestUserMessage = [...messages]
    .reverse()
    .find((message) => message.role === "user");

  if (!latestUserMessage) {
    return NextResponse.json(
      { error: "Send a question for AI Support." },
      { status: 400 },
    );
  }

  const role = session.user.role || "STAFF";
  const permissions = Array.isArray(session.user.permissions)
    ? session.user.permissions
    : [];
  const transcript = messages
    .map((message) => `${message.role.toUpperCase()}: ${message.content}`)
    .join("\n\n");

  const instructions = [
    "You are GLV AI Support inside the GLV Management System.",
    "Help signed-in users understand workflows, navigation, permissions, and safe next steps.",
    "The app manages customers, product accounts, installment payments, products, procurement signals, staff, credits/refunds, reports, settings, activity, and audit logs.",
    "Be concise, operational, and Ghana-friendly. Use simple steps.",
    "Do not claim you changed records. Do not reveal or reset passwords. Do not bypass permissions.",
    "If the question asks for financial/legal advice, give only system workflow guidance and recommend admin review.",
    "Known caveat: many Settings fields are stored but not wired into live behavior; separate saved settings from effective business rules.",
    "Password reset guardrail: successful password changes must clear auth cookies on the redirect and avoid stale mustChangePassword token loops.",
  ].join("\n");

  const input = [
    `Current user role: ${role}`,
    `Current permissions: ${permissions.join(", ") || "none"}`,
    "Recent chat:",
    transcript,
  ].join("\n\n");

  let openAiResponse: Response;

  try {
    openAiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
        instructions,
        input,
        max_output_tokens: 700,
      }),
    });
  } catch (error) {
    console.error("AI_SUPPORT_NETWORK_ERROR", error);

    return NextResponse.json(
      { error: "AI Support could not reach the AI service. Try again shortly." },
      { status: 502 },
    );
  }

  if (!openAiResponse.ok) {
    const errorBody = await openAiResponse.text().catch(() => "");
    let message = "AI Support could not prepare a response. Try again shortly.";

    try {
      const parsed = JSON.parse(errorBody) as {
        error?: { message?: string; code?: string };
      };
      const errorMessage = parsed.error?.message ?? "";

      if (
        openAiResponse.status === 429 ||
        errorMessage.toLowerCase().includes("quota")
      ) {
        message =
          "AI Support is connected, but the OpenAI project has no available quota. Check the OpenAI plan and billing details.";
      }
    } catch {
      // Keep the safe generic message when the provider response is not JSON.
    }

    console.error("AI_SUPPORT_OPENAI_ERROR", {
      status: openAiResponse.status,
      body: errorBody.slice(0, 500),
    });

    return NextResponse.json(
      { error: message },
      { status: 502 },
    );
  }

  const data = (await openAiResponse.json()) as unknown;
  const reply = extractText(data);

  return NextResponse.json({
    reply:
      reply ||
      "I could not prepare a clear response. Please rephrase the question.",
  });
}
