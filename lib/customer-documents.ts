import "server-only";

import { formatMoney } from "@/lib/accounts";
import { prisma } from "@/lib/prisma";
import {
  ensureDefaultLegalTemplates,
  renderLegalTemplate,
} from "@/lib/legal-templates";
import { queueCustomerCommunication } from "@/lib/customer-communications";

function date(value: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(value);
}

export async function createAccountDocument({
  accountId,
  templateKey,
  type,
  createdBy,
  values = {},
  scheduledAt = new Date(),
  dedupeBase,
}: {
  accountId: string;
  templateKey: string;
  type: string;
  createdBy: string;
  values?: Record<string, string | number | null | undefined>;
  scheduledAt?: Date;
  dedupeBase: string;
}) {
  await ensureDefaultLegalTemplates();
  const [account, template, setting] = await Promise.all([
    prisma.customerAccount.findUnique({
      where: { id: accountId },
      include: { customer: true, product: true },
    }),
    prisma.legalTemplate.findUnique({ where: { key: templateKey } }),
    prisma.setting.findFirst(),
  ]);
  if (!account || !template || !template.active) return null;
  const common = {
    customerName: account.customer.fullName,
    customerId: account.customer.customerId,
    customerPhone: account.customer.phone,
    customerEmail: account.customer.email,
    productName: account.product.name,
    accountId: account.id,
    totalPrice: formatMoney(account.targetAmount),
    totalPaid: formatMoney(account.totalPaid),
    newBalance: formatMoney(account.balance),
    companyName: setting?.companyName ?? "GLV",
    companyPhone: setting?.phone,
    companyEmail: setting?.email,
    companyAddress: setting?.address,
    documentDate: date(new Date()),
    ...values,
  };
  const subject = renderLegalTemplate(template.subject, common);
  const content = renderLegalTemplate(template.body, common);
  const document = await prisma.customerDocument.create({
    data: {
      type,
      title: template.name,
      subject,
      content,
      customerId: account.customerId,
      accountId: account.id,
      createdBy,
    },
  });
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://glv-management-system.vercel.app";
  await queueCustomerCommunication({
    customer: account.customer,
    accountId: account.id,
    documentId: document.id,
    type,
    subject,
    body: content,
    scheduledAt,
    dedupeBase,
    documentUrl: `${appUrl}/customer-documents/${document.publicToken}`,
  });
  return document;
}
