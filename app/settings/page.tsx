import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import {
  createProductCategory,
  deleteProductCategory,
  updateProductCategory,
} from "@/actions/product-categories";
import { updateGlobalAppearance, updateMyAppearance } from "@/actions/appearance";
import { restoreDatabaseBackup } from "@/actions/database-restore";
import { updateSettings } from "@/actions/settings";
import { ConfirmDeleteForm } from "@/components/confirm-delete-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSuperAdminRole } from "@/lib/roles";
import { ensureSettingsSchema } from "@/lib/settings-schema";
import {
  getAppearanceSettings,
  normalizeAppearanceSettings,
} from "@/lib/settings";
import { Plus, Trash2 } from "lucide-react";

type SettingsPageProps = {
  searchParams: Promise<{
    appearance?: string;
    category?: string;
    error?: string;
    saved?: string;
    restored?: string;
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
  procurementThresholdPercent: 70,
  paymentEditWindowHours: 3,
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
  "invalid-payment-edit-window": "Payment edit window must be between 3 and 16 hours.",
  "invalid-staff-code-length": "Staff code length must be between 2 and 8 characters.",
  "invalid-password-length": "Password length must be at least 6 characters.",
  "invalid-session-timeout": "Session timeout must be at least 5 minutes.",
  "admin-password-required": "Enter your Super Admin password.",
  "invalid-admin-password": "The Super Admin password was not correct.",
  "restore-confirmation-required": "Type RESTORE GLV DATABASE before restoring a backup.",
  "missing-backup-file": "Choose a GLV backup JSON file.",
  "invalid-backup-file": "That file is not a valid GLV database backup.",
  "missing-category": "Category name is required.",
  "duplicate-category": "A category with that name already exists.",
  "category-not-found": "Category was not found.",
  "delete-other-category": "The Other category is required and cannot be deleted.",
};

const categoryMessages: Record<string, string> = {
  created: "Category added successfully.",
  restored: "Existing category restored successfully.",
  updated: "Category updated and matching products were updated.",
  deleted: "Category deleted. Matching products were moved to Other.",
};

const appearanceMessages: Record<string, string> = {
  personal: "Your appearance preference was saved.",
  global: "Global appearance default was saved for other users.",
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

function ToggleField({
  label,
  name,
  defaultChecked,
  description,
}: {
  label: string;
  name: string;
  defaultChecked: boolean;
  description?: string;
}) {
  return (
    <label className="flex items-start justify-between gap-3 rounded-lg border bg-white px-3 py-2.5 text-sm">
      <span>
        <span className="block font-medium text-gray-800">{label}</span>
        {description ? (
          <span className="mt-1 block text-xs leading-5 text-gray-500">
            {description}
          </span>
        ) : null}
      </span>
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

function AppearanceFields({
  values,
}: {
  values: {
    theme: string;
    primaryColor: string;
    secondaryColor: string;
    dashboardCards: string;
    loadingAnimation: string;
  };
}) {
  return (
    <>
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
      <Field
        label="Primary Color"
        name="primaryColor"
        type="color"
        defaultValue={values.primaryColor}
      />
      <Field
        label="Secondary Color"
        name="secondaryColor"
        type="color"
        defaultValue={values.secondaryColor}
      />
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
    </>
  );
}

function AppearanceSection({
  action,
  title,
  description,
  submitLabel,
  values,
}: {
  action: (formData: FormData) => Promise<void>;
  title: string;
  description: string;
  submitLabel: string;
  values: {
    theme: string;
    primaryColor: string;
    secondaryColor: string;
    dashboardCards: string;
    loadingAnimation: string;
  };
}) {
  return (
    <form action={action}>
      <SettingsSection title={title} description={description}>
        <AppearanceFields values={values} />
        <div className="flex items-end">
          <Button type="submit" className="w-full">
            {submitLabel}
          </Button>
        </div>
      </SettingsSection>
    </form>
  );
}

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/dashboard");
  }

  const isSuperAdmin = isSuperAdminRole(session.user.role);
  await ensureSettingsSchema();

  const { appearance, category, error, saved, restored } = await searchParams;
  const [setting, categories, categoryCounts, myAppearance] = await Promise.all([
    prisma.setting.findFirst({ orderBy: { createdAt: "asc" } }),
    prisma.productCategory.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.product.groupBy({
      by: ["category"],
      _count: { _all: true },
    }),
    getAppearanceSettings(session.user.id),
  ]);
  const values = { ...defaults, ...setting };
  const globalAppearance = normalizeAppearanceSettings(values);
  const categoryUsage = new Map(
    categoryCounts.map((item) => [item.category, item._count._all])
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gray-950">Settings</h1>
          <p className="mt-1 max-w-3xl text-sm text-gray-600">
            {isSuperAdmin
              ? "Super Admin control panel for company settings plus personal and global appearance preferences."
              : "Your personal appearance settings for the GLV workspace."}
          </p>
        </div>
        <div className="rounded-full border border-lime-200 bg-lime-50 px-4 py-2 text-xs font-semibold text-lime-800">
          {isSuperAdmin ? "Super Admin" : "Personal settings"}
        </div>
      </div>

      {saved ? (
        <div className="rounded-lg border border-lime-200 bg-lime-50 p-4 text-sm text-lime-900">
          Settings saved successfully.
        </div>
      ) : null}

      {category ? (
        <div className="rounded-lg border border-lime-200 bg-lime-50 p-4 text-sm text-lime-900">
          {categoryMessages[category] ?? "Product category updated successfully."}
        </div>
      ) : null}

      {appearance ? (
        <div className="rounded-lg border border-lime-200 bg-lime-50 p-4 text-sm text-lime-900">
          {appearanceMessages[appearance] ?? "Appearance saved successfully."}
        </div>
      ) : null}

      {restored === "database" ? (
        <div className="rounded-lg border border-lime-200 bg-lime-50 p-4 text-sm text-lime-900">
          Database backup restored successfully.
        </div>
      ) : null}

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {errorMessages[error] ?? "Unable to save settings. Please review the form and try again."}
        </div>
      ) : null}

      <AppearanceSection
        action={updateMyAppearance}
        title={isSuperAdmin ? "My Appearance" : "Appearance"}
        description="These controls affect only your own GLV workspace."
        submitLabel="Save My Appearance"
        values={myAppearance}
      />

      {isSuperAdmin ? (
        <AppearanceSection
          action={updateGlobalAppearance}
          title="Global Appearance for Other Users"
          description="Default appearance used by users who have not saved their own preference."
          submitLabel="Save Global Appearance"
          values={globalAppearance}
        />
      ) : null}

      {isSuperAdmin ? (
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
          <Field label="Payment Edit Window Hours" name="paymentEditWindowHours" type="number" min={3} max={16} defaultValue={values.paymentEditWindowHours} />
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

        <SettingsSection title="Security" description="Password, 2FA, and sensitive operation preferences.">
          <Field label="Password Length" name="passwordLength" type="number" min={6} defaultValue={values.passwordLength} />
          <Field label="Session Timeout Minutes" name="sessionTimeoutMinutes" type="number" min={5} defaultValue={values.sessionTimeoutMinutes} />
          <ToggleField label="Require Password Change" name="requirePasswordChange" defaultChecked={values.requirePasswordChange} description="Stores the company policy for password reset flows." />
          <ToggleField label="Two-Factor Authentication" name="twoFactorEnabled" defaultChecked={values.twoFactorEnabled} description="Admin and Super Admin users are forced to enable authenticator-app 2FA." />
          <ToggleField label="Backup Database" name="backupDatabaseEnabled" defaultChecked={values.backupDatabaseEnabled} description="Enables the Super Admin backup controls below." />
          <ToggleField label="Export Database" name="exportDatabaseEnabled" defaultChecked={values.exportDatabaseEnabled} description="Allows Super Admin database backup downloads." />
        </SettingsSection>

        <SettingsSection title="Notifications" description="Outbound channel preferences. These are separate from the in-app sidebar attention badges and need provider setup before messages can be sent.">
          <ToggleField label="Email Notifications (planned)" name="emailNotificationsEnabled" defaultChecked={values.emailNotificationsEnabled} description="Saved only. No email delivery provider is connected yet." />
          <ToggleField label="SMS Notifications (planned)" name="smsNotificationsEnabled" defaultChecked={values.smsNotificationsEnabled} description="Saved only. No SMS gateway is connected yet." />
          <ToggleField label="WhatsApp Reminders (planned)" name="whatsappRemindersEnabled" defaultChecked={values.whatsappRemindersEnabled} description="Saved only. No WhatsApp provider is connected yet." />
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
      ) : null}

      {isSuperAdmin ? (
        <Card className="border-gray-200 bg-white shadow-sm">
          <CardHeader>
            <CardTitle>Database Backup & Restore</CardTitle>
            <CardDescription>
              Download a JSON backup or restore from a GLV backup file. Restore
              replaces operational data and requires your Super Admin password.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5 lg:grid-cols-2">
            <div className="rounded-lg border bg-gray-50 p-4">
              <h2 className="font-semibold text-gray-950">Backup</h2>
              <p className="mt-1 text-sm text-gray-600">
                Export the current database data as a JSON backup file.
              </p>
              <Button asChild className="mt-4">
                <a href="/api/admin/database-backup" download>
                  Download Backup
                </a>
              </Button>
            </div>

            <form
              action={restoreDatabaseBackup}
              encType="multipart/form-data"
              className="space-y-3 rounded-lg border border-red-200 bg-red-50 p-4"
            >
              <div>
                <h2 className="font-semibold text-red-950">Restore</h2>
                <p className="mt-1 text-sm leading-6 text-red-800">
                  This replaces the current operational data with the uploaded
                  backup. Use only when you are sure.
                </p>
              </div>
              <Input
                name="backupFile"
                type="file"
                accept="application/json,.json"
                className="bg-white"
                required
              />
              <Input
                name="confirmationText"
                placeholder="Type RESTORE GLV DATABASE"
                className="bg-white"
                required
              />
              <Input
                name="adminPassword"
                type="password"
                placeholder="Super Admin password"
                autoComplete="current-password"
                className="bg-white"
                required
              />
              <Button type="submit" variant="destructive">
                Restore Backup
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {isSuperAdmin ? (
      <Card className="border-gray-200 bg-white shadow-sm">
        <CardHeader>
          <CardTitle>Product Categories Management</CardTitle>
          <CardDescription>
            Manage the categories staff select from when creating or editing
            products.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-gray-950">Categories</h2>
              <p className="mt-1 text-sm text-gray-500">
                Renaming a category updates matching products. Deleting a category moves matching products to Other.
              </p>
            </div>
            <form action={createProductCategory} className="flex w-full gap-2 sm:w-auto">
              <Input
                name="name"
                placeholder="New category"
                className="h-10 bg-white sm:w-56"
                required
              />
              <Button type="submit" className="gap-2">
                <Plus className="size-4" />
                Add
              </Button>
            </form>
          </div>

          <div className="overflow-hidden rounded-lg border border-gray-200">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-sm">
                <thead>
                  <tr className="border-b bg-gray-50 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                    <th className="px-3 py-2.5">Category</th>
                    <th className="px-3 py-2.5 text-right">Products</th>
                    <th className="px-3 py-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {categories.map((item) => {
                    const usedBy = categoryUsage.get(item.name) ?? 0;

                    return (
                      <tr key={item.id}>
                        <td className="px-3 py-3">
                          <form action={updateProductCategory} className="flex items-center gap-2">
                            <input type="hidden" name="id" value={item.id} />
                            <Input
                              name="name"
                              defaultValue={item.name}
                              className="h-9 bg-white"
                              required
                            />
                            <Button type="submit" variant="outline" size="sm">
                              Save
                            </Button>
                          </form>
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums text-gray-700">
                          {usedBy}
                        </td>
                        <td className="px-3 py-3 text-right">
                          <ConfirmDeleteForm
                            action={deleteProductCategory}
                            id={item.id}
                            title={`Delete ${item.name}?`}
                            description={
                              usedBy > 0
                                ? `${usedBy} product${usedBy === 1 ? "" : "s"} will be moved to Other.`
                                : "This category is not being used by any product."
                            }
                            hasLinkedHistory={usedBy > 0}
                            requireAdminPassword={false}
                            triggerClassName="gap-1"
                            buttonVariant="outline"
                          >
                            <Trash2 className="size-4" />
                            Delete
                          </ConfirmDeleteForm>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </CardContent>
      </Card>
      ) : null}
    </div>
  );
}
