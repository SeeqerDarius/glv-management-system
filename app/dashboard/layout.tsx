import Link from "next/link";
import { HouseIcon } from "lucide-react";
import { auth } from "@/lib/auth";
import { DashboardNav } from "@/components/dashboard-nav";
import { LogoutButton } from "@/components/logout-button";
import { isAdminRole } from "@/lib/roles";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const isAdmin = isAdminRole(session?.user?.role);

  return (
    <div className="glv-app-shell min-h-screen lg:flex">
      <aside className="glv-sidebar relative z-20 text-white lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-72 lg:flex-col">
        <div className="flex items-center justify-between gap-3 border-b border-white/10 p-4 lg:p-5">
          <div className="flex items-center gap-3">
            <span className="glv-brand-mark">GLV</span>
            <div>
              <h2 className="text-base font-bold text-white">Management System</h2>
              <p className="text-xs text-lime-200">Pay Small. Own Big.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 lg:hidden">
            <Link
              href="/dashboard"
              className="inline-flex size-9 items-center justify-center rounded-md border border-white/15 text-lime-100 hover:bg-white/10"
              title="Dashboard"
            >
              <HouseIcon className="size-4" />
              <span className="sr-only">Dashboard/Home</span>
            </Link>
            <LogoutButton />
          </div>
        </div>

        <DashboardNav isAdmin={isAdmin} />

        <div className="mt-auto hidden border-t border-white/10 p-4 lg:block">
          <div className="mb-3 rounded-md border border-white/10 bg-white/5 p-3">
            <p className="truncate text-sm font-medium text-white">
            {session?.user?.name}
            </p>
            <span className="mt-0.5 block text-xs text-lime-300">
              {session?.user?.role}
            </span>
          </div>
          <LogoutButton />
        </div>
      </aside>

      <main className="glv-main-content min-w-0 flex-1 p-4 sm:p-6 lg:p-8 xl:p-10">
        <div className="mx-auto max-w-7xl">{children}</div>
      </main>
    </div>
  );
}
