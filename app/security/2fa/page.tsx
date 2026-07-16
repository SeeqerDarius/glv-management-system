import { redirect } from "next/navigation";
import {
  enableTwoFactor,
  generateTwoFactorSecret,
} from "@/actions/two-factor";
import { Button } from "@/components/ui/button";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdminRole } from "@/lib/roles";
import { ensureSecuritySchema, getTwoFactorState } from "@/lib/security-schema";
import { getTotpUri } from "@/lib/totp";

type TwoFactorPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

export default async function TwoFactorPage({
  searchParams,
}: TwoFactorPageProps) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  if (!isAdminRole(session.user.role)) {
    redirect("/dashboard");
  }

  const { error } = await searchParams;
  await ensureSecuritySchema();
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      email: true,
    },
  });

  if (!user) {
    redirect("/login");
  }

  const twoFactor = await getTwoFactorState(session.user.id);
  const setupUri = twoFactor.secret
    ? getTotpUri({
        accountName: user.email,
        secret: twoFactor.secret,
      })
    : null;

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl items-center px-4 py-10">
      <section className="w-full space-y-6 rounded-xl border bg-white p-6 shadow-sm">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-lime-700">
            Admin Security
          </p>
          <h1 className="mt-2 text-3xl font-bold text-gray-950">
            Two-Factor Authentication
          </h1>
          <p className="mt-2 text-sm leading-6 text-gray-600">
            Admin and Super Admin accounts must use an authenticator app before
            continuing to the system.
          </p>
        </div>

        {twoFactor.enabled ? (
          <div className="rounded-lg border border-lime-200 bg-lime-50 p-4 text-sm text-lime-900">
            2FA is enabled for this account.
          </div>
        ) : null}

        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error === "invalid-code"
              ? "That 2FA code was not valid. Check your authenticator app and try again."
              : "Generate a setup key before entering a 2FA code."}
          </div>
        ) : null}

        {!twoFactor.secret ? (
          <form action={generateTwoFactorSecret}>
            <Button type="submit">Generate 2FA Setup Key</Button>
          </form>
        ) : (
          <div className="space-y-5">
            <div className="rounded-lg border bg-gray-50 p-4">
              <p className="text-sm font-semibold text-gray-900">Setup key</p>
              <p className="mt-2 break-all rounded-md bg-white p-3 font-mono text-sm text-gray-950">
                {twoFactor.secret}
              </p>
              <p className="mt-3 text-xs leading-5 text-gray-600">
                In Google Authenticator, Microsoft Authenticator, 1Password, or
                Authy, choose manual setup and enter this key. If your app
                accepts setup links, use this URI:
              </p>
              <p className="mt-2 break-all rounded-md bg-white p-3 font-mono text-xs text-gray-700">
                {setupUri}
              </p>
            </div>

            <form action={enableTwoFactor} className="grid gap-3 sm:grid-cols-[1fr_auto]">
              <label className="space-y-1.5">
                <span className="text-sm font-medium text-gray-700">
                  Enter 6-digit code
                </span>
                <input
                  name="code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  className="w-full rounded border p-3"
                  required
                />
              </label>
              <div className="flex items-end">
                <Button type="submit" className="w-full sm:w-auto">
                  Enable 2FA
                </Button>
              </div>
            </form>

            <form action={generateTwoFactorSecret}>
              <Button type="submit" variant="outline">
                Generate New Setup Key
              </Button>
            </form>
          </div>
        )}
      </section>
    </main>
  );
}
