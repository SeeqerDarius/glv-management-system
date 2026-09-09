export const SMS_TEMPLATE_KEYS = ["salary", "welcome", "progress70", "missedWeek", "weeklySummary"] as const;
export type SmsTemplateKey = (typeof SMS_TEMPLATE_KEYS)[number];

export const SMS_TEMPLATE_DEFINITIONS: Record<SmsTemplateKey, {
  label: string;
  description: string;
  defaultTemplate: string;
  placeholders: readonly string[];
  previewValues: Record<string, string>;
}> = {
  salary: {
    label: "Salary payment",
    description: "Sent only to the staff member attached to the recorded salary payment.",
    defaultTemplate: "Rock Frost Group: Hello {{staffName}}, your salary payment of {{amount}} for {{salaryMonth}} was recorded on {{paymentDate}}. Thank you for your work.",
    placeholders: ["staffName", "amount", "salaryMonth", "paymentDate"],
    previewValues: { staffName: "Ama", amount: "GHS 1,200.00", salaryMonth: "2026-09", paymentDate: "2026-09-09" },
  },
  welcome: {
    label: "Customer welcome",
    description: "Sent only to the customer attached to the new payment plan.",
    defaultTemplate: "Rock Frost Group: Welcome {{customerName}}! Your {{productName}} plan starts {{startDate}}. Target: {{targetAmount}}. Daily payment: {{dailyAmount}}. Pay Small. Own Big.",
    placeholders: ["customerName", "productName", "startDate", "targetAmount", "dailyAmount"],
    previewValues: { customerName: "Kwame", productName: "Television", startDate: "2026-09-09", targetAmount: "GHS 3,500.00", dailyAmount: "GHS 25.00" },
  },
  progress70: {
    label: "70% progress",
    description: "Sent only to the customer whose plan reaches at least 70% paid.",
    defaultTemplate: "Rock Frost Group: Well done {{customerName}}! You have paid at least 70% toward {{productName}}. Paid: {{paidAmount}}. Balance: {{balance}}. Thank you!",
    placeholders: ["customerName", "productName", "paidAmount", "balance"],
    previewValues: { customerName: "Kwame", productName: "Television", paidAmount: "GHS 2,450.00", balance: "GHS 1,050.00" },
  },
  missedWeek: {
    label: "Missed payment",
    description: "Sent only to the customer whose active or overdue plan has had no payment for seven full days.",
    defaultTemplate: "Rock Frost Group: Hello {{customerName}}, we have not recorded a payment on your plan for at least 7 days. Balance: {{balance}}. Please contact your collector to arrange payment. If you have paid, contact GLV to reconcile your record.",
    placeholders: ["customerName", "productName", "balance", "daysSincePayment"],
    previewValues: { customerName: "Kwame", productName: "Television", balance: "GHS 1,050.00", daysSincePayment: "7" },
  },
  weeklySummary: {
    label: "Weekly payment summary",
    description: "Sent once to each paying customer assigned to a staff member when that staff member’s weekly deposit is recorded.",
    defaultTemplate: "Rock Frost Group: Hello {{customerName}}, you paid {{weeklyAmount}} from {{weekStart}} to {{weekEnd}}. Great work this week—keep it up and stay on track!",
    placeholders: ["customerName", "weeklyAmount", "weekStart", "weekEnd", "staffName"],
    previewValues: { customerName: "Kwame", weeklyAmount: "GHS 175.00", weekStart: "2026-09-07", weekEnd: "2026-09-13", staffName: "Ama" },
  },
};

const placeholderPattern = /{{\s*([A-Za-z0-9]+)\s*}}/g;

export function validateSmsTemplate(key: SmsTemplateKey, template: string) {
  const value = template.trim();
  if (!value) throw new Error(`${SMS_TEMPLATE_DEFINITIONS[key].label} message cannot be empty.`);
  if (value.length > 612) throw new Error(`${SMS_TEMPLATE_DEFINITIONS[key].label} message must be 612 characters or fewer.`);
  const allowed = new Set(SMS_TEMPLATE_DEFINITIONS[key].placeholders);
  for (const match of value.matchAll(placeholderPattern)) {
    if (!allowed.has(match[1])) throw new Error(`{{${match[1]}}} is not available in the ${SMS_TEMPLATE_DEFINITIONS[key].label} message.`);
  }
  const unmatched = value.replace(placeholderPattern, "");
  if (unmatched.includes("{{") || unmatched.includes("}}")) throw new Error(`${SMS_TEMPLATE_DEFINITIONS[key].label} contains an incomplete placeholder.`);
  return value;
}

export function renderSmsTemplate(key: SmsTemplateKey, template: string | null | undefined, values: Record<string, string>) {
  const source = validateSmsTemplate(key, template || SMS_TEMPLATE_DEFINITIONS[key].defaultTemplate);
  return source.replace(placeholderPattern, (_match, name: string) => values[name] ?? "");
}

export function smsTemplateValue(key: SmsTemplateKey, value: string | null | undefined) {
  return value?.trim() || SMS_TEMPLATE_DEFINITIONS[key].defaultTemplate;
}

export function smsFirstName(fullName: string) {
  return fullName.trim().split(/\s+/)[0] || "Customer";
}
