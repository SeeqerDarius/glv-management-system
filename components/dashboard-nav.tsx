"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BriefcaseBusinessIcon,
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
  { href: "/profile", label: "My Profile", icon: UserRoundIcon },
  { href: "/products", label: "Products", icon: PackageIcon, permission: UserPermission.MANAGE_PRODUCTS, adminSection: true },
  { href: "/staff", label: "Staff", icon: UsersIcon, permission: UserPermission.VIEW_STAFF, adminSection: true },
  { href: "/business", label: "Business Management", icon: BriefcaseBusinessIcon, adminOnly: true, adminSection: true },
  {
    href: "/credits",
    label: "Credits & Refunds",
    icon: CircleDollarSignIcon,
    permission: UserPermission.MANAGE_PAYMENTS,
    adminSection: true,
  },
  { href: "/reports", label: "Reports", icon: ChartNoAxesCombinedIcon, permission: UserPermission.VIEW_REPORTS, adminSection: true },
  { href: "/audit-logs", label: "Audit Logs", icon: ScrollTextIcon, permission: UserPermission.VIEW_AUDIT_LOGS, adminSection: true },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
] satisfies Array<{
  href: string;
  label: string;
  icon: typeof HouseIcon;
  permission?: UserPermission;
  adminOnly?: boolean;
  adminSection?: boolean;
}>;

function sidebarRelativeCenter(link: HTMLElement) {
  const rect = link.getBoundingClientRect();
  const sidebarTop = link.closest(".glv-sidebar")?.getBoundingClientRect().top ?? 0;
  return rect.top - sidebarTop + rect.height / 2;
}

export function DashboardNav({
  isAdmin,
  permissions,
  attention,
  onNavigate,
  collapsed = false,
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
  collapsed?: boolean;
}) {
  const pathname = usePathname();
  const [hoverTip, setHoverTip] = useState<{ label: string; top: number } | null>(null);
  const visibleNavigation = navigation.filter(
    (item) => {
      const adminOnly = "adminOnly" in item && item.adminOnly;
      const permission = "permission" in item ? item.permission : undefined;

      return (
        (!adminOnly || isAdmin) &&
        (!permission || isAdmin || permissions.includes(permission))
      );
    }
  );
  const firstAdminHref = visibleNavigation.find((item) => item.adminSection)?.href;

  return (
    <>
    <nav className="flex-1 overflow-y-auto p-3 [overscroll-behavior:contain]">
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
              {firstAdminItem ? (
                <p className={`glv-sidebar-fade mb-2 mt-5 px-3 text-[0.68rem] font-bold uppercase text-lime-200/60 ${collapsed ? "glv-sidebar-fade-hidden" : ""}`}>
                  Administration
                </p>
              ) : null}
              <Link
              href={attentionItem?.href ?? item.href}
              onClick={() => onNavigate?.(item.href, attentionItem)}
              onMouseEnter={(event) => {
                if (!collapsed) return;
                setHoverTip({ label: item.label, top: sidebarRelativeCenter(event.currentTarget) });
              }}
              onMouseLeave={() => setHoverTip(null)}
              onFocus={(event) => {
                if (!collapsed) return;
                setHoverTip({ label: item.label, top: sidebarRelativeCenter(event.currentTarget) });
              }}
              onBlur={() => setHoverTip(null)}
              aria-current={isActive ? "page" : undefined}
              title={collapsed ? item.label : undefined}
              className={cn(
                "glv-nav-link group relative mb-1 flex h-10 items-center gap-3 whitespace-nowrap rounded-md px-3 text-sm font-medium",
                collapsed && "lg:justify-center lg:gap-0 lg:px-0",
                isActive && "glv-nav-link-active"
              )}
            >
              <span className="relative flex shrink-0">
                <Icon className="size-4" />
                {collapsed && attentionCount > 0 ? (
                  <span className="absolute -right-1 -top-1 hidden size-2 rounded-full bg-amber-400 lg:block" />
                ) : null}
              </span>
              <span className={`glv-sidebar-fade min-w-0 flex-1 truncate ${collapsed ? "glv-sidebar-fade-hidden" : ""}`}>{item.label}</span>
              {attentionCount > 0 ? (
                <span
                  title={attentionItem?.label}
                  aria-label={attentionItem?.label}
                  className={`ml-auto inline-flex min-w-5 shrink-0 items-center justify-center rounded-full bg-amber-400 px-1.5 py-0.5 text-[0.68rem] font-bold leading-none text-green-950 ${collapsed ? "lg:hidden" : ""}`}
                >
                  {attentionCount > 99 ? "99+" : attentionCount}
                </span>
              ) : null}
              </Link>
            </div>
          );
        })}
    </nav>
    {collapsed ? (
      <div
        className={cn(
          "glv-sidebar-tooltip pointer-events-none fixed z-50 hidden whitespace-nowrap rounded-md bg-gray-900 px-2.5 py-1.5 text-xs font-semibold text-white opacity-0 shadow-lg lg:block",
          hoverTip && "opacity-100"
        )}
        style={{
          top: hoverTip?.top ?? 0,
          left: "5.25rem",
          marginLeft: "0.75rem",
          transform: hoverTip ? "translate(0, -50%)" : "translate(-4px, -50%)",
        }}
      >
        {hoverTip?.label}
      </div>
    ) : null}
    </>
  );
}
