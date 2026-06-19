"use client";

import { useState, type ReactNode } from "react";
import { Menu, X } from "lucide-react";
import { usePathname } from "next/navigation";
import type { UserPermission, UserRole } from "@prisma/client";
import { DashboardNav } from "@/components/dashboard-nav";
import { LogoutButton } from "@/components/logout-button";

const protectedPrefixes = [
  "/dashboard", "/customers", "/accounts", "/payments", "/products",
  "/staff", "/reports", "/audit-logs", "/settings",
];

const pageTitles: Array<[string, string]> = [
  ["/staff/applications", "Staff Applications"], ["/customers/new", "Create Customer"],
  ["/accounts/new", "Create Account"], ["/payments/new", "Record Payment"],
  ["/products/new", "Create Product"], ["/staff/new", "Add Staff"],
  ["/audit-logs", "Audit Logs"], ["/dashboard", "Dashboard"],
  ["/customers", "Customers"], ["/accounts", "Accounts"],
  ["/payments", "Payments"], ["/products", "Products"],
  ["/staff", "Staff"], ["/reports", "Reports"], ["/settings", "Settings"],
];

function Footer() {
  return <footer className="border-t border-gray-200 bg-white px-5 py-4 text-center text-xs text-gray-500">Powered by Rock Frost Group © 2025</footer>;
}

export function AppShell({ children, user }: {
  children: ReactNode;
  user: { name?: string | null; role?: UserRole; permissions: UserPermission[]; staffCode?: string | null } | null;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const isProtected = protectedPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  const isAdmin = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";
  const pageTitle = pageTitles.find(([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`))?.[1] ?? "GLV Management";

  if (!isProtected || !user) {
    return <div className="flex min-h-screen flex-col"><div className="flex-1">{children}</div><Footer /></div>;
  }

  const roleLabel = user.role === "SUPER_ADMIN" ? "Super Admin" : user.role === "ADMIN" ? "Admin" : "Staff";

  return (
    <div className="glv-app-shell min-h-screen bg-gray-50 lg:grid lg:grid-cols-[16.5rem_minmax(0,1fr)]">
      {mobileOpen ? <button type="button" aria-label="Close navigation" className="fixed inset-0 z-40 bg-gray-950/45 backdrop-blur-[1px] lg:hidden" onClick={() => setMobileOpen(false)} /> : null}
      <aside className={`glv-sidebar fixed inset-y-0 left-0 z-50 flex w-[17rem] flex-col text-white transition-transform duration-200 lg:sticky lg:top-0 lg:h-screen lg:w-auto lg:translate-x-0 ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex h-18 items-center justify-between border-b border-white/10 px-5">
          <div className="flex items-center gap-3"><span className="glv-brand-mark">GLV</span><div><p className="text-sm font-bold text-white">God&apos;s Love Ventures</p><p className="text-xs text-lime-200">Pay Small. Own Big.</p></div></div>
          <button type="button" onClick={() => setMobileOpen(false)} className="inline-flex size-9 items-center justify-center rounded-md text-white/75 hover:bg-white/10 hover:text-white lg:hidden" aria-label="Close menu"><X className="size-5" /></button>
        </div>
        <DashboardNav isAdmin={isAdmin} permissions={user.permissions} onNavigate={() => setMobileOpen(false)} />
        <div className="mt-auto border-t border-white/10 p-4"><LogoutButton /></div>
      </aside>

      <div className="flex min-h-screen min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex h-18 items-center justify-between gap-4 border-b border-gray-200 bg-white/95 px-4 backdrop-blur sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button type="button" onClick={() => setMobileOpen(true)} className="inline-flex size-10 shrink-0 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 lg:hidden" aria-label="Open menu"><Menu className="size-5" /></button>
            <div className="min-w-0"><p className="truncate text-lg font-bold text-gray-950">{pageTitle}</p><p className="hidden text-xs text-gray-500 sm:block">GLV Management System</p></div>
          </div>
          <div className="min-w-0 text-right"><p className="truncate text-sm font-semibold text-gray-900">{user.name || "GLV User"}</p><div className="flex items-center justify-end gap-2 text-xs text-gray-500">{user.staffCode ? <span className="font-semibold text-green-700">{user.staffCode}</span> : null}{user.staffCode ? <span aria-hidden="true">•</span> : null}<span>{roleLabel}</span></div></div>
        </header>
        <main className="glv-main-content min-w-0 flex-1 px-4 py-5 sm:px-6 sm:py-7 lg:px-8 lg:py-8"><div className="mx-auto max-w-[90rem]">{children}</div></main>
        <Footer />
      </div>
    </div>
  );
}
