import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const LEGAL_TEMPLATE_KEYS = {
  TERMS: "CUSTOMER_TERMS",
  CANCELLATION: "CANCELLATION_CALCULATION",
  REACTIVATION: "REACTIVATION_CALCULATION",
  PAYMENT_RECEIPT: "PAYMENT_RECEIPT",
} as const;

export const PLACEHOLDERS = [
  "{{customerName}}", "{{customerId}}", "{{customerPhone}}", "{{customerEmail}}",
  "{{productName}}", "{{accountId}}", "{{totalPrice}}", "{{totalPaid}}",
  "{{previousAmountPaid}}", "{{deductionRate}}", "{{deductionAmount}}",
  "{{refundAmount}}", "{{refundMethod}}", "{{processingTime}}",
  "{{reactivationCharge}}", "{{amountRemainingAfterCharge}}", "{{newBalance}}",
  "{{expectedCompletionDate}}", "{{receiptNo}}", "{{paymentAmount}}",
  "{{paymentDate}}", "{{paymentMethod}}", "{{companyName}}", "{{companyPhone}}",
  "{{companyEmail}}", "{{companyAddress}}", "{{documentDate}}",
] as const;

const DEFAULTS = [
  {
    key: LEGAL_TEMPLATE_KEYS.TERMS,
    name: "Customer Installment Terms and Conditions",
    subject: "Your {{companyName}} installment terms – {{productName}}",
    body: `CUSTOMER INSTALLMENT PURCHASE TERMS AND CONDITIONS

Date: {{documentDate}}
Customer: {{customerName}} ({{customerId}})
Product: {{productName}}
Account: {{accountId}}
Total installment price: {{totalPrice}}

1. This is an installment/layaway purchase. Unless agreed otherwise in writing, the product remains with {{companyName}} until the full agreed price is paid and delivery is recorded.
2. The recommended payment schedule helps the customer complete the account by the expected date. The customer may pay earlier or make larger payments.
3. Every payment must be recorded against the correct account and supported by an official receipt or verifiable electronic record.
4. Any amount paid above the remaining balance will be recorded as customer credit and may be refunded or applied as approved.
5. An account may become dormant after 21 days without payment, enter probation after four months, and close after six months without payment activity. GLV should make reasonable efforts to contact the customer before closure.
6. Before a cancellation, closure, refund deduction, or reactivation is finalised, the customer will receive a written calculation showing the applicable figures and expected processing steps.
7. Any service charge or deduction must be disclosed to the customer. Current automated closure and eligible reactivation calculations may apply a 32% service charge, subject to applicable law and GLV's approved policy.
8. After full payment, GLV will arrange delivery or collection within the communicated delivery period. A materially different substitute requires the customer's agreement.
9. Manufacturer warranties, where available, will be passed to the customer. These terms do not remove rights that cannot lawfully be excluded.
10. GLV may process customer identity, contact, account, payment, delivery and support records for account administration, verification, lawful communications and compliance. Customers may request access to or correction of their information.
11. Account notices may be sent by email, SMS or WhatsApp using the contact details supplied by the customer.
12. Complaints should first be submitted to {{companyName}} at {{companyPhone}} or {{companyEmail}}. These terms are governed by the laws of Ghana.

By opening or continuing this account, the customer acknowledges receipt and acceptance of these terms, subject to any mandatory rights under Ghanaian law.`,
  },
  {
    key: LEGAL_TEMPLATE_KEYS.CANCELLATION,
    name: "Cancellation / Closure Calculation",
    subject: "Cancellation calculation for {{customerName}} – {{productName}}",
    body: `CANCELLATION / CLOSURE CALCULATION

Date: {{documentDate}}
Dear {{customerName}},

This notice provides the written calculation for account {{accountId}} relating to {{productName}}.

Total agreed price: {{totalPrice}}
Total amount paid: {{totalPaid}}
Disclosed deduction rate: {{deductionRate}}
Deduction/service charge: {{deductionAmount}}
Refund or customer credit due: {{refundAmount}}
Expected refund method: {{refundMethod}}
Expected processing time: {{processingTime}}

Please contact {{companyName}} on {{companyPhone}} if any figure appears incorrect. This calculation does not remove any right available under applicable law.`,
  },
  {
    key: LEGAL_TEMPLATE_KEYS.REACTIVATION,
    name: "Account Reactivation Calculation",
    subject: "Reactivation calculation for {{customerName}} – {{productName}}",
    body: `ACCOUNT REACTIVATION CALCULATION

Date: {{documentDate}}
Dear {{customerName}},

Before reactivation of account {{accountId}} for {{productName}}, the calculation is:

Previous amount paid: {{previousAmountPaid}}
Reactivation charge ({{deductionRate}}): {{reactivationCharge}}
Amount remaining after charge: {{amountRemainingAfterCharge}}
New account balance: {{newBalance}}
Expected completion date: {{expectedCompletionDate}}

Please review this calculation and contact {{companyName}} on {{companyPhone}} with any question.`,
  },
  {
    key: LEGAL_TEMPLATE_KEYS.PAYMENT_RECEIPT,
    name: "Payment Receipt Message",
    subject: "Payment receipt {{receiptNo}} – {{companyName}}",
    body: `Dear {{customerName}}, payment of {{paymentAmount}} for {{productName}} was recorded on {{paymentDate}}. Receipt: {{receiptNo}}. Remaining balance: {{newBalance}}. Thank you. {{companyName}} – {{companyPhone}}`,
  },
];

type TemplateClient = Pick<Prisma.TransactionClient, "legalTemplate">;

export async function ensureDefaultLegalTemplates(
  client: TemplateClient = prisma
) {
  await Promise.all(
    DEFAULTS.map((template) =>
      client.legalTemplate.upsert({
        where: { key: template.key },
        update: {},
        create: template,
      })
    )
  );
}

export function renderLegalTemplate(
  template: string,
  values: Record<string, string | number | null | undefined>
) {
  return Object.entries(values).reduce(
    (result, [key, value]) =>
      result.replaceAll(`{{${key}}}`, String(value ?? "Not provided")),
    template
  );
}
