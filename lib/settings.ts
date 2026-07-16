import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { ensureSettingsSchema } from "@/lib/settings-schema";

export const themeOptions = ["light", "dark", "system"] as const;
export const dashboardCardOptions = ["standard", "compact", "detailed"] as const;
export const loadingAnimationOptions = ["glv", "minimal", "none"] as const;

export const fallbackSettings = {
  companyName: "God's Love Ventures",
  tradingName: "GLV",
  tagline: "Pay Small. Own Big.",
  phone: "",
  installmentDurationDays: 184,
  defaultDailyCollection: 0,
  procurementThresholdPercent: 70,
  paymentEditWindowHours: 3,
  defaultMonthlySalary: 0,
  defaultStaffInventoryQuantity: 10,
  receiptPrefix: "GLV/RCPT",
  customerIdPrefix: "GLV",
  staffCodeLength: 3,
  passwordLength: 8,
  requirePasswordChange: true,
  primaryColor: "#84cc16",
  secondaryColor: "#111827",
  theme: "light",
  dashboardCards: "standard",
  loadingAnimation: "glv",
};

export type AppearanceSettings = Pick<
  typeof fallbackSettings,
  "theme" | "primaryColor" | "secondaryColor" | "dashboardCards" | "loadingAnimation"
>;

export function normalizeThemeValue(value: string | null | undefined): string {
  return themeOptions.includes(value as (typeof themeOptions)[number])
    ? String(value)
    : fallbackSettings.theme;
}

export function normalizeDashboardCardsValue(value: string | null | undefined): string {
  return dashboardCardOptions.includes(value as (typeof dashboardCardOptions)[number])
    ? String(value)
    : fallbackSettings.dashboardCards;
}

export function normalizeLoadingAnimationValue(value: string | null | undefined): string {
  return loadingAnimationOptions.includes(value as (typeof loadingAnimationOptions)[number])
    ? String(value)
    : fallbackSettings.loadingAnimation;
}

export function normalizeColorValue(
  value: string | null | undefined,
  fallback: string
) {
  return /^#[0-9a-f]{6}$/i.test(value ?? "") ? String(value) : fallback;
}

export function normalizeAppearanceSettings(
  values: Partial<AppearanceSettings>
): AppearanceSettings {
  return {
    theme: normalizeThemeValue(values.theme),
    primaryColor: normalizeColorValue(
      values.primaryColor,
      fallbackSettings.primaryColor
    ),
    secondaryColor: normalizeColorValue(
      values.secondaryColor,
      fallbackSettings.secondaryColor
    ),
    dashboardCards: normalizeDashboardCardsValue(values.dashboardCards),
    loadingAnimation: normalizeLoadingAnimationValue(values.loadingAnimation),
  };
}

export const getSettings = cache(async () => {
  await ensureSettingsSchema();

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

export async function getAppearanceSettings(userId?: string | null) {
  const settings = await getSettings();
  const globalAppearance = normalizeAppearanceSettings(settings);

  if (!userId) {
    return globalAppearance;
  }

  const userAppearance = await prisma.userAppearancePreference.findUnique({
    where: { userId },
  });

  if (!userAppearance) {
    return globalAppearance;
  }

  return normalizeAppearanceSettings({
    ...globalAppearance,
    theme: userAppearance.theme,
    primaryColor: userAppearance.primaryColor,
    secondaryColor: userAppearance.secondaryColor,
    dashboardCards: userAppearance.dashboardCards,
    loadingAnimation: userAppearance.loadingAnimation,
  });
}
