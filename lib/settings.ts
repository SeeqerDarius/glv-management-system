import { cache } from "react";
import { prisma } from "@/lib/prisma";

export const fallbackSettings = {
  companyName: "God's Love Ventures",
  tradingName: "GLV",
  tagline: "Pay Small. Own Big.",
  phone: "",
  installmentDurationDays: 184,
  defaultDailyCollection: 0,
  procurementThresholdPercent: 70,
  defaultMonthlySalary: 0,
  receiptPrefix: "GLV/RCPT",
  customerIdPrefix: "GLV",
  staffCodeLength: 3,
  passwordLength: 8,
  requirePasswordChange: true,
  primaryColor: "#84cc16",
  secondaryColor: "#111827",
  loadingAnimation: "glv",
};

export const getSettings = cache(async () => {
  const settings = await prisma.setting.findFirst({
    orderBy: {
      createdAt: "asc",
    },
  });

  return {
    ...fallbackSettings,
    ...settings,
  };
});

export async function getSettingsValue<K extends keyof typeof fallbackSettings>(
  key: K
) {
  const settings = await getSettings();
  return settings[key];
}
