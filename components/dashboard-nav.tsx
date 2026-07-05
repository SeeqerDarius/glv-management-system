"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChartNoAxesCombinedIcon,
  ChartSplineIcon,
  CircleDollarSignIcon,
  HandCoinsIcon,
  HouseIcon,
  PackageIcon,
  ScrollTextIcon,
  SettingsIcon,
  UserRoundIcon,
  UsersIcon,
  WalletCardsIcon,
} from "lucide-react";
import { UserPermission } from "@prisma/client";
import { cn } from "@/lib/utils";

const navigation = [
  { href: "/dashboard", label: "Dashboard", icon: HouseIcon },
  { href: "/activity", label: "Activity", icon: ChartSplineIcon },
  { href: "/customers", label: "Customers", icon: UserRoundIcon },
  { href: "/accounts", label: "Accounts", icon: WalletCardsIcon },
  { href: "/payments", label: "Payments", icon: HandCoinsIcon },
  { href: "/products", label: "Products", icon: PackageIcon, permission: UserPermission.MANAGE_PRODUCTS, adminSection: true },
  { href: "/staff", label: "Staff", icon: UsersIcon, permission: UserPermission.MANAGE_STAFF, adminSection: true },
  {
    href: "/credits",
    label: "Credits & Refunds",
    icon: CircleDollarSignIcon,
    permission: UserPermission.MANAGE_PAYMENTS,
    adminSection: true,
  },
  { href: "/reports", label: "Reports", icon: ChartNoAxesCombinedIcon, permission: UserPermission.VIEW_REPORTS, adminSection: true },
  { href: "/audit-logs", label: "Audit Logs", icon: ScrollTextIcon, permission: UserPermission.VIEW_AUDIT_LOGS, adminSection: true },
  { href: "/settings", label: "Settings", icon: SettingsIcon, adminOnly: true, adminSection: true },
] satisfies Array<{
  href: string;
  label: string;
  icon: typeof HouseIcon;
  permission?: UserPermission;
  adminOnly?: boolean;
  adminSection?: boolean;
}>;

export function DashboardNav({
  isAdmin,
  permissions,
  attention,
  onNavigate,
}: {
  isAdmin: boolean;
  permissions: UserPermission[];
  attention?: Record<
    string,
    {
      count: number;
      label: string;
      href?: string;
    }
  >;
  onNavigate?: (
    href: string,
    attentionItem?: {
      count: number;
      label: string;
      href?: string;
    }
  ) => void;
}) {
  const pathname = usePathname();
  const visibleNavigation = navigation.filter(
    (item) =>
      (!item.adminOnly || isAdmin) &&
      (!item.permission || isAdmin || permissions.includes(item.permission))
  );
  const firstAdminHref = visibleNavigation.find((item) => item.adminSection)?.href;

  return (
    <nav className="flex-1 overflow-y-auto p-3">
      {visibleNavigation.map((item) => {
          const isActive =
            item.href === "/dashboard"
              ? pathname === item.href
              : item.href === "/staff"
                ? pathname === item.href || (pathname.startsWith("/staff/") && !pathname.startsWith("/staff/applications"))
                : pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;

          const firstAdminItem = item.href === firstAdminHref;
          const attentionItem = attention?.[item.href];
          const attentionCount = attentionItem?.count ?? 0;

          return (
            <div key={item.href}>
              {firstAdminItem ? <p className="mb-2 mt-5 px-3 text-[0.68rem] font-bold uppercase text-lime-200/60">Administration</p> : null}
              <Link
              href={attentionItem?.href ?? item.href}
              onClick={() => onNavigate?.(item.href, attentionItem)}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "glv-nav-link mb-1 flex h-10 items-center gap-3 whitespace-nowrap rounded-md px-3 text-sm font-medium",
                isActive && "glv-nav-link-active"
              )}
            >
              <Icon className="size-4" />
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
              {attentionCount > 0 ? (
                <span
                  title={attentionItem?.label}
                  aria-label={attentionItem?.label}
                  className="ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-amber-400 px-1.5 py-0.5 text-[0.68rem] font-bold leading-none text-green-950"
                >
                  {attentionCount > 99 ? "99+" : attentionCount}
                </span>
              ) : null}
              </Link>
            </div>
          );
        })}
    </nav>
  );
}
