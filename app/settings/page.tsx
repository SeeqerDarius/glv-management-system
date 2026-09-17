import Link from "next/link";
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
import type { SettingsSection } from "@/lib/settings-sections";
import { ConfirmDeleteForm } from "@/components/confirm-delete-form";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { TabsNav } from "@/components/ui/tabs-nav";
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
import {
  Bell,
  Building2,
  Database,
  Palette,
  Plus,
  ShieldCheck,
  SlidersHorizontal,
  Tags,
  Trash2,
  Wallet,
} from "lucide-react";

type SettingsPageProps = {
  searchParams: Promise<{
    tab?: string;
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
  "company-required-first": "Save Company Information first. The company name and phone are needed before any other section can be stored.",
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

type TabKey =
  | "company"
  | "operations"
  | "payroll"
  | "notifications"
  | "security"
  | "appearance"
  | "catalog"
  | "data";

const tabs: Array<{
  key: TabKey;
  label: string;
  icon: typeof Building2;
  superAdminOnly: boolean;
}> = [
  { key: "company", label: "Company", icon: Building2, superAdminOnly: true },
  { key: "operations", label: "Business Rules", icon: SlidersHorizontal, superAdminOnly: true },
  { key: "payroll", label: "Payroll", icon: Wallet, superAdminOnly: true },
  { key: "notifications", label: "Notifications", icon: Bell, superAdminOnly: true },
  { key: "security", label: "Security", icon: ShieldCheck, superAdminOnly: true },
  { key: "appearance", label: "Appearance", icon: Palette, superAdminOnly: false },
  { key: "catalog", label: "Product Categories", icon: Tags, superAdminOnly: true },
  { key: "data", label: "Data & System", icon: Database, superAdminOnly: true },
];

function Field({
  label,
  name,
  defaultValue,
  type = "text",
  required = false,
  min,
  max,
  step,
  hint,
}: {
  label: string;
  name: string;
  defaultValue?: string | number | null;
  type?: string;
  required?: boolean;
  min?: number;
  max?: number;
  step?: string;
  hint?: string;
}) {
  return (
    <label className="space-y-1.5">
      <span className="block text-xs font-semibold uppercase tracking-wide text-gray-600">
        {label}
        {required ? <span className="ml-1 text-red-600">*</span> : null}
      </span>
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
      {hint ? (
        <span className="block text-xs leading-5 text-gray-500">{hint}</span>
      ) : null}
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
      <span className="block text-xs font-semibold uppercase tracking-wide text-gray-600">{label}</span>
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

/** A labelled group of related fields inside a settings card. */
function FieldGroup({
  title,
  description,
  columns = 3,
  children,
}: {
  title?: string;
  description?: string;
  columns?: 1 | 2 | 3;
  children: ReactNode;
}) {
  const grid =
    columns === 1
      ? "grid gap-4"
      : columns === 2
        ? "grid gap-4 md:grid-cols-2"
        : "grid gap-4 md:grid-cols-2 xl:grid-cols-3";

  return (
    <div className="space-y-3">
      {title ? (
        <div>
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
          {description ? (
            <p className="mt-0.5 text-xs leading-5 text-gray-500">{description}</p>
          ) : null}
        </div>
      ) : null}
      <div className={grid}>{children}</div>
    </div>
  );
}

function SettingsCard({
  title,
  description,
  children,
  tone = "default",
}: {
  title: string;
  description: string;
  children: ReactNode;
  tone?: "default" | "accent";
}) {
  return (
    <Card
      className={
        tone === "accent"
          ? "border-lime-200 bg-lime-50 shadow-sm"
          : "border-gray-200 bg-white shadow-sm"
      }
    >
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">{children}</CardContent>
    </Card>
  );
}

/**
 * One settings section that saves on its own. Only the fields rendered inside
 * are written, so the other tabs are never touched by this save.
 */
function SectionForm({
  section,
  title,
  description,
  submitLabel = "Save changes",
  children,
}: {
  section: SettingsSection;
  title: string;
  description: string;
  submitLabel?: string;
  children: ReactNode;
}) {
  return (
    <form action={updateSettings}>
      <input type="hidden" name="section" value={section} />
      <SettingsCard title={title} description={description}>
        {children}
        <div className="flex justify-end border-t pt-5">
          <SubmitButton size="lg" pendingLabel="Saving">
            {submitLabel}
          </SubmitButton>
        </div>
      </SettingsCard>
    </form>
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
      <SettingsCard title={title} description={description}>
        <FieldGroup>
          <AppearanceFields values={values} />
        </FieldGroup>
        <div className="flex justify-end border-t pt-5">
          <SubmitButton pendingLabel="Saving">{submitLabel}</SubmitButton>
        </div>
      </SettingsCard>
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

  const { tab, appearance, category, error, saved, restored } = await searchParams;
  const visibleTabs = tabs.filter((item) => isSuperAdmin || !item.superAdminOnly);
  const activeTab: TabKey =
    visibleTabs.find((item) => item.key === tab)?.key ?? visibleTabs[0].key;

  const [setting, categories, categoryCounts, myAppearance] = await Promise.all([
    prisma.setting.findFirst({ orderBy: { createdAt: "asc" } }),
    activeTab === "catalog"
      ? prisma.productCategory.findMany({
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        })
      : Promise.resolve([]),
    activeTab === "catalog"
      ? prisma.product.groupBy({ by: ["category"], _count: { _all: true } })
      : Promise.resolve([]),
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
              ? "Company configuration, business rules, notifications, security and appearance. Each section saves on its own."
              : "Your personal appearance settings for the GLV workspace."}
          </p>
        </div>
        <div className="rounded-full border border-lime-200 bg-lime-50 px-4 py-2 text-xs font-semibold text-lime-800">
          {isSuperAdmin ? "Super Admin" : "Personal settings"}
        </div>
      </div>

      <TabsNav
        label="Settings sections"
        activeKey={activeTab}
        items={visibleTabs.map((item) => ({
          key: item.key,
          label: item.label,
          href: `/settings?tab=${item.key}`,
          icon: item.icon,
        }))}
      />


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

      {activeTab === "company" ? (
        <SectionForm
          section="company"
          title="Company Information"
          description="Public company identity used across receipts, exports and operational documents."
        >
          <FieldGroup
            title="Identity"
            description="Shown in the sidebar, on receipts and on generated customer documents."
          >
            <Field label="Company Name" name="companyName" defaultValue={values.companyName} required />
            <Field label="Trading Name" name="tradingName" defaultValue={values.tradingName} hint="Short name used for the sidebar badge." />
            <Field label="Tagline" name="tagline" defaultValue={values.tagline} />
            <Field label="Logo URL" name="logoUrl" defaultValue={values.logoUrl} />
          </FieldGroup>

          <FieldGroup title="Contact" description="How customers and staff reach the business.">
            <Field label="Phone" name="phone" defaultValue={values.phone} required />
            <Field label="WhatsApp" name="whatsapp" defaultValue={values.whatsapp} />
            <Field label="Email" name="email" type="email" defaultValue={values.email} />
            <Field label="Website" name="website" defaultValue={values.website} />
            <Field label="Address" name="address" defaultValue={values.address} />
            <Field label="GPS Address" name="gpsAddress" defaultValue={values.gpsAddress} />
          </FieldGroup>

          <FieldGroup title="Registration" description="Statutory identifiers printed on formal documents.">
            <Field label="Business Registration No." name="businessRegistrationNumber" defaultValue={values.businessRegistrationNumber} />
            <Field label="Tax Identification No." name="taxIdentificationNumber" defaultValue={values.taxIdentificationNumber} />
          </FieldGroup>
        </SectionForm>
      ) : null}

      {activeTab === "operations" ? (
        <SectionForm
          section="operations"
          title="Business Rules"
          description="Layaway defaults, financial controls and the numbering rules used for new records."
        >
          <FieldGroup
            title="Payment plans"
            description="Defaults applied when a new customer account is created."
          >
            <Field label="Installment Duration (days)" name="installmentDurationDays" type="number" min={1} defaultValue={values.installmentDurationDays} required />
            <Field label="Default Daily Collection" name="defaultDailyCollection" type="number" min={0} step="0.01" defaultValue={values.defaultDailyCollection} />
            <Field label="Minimum Deposit" name="minimumDeposit" type="number" min={0} step="0.01" defaultValue={values.minimumDeposit} />
            <Field label="Default Currency" name="defaultCurrency" defaultValue={values.defaultCurrency} hint="Currency code used on receipts and SMS amounts." />
          </FieldGroup>

          <FieldGroup
            title="Fees and deductions"
            description="Percentages applied to administration charges and refunds."
          >
            <Field label="Administration Fee %" name="administrationFeePercent" type="number" min={0} max={100} step="0.01" defaultValue={values.administrationFeePercent} />
            <Field label="Refund Deduction %" name="refundDeductionPercent" type="number" min={0} max={100} step="0.01" defaultValue={values.refundDeductionPercent} />
          </FieldGroup>

          <FieldGroup
            title="Procurement and delivery"
            description="Controls when a product appears on the procurement list."
          >
            <Field
              label="Procurement Threshold %"
              name="procurementThresholdPercent"
              type="number"
              min={0}
              max={100}
              step="0.01"
              defaultValue={values.procurementThresholdPercent}
              hint="Accounts at or above this paid percentage appear on the procurement list."
            />
            <Field label="Delivery Time After Completion (days)" name="deliveryTimeAfterCompletionDays" type="number" min={0} defaultValue={values.deliveryTimeAfterCompletionDays} />
          </FieldGroup>

          <FieldGroup
            title="Payment corrections"
            description="How long a recorded payment stays editable."
          >
            <Field
              label="Payment Edit Window (hours)"
              name="paymentEditWindowHours"
              type="number"
              min={3}
              max={16}
              defaultValue={values.paymentEditWindowHours}
              hint="Between 3 and 16 hours. After this, an admin correction is required."
            />
          </FieldGroup>

          <FieldGroup
            title="Numbering"
            description="Prefixes and code lengths for receipts, customers and staff."
          >
            <Field label="Receipt Prefix" name="receiptPrefix" defaultValue={values.receiptPrefix} />
            <Field label="Customer ID Prefix" name="customerIdPrefix" defaultValue={values.customerIdPrefix} />
            <Field label="Staff Code Length" name="staffCodeLength" type="number" min={2} max={8} defaultValue={values.staffCodeLength} hint="Between 2 and 8 characters." />
          </FieldGroup>
        </SectionForm>
      ) : null}

      {activeTab === "payroll" ? (
        <SectionForm
          section="payroll"
          title="Payroll"
          description="Monthly salary defaults and commission settings for staff."
        >
          <FieldGroup title="Salary" columns={2}>
            <Field label="Default Monthly Salary" name="defaultMonthlySalary" type="number" min={0} step="0.01" defaultValue={values.defaultMonthlySalary} />
            <Field label="Payroll Day" name="payrollDay" type="number" min={1} max={31} defaultValue={values.payrollDay} hint="Day of the month salaries are processed." />
          </FieldGroup>

          <FieldGroup title="Commission" columns={2}>
            <ToggleField
              label="Commission Enabled"
              name="commissionEnabled"
              defaultChecked={values.commissionEnabled}
              description="Stores the company policy for future commission calculations."
            />
            <Field label="Commission Percentage" name="commissionPercentage" type="number" min={0} max={100} step="0.01" defaultValue={values.commissionPercentage} />
          </FieldGroup>
        </SectionForm>
      ) : null}

      {activeTab === "notifications" ? (
        <>
          <SectionForm
            section="notifications"
            title="Notification Channels"
            description="Outbound message channels. These are separate from the in-app sidebar attention badges, and each channel needs its provider configured before anything is delivered."
          >
            <FieldGroup columns={1}>
              <ToggleField
                label="Email Notifications"
                name="emailNotificationsEnabled"
                defaultChecked={values.emailNotificationsEnabled}
                description="Queues customer documents and receipts for email when Resend is configured."
              />
              <ToggleField
                label="SMS Notifications"
                name="smsNotificationsEnabled"
                defaultChecked={values.smsNotificationsEnabled}
                description="Sends salary, welcome, 70% progress, weekly summary and missed-payment alerts through BMS Africa. Customers with no usable phone number are skipped."
              />
              <ToggleField
                label="WhatsApp Notifications"
                name="whatsappRemindersEnabled"
                defaultChecked={values.whatsappRemindersEnabled}
                description="Queues customer notices for WhatsApp when Twilio WhatsApp is configured."
              />
            </FieldGroup>
          </SectionForm>

          <Card className="border-gray-200 bg-white shadow-sm">
            <CardHeader>
              <CardTitle>SMS Console</CardTitle>
              <CardDescription>
                Edit the message templates, review the automatic notification
                rules and monitor the delivery queue.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link href="/settings/sms">Open SMS settings and delivery</Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="border-lime-200 bg-lime-50 shadow-sm">
            <CardHeader>
              <CardTitle>Legal Documents &amp; Customer Messages</CardTitle>
              <CardDescription>
                Edit terms, cancellation and reactivation calculations, receipt
                messages, and review the delivery queue.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link href="/settings/legal">Manage Legal Templates</Link>
              </Button>
            </CardContent>
          </Card>
        </>
      ) : null}

      {activeTab === "security" ? (
        <SectionForm
          section="security"
          title="Security"
          description="Password policy, session limits, two-factor authentication and database access controls."
        >
          <FieldGroup title="Passwords and sessions" columns={2}>
            <Field label="Password Length" name="passwordLength" type="number" min={6} defaultValue={values.passwordLength} hint="Minimum 6 characters." />
            <Field label="Session Timeout (minutes)" name="sessionTimeoutMinutes" type="number" min={5} defaultValue={values.sessionTimeoutMinutes} hint="Minimum 5 minutes." />
          </FieldGroup>

          <FieldGroup title="Access controls" columns={2}>
            <ToggleField
              label="Require Password Change"
              name="requirePasswordChange"
              defaultChecked={values.requirePasswordChange}
              description="Stores the company policy for password reset flows."
            />
            <ToggleField
              label="Two-Factor Authentication"
              name="twoFactorEnabled"
              defaultChecked={values.twoFactorEnabled}
              description="Admin and Super Admin users are forced to enable authenticator-app 2FA."
            />
          </FieldGroup>

          <FieldGroup title="Database access" columns={2}>
            <ToggleField
              label="Backup Database"
              name="backupDatabaseEnabled"
              defaultChecked={values.backupDatabaseEnabled}
              description="Enables the Super Admin backup controls on the Data & System tab."
            />
            <ToggleField
              label="Export Database"
              name="exportDatabaseEnabled"
              defaultChecked={values.exportDatabaseEnabled}
              description="Allows Super Admin database backup downloads."
            />
          </FieldGroup>
        </SectionForm>
      ) : null}

      {activeTab === "appearance" ? (
        <>
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
        </>
      ) : null}

      {activeTab === "catalog" ? (
        <Card className="border-gray-200 bg-white shadow-sm">
          <CardHeader>
            <CardTitle>Product Categories</CardTitle>
            <CardDescription>
              Manage the categories staff select from when creating or editing
              products. Renaming a category updates matching products, and
              deleting one moves matching products to Other.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <form action={createProductCategory} className="flex w-full gap-2 sm:w-auto">
              <Input
                name="name"
                placeholder="New category"
                className="h-10 bg-white sm:w-56"
                required
              />
              <SubmitButton className="gap-2" pendingLabel="Adding">
                <Plus className="size-4" />
                Add
              </SubmitButton>
            </form>

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
                              <SubmitButton variant="outline" size="sm" pendingLabel="Saving">
                                Save
                              </SubmitButton>
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

              {categories.length === 0 ? (
                <div className="border-t p-6 text-center text-sm text-gray-600">
                  No product categories yet. Add the first one above.
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {activeTab === "data" ? (
        <>
          <Card className="border-gray-200 bg-white shadow-sm">
            <CardHeader>
              <CardTitle>Database Backup &amp; Restore</CardTitle>
              <CardDescription>
                Download a JSON backup or restore from a GLV backup file.
                Restore replaces operational data and requires your Super Admin
                password.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-5 lg:grid-cols-2">
              <div className="rounded-lg border bg-gray-50 p-4">
                <h2 className="font-semibold text-gray-950">Backup</h2>
                <p className="mt-1 text-sm text-gray-600">
                  Export the current database data as a JSON backup file.
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <Button asChild>
                    <a href="/api/admin/database-backup" download>
                      Download Backup
                    </a>
                  </Button>
                  <Button asChild variant="outline">
                    <a href="/api/admin/database-backup/latest" download>
                      Download Latest Automatic Backup
                    </a>
                  </Button>
                  <Button asChild variant="outline">
                    <Link href="/settings/import-weekly-report">
                      Import Weekly Report
                    </Link>
                  </Button>
                </div>
                <p className="mt-3 text-xs text-gray-500">
                  Automatic backups run daily at 2:00 AM Ghana time. The two
                  newest encrypted backups are retained, so day three deletes
                  day one.
                </p>
              </div>

              <form
                action={restoreDatabaseBackup}
                encType="multipart/form-data"
                className="space-y-3 rounded-lg border border-red-200 bg-red-50 p-4"
              >
                <div>
                  <h2 className="font-semibold text-red-950">Restore</h2>
                  <p className="mt-1 text-sm leading-6 text-red-800">
                    This replaces the current operational data with the
                    uploaded backup. Use only when you are sure.
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
                <SubmitButton variant="destructive" pendingLabel="Restoring">
                  Restore Backup
                </SubmitButton>
              </form>
            </CardContent>
          </Card>

          <SectionForm
            section="system"
            title="System Notes"
            description="Operator-maintained labels shown for database, storage and restore visibility. These are notes only: editing them does not change the live infrastructure."
          >
            <FieldGroup columns={3}>
              <Field label="Current Version" name="currentVersion" defaultValue={values.currentVersion} />
              <Field label="Database Status" name="databaseStatus" defaultValue={values.databaseStatus} />
              <Field label="Neon Status" name="neonStatus" defaultValue={values.neonStatus} />
              <Field label="Storage Usage" name="storageUsage" defaultValue={values.storageUsage} />
              <Field label="Restore Backup Status" name="restoreBackupStatus" defaultValue={values.restoreBackupStatus} />
            </FieldGroup>
          </SectionForm>
        </>
      ) : null}
    </div>
  );
}
