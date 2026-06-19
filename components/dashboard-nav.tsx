"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChartNoAxesCombinedIcon,
  HandCoinsIcon,
  HouseIcon,
  PackageIcon,
  ScrollTextIcon,
  UserCheckIcon,
  UserRoundIcon,
  UsersIcon,
  WalletCardsIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navigation = [
  { href: "/dashboard", label: "Dashboard", icon: HouseIcon, adminOnly: false },
  { href: "/staff", label: "Staff", icon: UsersIcon, adminOnly: true },
  { href: "/customers", label: "Customers", icon: UserRoundIcon, adminOnly: false },
  { href: "/accounts", label: "Accounts", icon: WalletCardsIcon, adminOnly: false },
  { href: "/products", label: "Products", icon: PackageIcon, adminOnly: true },
  { href: "/payments", label: "Payments", icon: HandCoinsIcon, adminOnly: false },
  { href: "/reports", label: "Reports", icon: ChartNoAxesCombinedIcon, adminOnly: true },
  { href: "/audit-logs", label: "Audit Logs", icon: ScrollTextIcon, adminOnly: true },
  {
    href: "/staff/applications",
    label: "Applications",
    icon: UserCheckIcon,
    adminOnly: true,
  },
];

export function DashboardNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();

  return (
    <nav className="flex gap-2 overflow-x-auto p-3 lg:block lg:space-y-1.5 lg:overflow-visible lg:p-4">
      {navigation
        .filter((item) => !item.adminOnly || isAdmin)
        .map((item) => {
          const isActive =
            item.href === "/dashboard"
              ? pathname === item.href
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "glv-nav-link flex h-10 shrink-0 items-center gap-2.5 whitespace-nowrap rounded-md px-3 text-sm font-medium",
                isActive && "glv-nav-link-active"
              )}
            >
              <Icon className="size-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}
    </nav>
  );
}
