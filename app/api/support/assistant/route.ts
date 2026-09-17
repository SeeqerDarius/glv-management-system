import { NextResponse } from "next/server";
import {
  AiSupportError,
  requestSupportReply,
  supportSystemPrompt,
  type SupportMessage,
} from "@/lib/ai-support";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdminRole } from "@/lib/roles";

export const dynamic = "force-dynamic";

function cleanMessages(value: unknown): SupportMessage[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((message): message is SupportMessage => {
      if (!message || typeof message !== "object") return false;
      const candidate = message as Partial<SupportMessage>;
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

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isAdminRole(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as {
    messages?: unknown;
  } | null;
  const messages = cleanMessages(body?.messages);
  const hasUserMessage = messages.some((message) => message.role === "user");

  if (!hasUserMessage) {
    return NextResponse.json(
      { error: "Send a question for AI Support." },
      { status: 400 },
    );
  }

  const settings = await prisma.setting
    .findFirst({
      select: {
        defaultCurrency: true,
        procurementThresholdPercent: true,
        paymentEditWindowHours: true,
        smsNotificationsEnabled: true,
      },
    })
    .catch(() => null);

  const role = session.user.role || "STAFF";
  const systemPrompt = supportSystemPrompt({
    role,
    roleLabel:
      role === "SUPER_ADMIN" ? "Super Admin" : role === "ADMIN" ? "Admin" : "Staff",
    userName: session.user.name || "GLV User",
    permissions: Array.isArray(session.user.permissions)
      ? session.user.permissions
      : [],
    currency: settings?.defaultCurrency || "GHS",
    procurementThresholdPercent: settings?.procurementThresholdPercent ?? 70,
    paymentEditWindowHours: settings?.paymentEditWindowHours ?? 3,
    smsEnabled: settings?.smsNotificationsEnabled ?? false,
  });

  try {
    const { reply } = await requestSupportReply({ systemPrompt, messages });

    return NextResponse.json({ reply });
  } catch (error) {
    if (error instanceof AiSupportError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }

    console.error("AI_SUPPORT_UNEXPECTED_ERROR", error);

    return NextResponse.json(
      { error: "AI Support could not prepare a response. Try again shortly." },
      { status: 502 },
    );
  }
}
