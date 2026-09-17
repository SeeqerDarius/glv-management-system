/**
 * Settings are edited one section at a time. Each form posts the section it
 * belongs to and the server action writes only that section's columns, so a tab
 * that is not on screen can never blank out the fields it does not render.
 *
 * These live outside the server-action module because a `"use server"` file may
 * only export async functions.
 */
export const SETTINGS_SECTIONS = [
  "company",
  "operations",
  "payroll",
  "notifications",
  "security",
  "system",
] as const;

export type SettingsSection = (typeof SETTINGS_SECTIONS)[number];

export function isSettingsSection(value: string): value is SettingsSection {
  return SETTINGS_SECTIONS.includes(value as SettingsSection);
}
