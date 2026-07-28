import Link from "next/link";
import { redirect } from "next/navigation";
import { updateLegalTemplate } from "@/actions/legal-templates";
import { Button } from "@/components/ui/button";
import { auth } from "@/lib/auth";
import { ensureDefaultLegalTemplates, PLACEHOLDERS } from "@/lib/legal-templates";
import { prisma } from "@/lib/prisma";
import { isSuperAdminRole } from "@/lib/roles";

export const dynamic = "force-dynamic";

export default async function LegalSettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await auth();
  if (!session?.user?.id || !isSuperAdminRole(session.user.role)) {
    redirect("/dashboard");
  }
  await ensureDefaultLegalTemplates();
  const [templates, recentMessages, query] = await Promise.all([
    prisma.legalTemplate.findMany({ orderBy: { name: "asc" } }),
    prisma.customerMessage.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { customer: { select: { fullName: true } } },
    }),
    searchParams,
  ]);
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-950">Legal Documents & Customer Messages</h1>
          <p className="mt-1 text-sm text-gray-600">Edit reusable drafts. Generated customer documents keep a snapshot of the wording used at that time.</p>
        </div>
        <Button asChild variant="outline"><Link href="/settings">Back to Settings</Link></Button>
      </div>
      {query.saved ? <p className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800">Template saved.</p> : null}
      <div className="rounded-lg border bg-white p-4">
        <p className="text-sm font-semibold">Available live placeholders</p>
        <div className="mt-2 flex flex-wrap gap-2">{PLACEHOLDERS.map((item) => <code key={item} className="rounded bg-gray-100 px-2 py-1 text-xs">{item}</code>)}</div>
      </div>
      <div className="grid gap-3 rounded-lg border bg-white p-4 sm:grid-cols-3">
        <p className="text-sm"><span className="font-semibold">Email provider:</span> {process.env.RESEND_API_KEY && process.env.CUSTOMER_EMAIL_FROM ? "Configured" : "Needs RESEND_API_KEY and CUSTOMER_EMAIL_FROM"}</p>
        <p className="text-sm"><span className="font-semibold">SMS provider:</span> {process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_SMS_FROM ? "Configured" : "Needs Twilio SMS credentials"}</p>
        <p className="text-sm"><span className="font-semibold">WhatsApp provider:</span> {process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_WHATSAPP_FROM ? "Configured" : "Needs Twilio WhatsApp credentials"}</p>
      </div>
      {templates.map((template) => (
        <form key={template.id} action={updateLegalTemplate} className="space-y-4 rounded-lg border bg-white p-5">
          <input type="hidden" name="key" value={template.key} />
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1"><span className="text-sm font-medium">Template name</span><input name="name" defaultValue={template.name} className="w-full rounded border p-3" required /></label>
            <label className="space-y-1"><span className="text-sm font-medium">Subject</span><input name="subject" defaultValue={template.subject} className="w-full rounded border p-3" required /></label>
          </div>
          <label className="space-y-1"><span className="text-sm font-medium">Document/message draft</span><textarea name="body" defaultValue={template.body} className="min-h-80 w-full rounded border p-3 font-mono text-sm" required /></label>
          <div className="flex items-center justify-between"><label className="flex items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={template.active} /> Active</label><Button type="submit">Save template</Button></div>
        </form>
      ))}
      <section className="rounded-lg border bg-white">
        <div className="border-b p-4"><h2 className="font-semibold">Recent delivery queue</h2></div>
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr><th className="p-3">Customer</th><th className="p-3">Type</th><th className="p-3">Channel</th><th className="p-3">Status</th><th className="p-3">Scheduled</th><th className="p-3">Detail</th></tr></thead><tbody>{recentMessages.map((message) => <tr key={message.id} className="border-t"><td className="p-3">{message.customer.fullName}</td><td className="p-3">{message.type}</td><td className="p-3">{message.channel}</td><td className="p-3">{message.status}</td><td className="p-3">{message.scheduledAt.toLocaleString("en-GB")}</td><td className="max-w-xs truncate p-3 text-red-700">{message.lastError || message.providerId || "-"}</td></tr>)}</tbody></table></div>
      </section>
    </div>
  );
}
