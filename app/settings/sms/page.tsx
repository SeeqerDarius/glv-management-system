import Link from "next/link";
import { redirect } from "next/navigation";
import { retryFailedSms } from "@/actions/sms";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSuperAdminRole } from "@/lib/roles";
import { smsProviderConfigured } from "@/lib/sms-provider";

export const dynamic = "force-dynamic";

export default async function SmsPage() {
  const session = await auth();
  if (!session?.user || !isSuperAdminRole(session.user.role)) redirect("/dashboard");
  const [settings, messages, counts] = await Promise.all([
    prisma.setting.findFirst(),
    prisma.smsNotification.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.smsNotification.groupBy({ by: ["status"], _count: true }),
  ]);
  return <main className="space-y-6 p-4 md:p-6">
    <Link href="/settings" className="text-sm underline">Back to settings</Link>
    <div><h1 className="text-2xl font-bold">SMS notifications</h1>
      <p className="mt-2 text-sm text-gray-600">Salary payments, new payment plans, 70% progress and missed weekly payments.</p></div>
    <div className="space-y-2 rounded-lg border bg-white p-4">
      <p>BMS Africa: {smsProviderConfigured() ? "Configured" : "Setup required"} · Notifications: {settings?.smsNotificationsEnabled ? "Enabled" : "Paused"}</p>
      <p className="text-sm">Sender: {process.env.MNOTIFY_SENDER_ID || "Not configured"}</p>
      <p className="text-sm">Accepted means BMS accepted the message. Check <a href="https://app.bms.africa/dashboard/sms/campaigns" className="underline" target="_blank" rel="noreferrer">BMS campaign history</a> for delivery confirmation.</p>
      <p className="text-sm">Correct phone numbers or provider setup before retrying failed messages. Unknown results require checking BMS history and operator reconciliation to prevent duplicate texts.</p>
      <p className="text-sm">{counts.map(item => `${item.status}: ${item._count}`).join(" · ") || "No messages yet."}</p>
    </div>
    <div className="overflow-x-auto rounded-lg border bg-white">
      <table className="min-w-full text-left text-sm">
        <caption className="p-3 text-left">Latest 100 notifications</caption>
        <thead><tr>{["Created", "Type", "Phone", "Status", "Message", "Action"].map(label => <th key={label} className="p-3">{label}</th>)}</tr></thead>
        <tbody>{messages.map(message => <tr key={message.id} className="border-t align-top">
          <td className="whitespace-nowrap p-3">{message.createdAt.toISOString().slice(0, 16).replace("T", " ")} UTC</td>
          <td className="p-3">{message.type}</td><td className="p-3">{message.recipient || "Missing"}</td>
          <td className="p-3">{message.status}<p className="mt-1 text-xs">Attempts: {message.attempts}</p></td>
          <td className="min-w-64 max-w-lg p-3"><p>{message.body}</p>{message.lastError && <p className="mt-2 text-red-700">{message.lastError}</p>}
            {message.providerId && <p className="mt-2 break-all text-xs">BMS campaign: {message.providerId}</p>}</td>
          <td className="p-3">{message.status === "FAILED" && <form action={retryFailedSms}><input type="hidden" name="id" value={message.id}/><button className="rounded border px-3 py-2 font-medium">Retry</button></form>}</td>
        </tr>)}</tbody>
      </table>
      {!messages.length && <p className="p-4 text-gray-600">Messages will appear here when SMS is enabled and a qualifying event occurs.</p>}
    </div>
  </main>;
}
