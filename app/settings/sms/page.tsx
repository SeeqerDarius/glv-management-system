import Link from "next/link";
import { redirect } from "next/navigation";
import { retryFailedSms, updateSmsConfiguration, updateSmsTemplates } from "@/actions/sms";
import { SmsTemplateEditor } from "@/components/sms-template-editor";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSuperAdminRole } from "@/lib/roles";
import { smsProviderConfigured } from "@/lib/sms-provider";
import { smsTemplateValue } from "@/lib/sms-templates";

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
    <div><h1 className="text-2xl font-bold">SMS configuration and delivery</h1>
      <p className="mt-2 text-sm text-gray-600">Configure GLV alerts and monitor messages sent through BMS Africa.</p></div>
    <section className="space-y-4 rounded-lg border bg-white p-4">
      <h2 className="text-lg font-semibold">Provider configuration</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div><p className="text-xs text-gray-500">Provider</p><p className="font-medium">BMS Africa</p></div>
        <div><p className="text-xs text-gray-500">API key</p><p className="font-medium">{process.env.MNOTIFY_API_KEY ? "Configured securely" : "Setup required"}</p></div>
        <div><p className="text-xs text-gray-500">Approved network sender</p><p className="font-medium">{process.env.MNOTIFY_SENDER_ID || "Setup required"}</p></div>
        <div><p className="text-xs text-gray-500">Message brand</p><p className="font-medium">Rock Frost Group</p></div>
        <div><p className="text-xs text-gray-500">Daily reminder run</p><p className="font-medium">09:00 Ghana time</p></div>
      </div>
      <form action={updateSmsConfiguration} className="flex flex-wrap items-center gap-3 border-t pt-4">
        <label className="flex items-center gap-2">
          <input type="checkbox" name="smsNotificationsEnabled" defaultChecked={settings?.smsNotificationsEnabled ?? false} className="h-4 w-4" />
          <span className="font-medium">Enable automatic SMS notifications</span>
        </label>
        <button type="submit" className="rounded bg-green-800 px-4 py-2 font-medium text-white">Save SMS configuration</button>
      </form>
      {!smsProviderConfigured() && <p className="text-sm text-red-700">The server API key and approved sender must be configured before messages can be delivered.</p>}
    </section>
    <form action={updateSmsTemplates} className="space-y-4 rounded-lg border bg-white p-4">
      <div><h2 className="text-lg font-semibold">Message templates</h2>
        <p className="mt-1 text-sm text-gray-600">Choose a placeholder to insert live GLV data. Staff and customer name placeholders always use the recipient&apos;s first name. Changes apply to notifications queued after you save; messages already in the delivery queue keep their reviewed wording.</p></div>
      <div className="grid gap-4 lg:grid-cols-2">
        <SmsTemplateEditor templateKey="salary" initialValue={smsTemplateValue("salary", settings?.smsSalaryTemplate)} />
        <SmsTemplateEditor templateKey="welcome" initialValue={smsTemplateValue("welcome", settings?.smsWelcomeTemplate)} />
        <SmsTemplateEditor templateKey="progress70" initialValue={smsTemplateValue("progress70", settings?.smsProgress70Template)} />
        <SmsTemplateEditor templateKey="missedWeek" initialValue={smsTemplateValue("missedWeek", settings?.smsMissedWeekTemplate)} />
        <SmsTemplateEditor templateKey="weeklySummary" initialValue={smsTemplateValue("weeklySummary", settings?.smsWeeklySummaryTemplate)} />
      </div>
      <div className="flex flex-wrap gap-3">
        <button type="submit" className="rounded bg-green-800 px-4 py-2 font-medium text-white">Save message templates</button>
        <button type="submit" name="intent" value="reset" className="rounded border px-4 py-2 font-medium">Reset all to defaults</button>
      </div>
    </form>
    <section className="rounded-lg border bg-white p-4">
      <h2 className="mb-3 text-lg font-semibold">Automatic notification rules</h2>
      <div className="overflow-x-auto"><table className="min-w-full text-left text-sm">
        <thead><tr>{["Notification", "Trigger", "Frequency"].map(label => <th key={label} className="p-2">{label}</th>)}</tr></thead>
        <tbody>{[
          ["Salary payment", "A salary payment is recorded", "Once per salary payment"],
          ["Customer welcome", "A new product payment plan starts", "Once per account"],
          ["70% progress", "Recorded payments reach at least 70% of target", "Once per account"],
          ["Missed payment", "An active or overdue account has no payment for 7 full days", "Once per further unpaid week"],
          ["Weekly payment summary", "A staff deposit is recorded for the week", "Once per paying customer assigned to that staff member each week"],
        ].map(row => <tr key={row[0]} className="border-t">{row.map(cell => <td key={cell} className="p-2">{cell}</td>)}</tr>)}</tbody>
      </table></div>
    </section>
    <div className="space-y-2 rounded-lg border bg-white p-4">
      <h2 className="text-lg font-semibold">Delivery status</h2>
      <p>Notifications: {settings?.smsNotificationsEnabled ? "Enabled" : "Paused"}</p>
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
