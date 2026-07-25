import Link from "next/link";
import { redirect } from "next/navigation";
import { WeeklyReportImporter } from "@/components/weekly-report-importer";
import { Button } from "@/components/ui/button";
import { auth } from "@/lib/auth";
import { isSuperAdminRole } from "@/lib/roles";

export default async function ImportWeeklyReportPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!isSuperAdminRole(session.user.role)) redirect("/dashboard");

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8 sm:px-6">
      <div>
        <Button asChild variant="outline" size="sm">
          <Link href="/settings">Back to settings</Link>
        </Button>
        <p className="mt-6 text-xs font-semibold uppercase tracking-wide text-lime-700">
          Super Admin Recovery
        </p>
        <h1 className="mt-2 text-3xl font-bold text-gray-950">
          Import Weekly Report
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-600">
          Preview the exported Excel report, connect its old staff codes to the
          staff you recreated, then recover the data in one database transaction.
          If any part fails, none of the import is saved.
        </p>
      </div>
      <WeeklyReportImporter />
    </main>
  );
}
