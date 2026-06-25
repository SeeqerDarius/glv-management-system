import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { updateSettings } from "@/actions/settings";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdminRole } from "@/lib/roles";

type SettingsPageProps = {
  searchParams: Promise<{
    error?: string;
    saved?: string;
  }>;
};

const defaults = {
  companyName: "God's Love Ventures",
  tradingName: "GLV",
  logoUrl: "",
  tagline: "Pay Small. Own Big.",
  phone: "",
  whatsapp: "",
  email: "",
  website: "",
  address: "",
  gpsAddress: "",
  businessRegistrationNumber: "",
  taxIdentificationNumber: "",
  installmentDurationDays: 184,
  defaultDailyCollection: 0,
  administrationFeePercent: 0,
  refundDeductionPercent: 0,
  deliveryTimeAfterCompletionDays: 0,
  procurementThresholdPercent: 50,
  minimumDeposit: 0,
  defaultCurrency: "GHS",
  defaultMonthlySalary: 0,
  commissionEnabled: false,
  commissionPercentage: 0,
  payrollDay: 1,
  receiptPrefix: "GLV/RCPT",
  customerIdPrefix: "GLV",
  staffCodeLength: 3,
  passwordLength: 8,
  sessionTimeoutMinutes: 60,
  requirePasswordChange: true,
  twoFactorEnabled: false,
  backupDatabaseEnabled: false,
  exportDatabaseEnabled: true,
  emailNotificationsEnabled: false,
  smsNotificationsEnabled: false,
  whatsappRemindersEnabled: false,
  theme: "light",
  primaryColor: "#84cc16",
  secondaryColor: "#111827",
  dashboardCards: "standard",
  loadingAnimation: "glv",
  currentVersion: "0.1.0",
  databaseStatus: "Configured",
  neonStatus: "Configured",
  storageUsage: "",
  restoreBackupStatus: "",
};

const errorMessages: Record<string, string> = {
  "missing-company": "Company name and phone are required.",
  "invalid-duration": "Installment duration must be greater than zero.",
  "invalid-number": "Amounts and percentages must be valid positive numbers.",
  "invalid-percent": "Percentage values cannot be more than 100.",
  "invalid-payroll-day": "Payroll day must be between 1 and 31.",
  "invalid-staff-code-length": "Staff code length must be between 2 and 8 characters.",
  "invalid-password-length": "Password length must be at least 6 characters.",
  "invalid-session-timeout": "Session timeout must be at least 5 minutes.",
};

function Field({
  label,
  name,
  defaultValue,
  type = "text",
  required = false,
  min,
  max,
  step,
}: {
  label: string;
  name: string;
  defaultValue?: string | number | null;
  type?: string;
  required?: boolean;
  min?: number;
  max?: number;
  step?: string;
}) {
  return (
    <label className="space-y-1.5">
      <span className="text-xs font-semibold uppercase tracking-wide text-gray-600">{label}</span>
      <Input
        name={name}
        type={type}
        required={required}
        min={min}
        max={max}
        step={step}
        defaultValue={defaultValue ?? ""}
        className="h-10 bg-white"
      />
    </label>
  );
}

function SelectField({
  label,
  name,
  defaultValue,
  options,
}: {
  label: string;
  name: string;
  defaultValue: string;
  options: Array<{ label: string; value: string }>;
}) {
  return (
    <label className="space-y-1.5">
      <span className="text-xs font-semibold uppercase tracking-wide text-gray-600">{label}</span>
      <select name={name} defaultValue={defaultValue} className="h-10 w-full rounded-lg border border-input bg-white px-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50">
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function ToggleField({ label, name, defaultChecked }: { label: string; name: string; defaultChecked: boolean }) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-lg border bg-white px-3 py-2.5 text-sm">
      <span className="font-medium text-gray-800">{label}</span>
      <input name={name} type="checkbox" defaultChecked={defaultChecked} className="size-4 accent-lime-600" />
    </label>
  );
}

function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Card className="border-gray-200 bg-white shadow-sm">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{children}</div>
      </CardContent>
    </Card>
  );
}

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const session = await auth();
  if (!session?.user?.id || !isAdminRole(session.user.role)) {
    redirect("/dashboard");
  }

  const { error, saved } = await searchParams;
  const setting = await prisma.setting.findFirst({ orderBy: { createdAt: "asc" } });
  const values = { ...defaults, ...setting };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gray-950">Settings</h1>
          <p className="mt-1 max-w-3xl text-sm text-gray-600">
            Admin control panel for GLV company information, layaway rules, salary defaults, receipts, security, notifications, appearance, and system status.
          </p>
        </div>
        <div className="rounded-full border border-lime-200 bg-lime-50 px-4 py-2 text-xs font-semibold text-lime-800">
          Admin only
        </div>
      </div>

      {saved ? (
        <div className="rounded-lg border border-lime-200 bg-lime-50 p-4 text-sm text-lime-900">
          Settings saved successfully.
        </div>
      ) : null}

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {errorMessages[error] ?? "Unable to save settings. Please review the form and try again."}
        </div>
      ) : null}

      <form action={updateSettings} className="space-y-5">
        <SettingsSection title="Company Information" description="Public company identity used across receipts, exports, and operational documents.">
          <Field label="Company Name" name="companyName" defaultValue={values.companyName} required />
          <Field label="Trading Name" name="tradingName" defaultValue={values.tradingName} />
          <Field label="Logo URL" name="logoUrl" defaultValue={values.logoUrl} />
          <Field label="Tagline" name="tagline" defaultValue={values.tagline} />
          <Field label="Phone" name="phone" defaultValue={values.phone} required />
          <Field label="WhatsApp" name="whatsapp" defaultValue={values.whatsapp} />
          <Field label="Email" name="email" type="email" defaultValue={values.email} />
          <Field label="Website" name="website" defaultValue={values.website} />
          <Field label="Address" name="address" defaultValue={values.address} />
          <Field label="GPS Address" name="gpsAddress" defaultValue={values.gpsAddress} />
          <Field label="Business Registration No." name="businessRegistrationNumber" defaultValue={values.businessRegistrationNumber} />
          <Field label="Tax Identification No." name="taxIdentificationNumber" defaultValue={values.taxIdentificationNumber} />
        </SettingsSection>

        <SettingsSection title="Business Rules" description="Core layaway defaults and financial controls for GLV operations.">
          <Field label="Installment Duration" name="installmentDurationDays" type="number" min={1} defaultValue={values.installmentDurationDays} required />
          <Field label="Default Daily Collection" name="defaultDailyCollection" type="number" min={0} step="0.01" defaultValue={values.defaultDailyCollection} />
          <Field label="Administration Fee %" name="administrationFeePercent" type="number" min={0} max={100} step="0.01" defaultValue={values.administrationFeePercent} />
          <Field label="Refund Deduction %" name="refundDeductionPercent" type="number" min={0} max={100} step="0.01" defaultValue={values.refundDeductionPercent} />
          <Field label="Delivery Time After Completion" name="deliveryTimeAfterCompletionDays" type="number" min={0} defaultValue={values.deliveryTimeAfterCompletionDays} />
          <Field label="Procurement Threshold %" name="procurementThresholdPercent" type="number" min={0} max={100} step="0.01" defaultValue={values.procurementThresholdPercent} />
          <Field label="Minimum Deposit" name="minimumDeposit" type="number" min={0} step="0.01" defaultValue={values.minimumDeposit} />
          <Field label="Default Currency" name="defaultCurrency" defaultValue={values.defaultCurrency} />
        </SettingsSection>

        <SettingsSection title="Salary Settings" description="Payroll defaults for monthly salary tracking and future commission logic.">
          <Field label="Default Monthly Salary" name="defaultMonthlySalary" type="number" min={0} step="0.01" defaultValue={values.defaultMonthlySalary} />
          <ToggleField label="Commission Enabled" name="commissionEnabled" defaultChecked={values.commissionEnabled} />
          <Field label="Commission Percentage" name="commissionPercentage" type="number" min={0} max={100} step="0.01" defaultValue={values.commissionPercentage} />
          <Field label="Payroll Day" name="payrollDay" type="number" min={1} max={31} defaultValue={values.payrollDay} />
        </SettingsSection>

        <SettingsSection title="Receipt Settings" description="Numbering rules for receipts, customer IDs, and staff codes.">
          <Field label="Receipt Prefix" name="receiptPrefix" defaultValue={values.receiptPrefix} />
          <Field label="Customer ID Prefix" name="customerIdPrefix" defaultValue={values.customerIdPrefix} />
          <Field label="Staff Code Length" name="staffCodeLength" type="number" min={2} max={8} defaultValue={values.staffCodeLength} />
        </SettingsSection>

        <SettingsSection title="Security" description="Password and session controls, with placeholders for future backup and 2FA workflows.">
          <Field label="Password Length" name="passwordLength" type="number" min={6} defaultValue={values.passwordLength} />
          <Field label="Session Timeout Minutes" name="sessionTimeoutMinutes" type="number" min={5} defaultValue={values.sessionTimeoutMinutes} />
          <ToggleField label="Require Password Change" name="requirePasswordChange" defaultChecked={values.requirePasswordChange} />
          <ToggleField label="Two-Factor Authentication" name="twoFactorEnabled" defaultChecked={values.twoFactorEnabled} />
          <ToggleField label="Backup Database" name="backupDatabaseEnabled" defaultChecked={values.backupDatabaseEnabled} />
          <ToggleField label="Export Database" name="exportDatabaseEnabled" defaultChecked={values.exportDatabaseEnabled} />
        </SettingsSection>

        <SettingsSection title="Notifications" description="Communication channels for future reminders, approvals, and payment alerts.">
          <ToggleField label="Email Notifications" name="emailNotificationsEnabled" defaultChecked={values.emailNotificationsEnabled} />
          <ToggleField label="SMS Notifications" name="smsNotificationsEnabled" defaultChecked={values.smsNotificationsEnabled} />
          <ToggleField label="WhatsApp Reminders" name="whatsappRemindersEnabled" defaultChecked={values.whatsappRemindersEnabled} />
        </SettingsSection>

        <SettingsSection title="Appearance" description="Branding controls used by the GLV interface and loading states.">
          <SelectField
            label="Theme"
            name="theme"
            defaultValue={values.theme}
            options={[
              { label: "Light", value: "light" },
              { label: "Dark", value: "dark" },
              { label: "System", value: "system" },
            ]}
          />
          <Field label="Primary Color" name="primaryColor" type="color" defaultValue={values.primaryColor} />
          <Field label="Secondary Color" name="secondaryColor" type="color" defaultValue={values.secondaryColor} />
          <SelectField
            label="Dashboard Cards"
            name="dashboardCards"
            defaultValue={values.dashboardCards}
            options={[
              { label: "Standard", value: "standard" },
              { label: "Compact", value: "compact" },
              { label: "Detailed", value: "detailed" },
            ]}
          />
          <SelectField
            label="Loading Animation"
            name="loadingAnimation"
            defaultValue={values.loadingAnimation}
            options={[
              { label: "GLV", value: "glv" },
              { label: "Minimal", value: "minimal" },
              { label: "None", value: "none" },
            ]}
          />
        </SettingsSection>

        <SettingsSection title="System" description="Operational metadata for database, Neon, storage, backup, and restore visibility.">
          <Field label="Current Version" name="currentVersion" defaultValue={values.currentVersion} />
          <Field label="Database Status" name="databaseStatus" defaultValue={values.databaseStatus} />
          <Field label="Neon Status" name="neonStatus" defaultValue={values.neonStatus} />
          <Field label="Storage Usage" name="storageUsage" defaultValue={values.storageUsage} />
          <Field label="Restore Backup Status" name="restoreBackupStatus" defaultValue={values.restoreBackupStatus} />
        </SettingsSection>

        <div className="sticky bottom-4 z-10 flex justify-end rounded-xl border border-gray-200 bg-white/90 p-3 shadow-lg backdrop-blur">
          <Button type="submit" size="lg">
            Save Settings
          </Button>
        </div>
      </form>
    </div>
  );
}
