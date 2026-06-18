import Link from "next/link";
import { UserRole } from "@prisma/client";
import { auth } from "@/lib/auth";
import { LogoutButton } from "@/components/logout-button";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const isAdmin = session?.user?.role === UserRole.ADMIN;

  return (
    <div className="min-h-screen bg-gray-50 lg:flex">
      <aside className="bg-green-800 text-white lg:sticky lg:top-0 lg:h-screen lg:w-72">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 p-4 lg:block lg:p-5">
          <div>
            <h2 className="text-xl font-bold tracking-wide">GLV SYSTEM</h2>
            <p className="text-sm text-lime-200">Pay Small. Own Big.</p>
          </div>
          <div className="lg:hidden">
            <LogoutButton />
          </div>
        </div>

        <nav className="flex gap-2 overflow-x-auto p-3 lg:block lg:space-y-2 lg:overflow-visible lg:p-5">
          <Link
            href="/dashboard"
            className="block whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium hover:bg-lime-500/20"
          >
            Dashboard
          </Link>

          {isAdmin ? (
            <Link
              href="/staff"
              className="block whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium hover:bg-lime-500/20"
            >
              Staff
            </Link>
          ) : null}

          <Link
            href="/customers"
            className="block whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium hover:bg-lime-500/20"
          >
            Customers
          </Link>

          <Link
            href="/accounts"
            className="block whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium hover:bg-lime-500/20"
          >
            Accounts
          </Link>

          {isAdmin ? (
            <Link
              href="/products"
              className="block whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium hover:bg-lime-500/20"
            >
              Products
            </Link>
          ) : null}

          <Link
            href="/payments"
            className="block whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium hover:bg-lime-500/20"
          >
            Payments
          </Link>

          {isAdmin ? (
            <Link
              href="/reports"
              className="block whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium hover:bg-lime-500/20"
            >
              Reports
            </Link>
          ) : null}

          {isAdmin ? (
            <Link
              href="/audit-logs"
              className="block whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium hover:bg-lime-500/20"
            >
              Audit Logs
            </Link>
          ) : null}
        </nav>

        <div className="hidden border-t border-white/10 p-5 lg:block">
          <p className="mb-3 text-sm text-lime-100">
            {session?.user?.name}
            <span className="block text-xs text-lime-300">
              {session?.user?.role}
            </span>
          </p>
          <LogoutButton />
        </div>
      </aside>

      <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-7xl">{children}</div>
      </main>
    </div>
  );
}
