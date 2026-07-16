"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Menu, X } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import type { UserPermission, UserRole } from "@prisma/client";
import { AiSupportChat } from "@/components/ai-support-chat";
import { CalculatorWidget } from "@/components/calculator-widget";
import { DashboardNav } from "@/components/dashboard-nav";
import { LogoutButton } from "@/components/logout-button";

type AttentionMap = Record<
  string,
  {
    count: number;
    label: string;
    href?: string;
  }
>;

const dismissedAttentionStorageKey = "glv-dismissed-attention";
const openedAttentionStorageKey = "glv-opened-attention";

function attentionSignature(key: string, item: AttentionMap[string]) {
  return `${key}|${item.href ?? ""}|${item.count}|${item.label}`;
}

const protectedPrefixes = [
  "/dashboard", "/activity", "/customers", "/accounts", "/payments", "/products",
  "/staff", "/credits", "/reports", "/audit-logs", "/settings", "/profile",
];

const pageTitles: Array<[string, string]> = [
  ["/credits", "Credits & Refunds"], ["/staff/applications", "Credits & Refunds"], ["/customers/new", "Create Customer"],
  ["/accounts/new", "Create Account"], ["/payments/new", "Record Payment"],
  ["/products/new", "Create Product"], ["/staff/new", "Add Staff"],
  ["/profile/approvals", "Profile Approvals"], ["/profile", "My Profile"],
  ["/audit-logs", "Audit Logs"], ["/dashboard", "Dashboard"],
  ["/activity", "Activity"],
  ["/customers", "Customers"], ["/accounts", "Accounts"],
  ["/payments", "Payments"], ["/products", "Products"],
  ["/staff", "Staff"], ["/reports", "Reports"], ["/settings", "Settings"],
];

function Footer() {
  return <footer className="border-t border-gray-200 bg-white px-5 py-4 text-center text-xs text-gray-500">Powered by Rock Frost Group © 2025</footer>;
}

export function AppShell({ children, user, brand }: {
  children: ReactNode;
  user: { name?: string | null; role?: UserRole; permissions: UserPermission[]; staffCode?: string | null; profileImageUrl?: string | null } | null;
  brand?: {
    companyName: string;
    tradingName: string;
    tagline: string;
  };
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [attention, setAttention] = useState<AttentionMap>({});
  const [openedAttention, setOpenedAttention] = useState<{
    count: number;
    label: string;
    pathname: string;
  } | null>(null);
  const [dismissedAttention, setDismissedAttention] = useState<Set<string>>(() => {
    if (typeof window === "undefined") {
      return new Set();
    }

    try {
      const stored = window.localStorage.getItem(dismissedAttentionStorageKey);
      const parsed = stored ? JSON.parse(stored) : [];
      return Array.isArray(parsed)
        ? new Set(parsed.filter((value) => typeof value === "string"))
        : new Set();
    } catch {
      return new Set();
    }
  });
  const isProtected = protectedPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  const isAdmin = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";
  const pageTitle = pageTitles.find(([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`))?.[1] ?? "GLV Management";

  useEffect(() => {
    if (!isProtected || !user) {
      return;
    }

    let active = true;

    fetch("/api/notifications", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { attention?: AttentionMap } | null) => {
        if (active) {
          const nextAttention = data?.attention ?? {};
          setAttention(
            Object.fromEntries(
              Object.entries(nextAttention).filter(
                ([key, item]) =>
                  !dismissedAttention.has(attentionSignature(key, item))
              )
            )
          );
        }
      })
      .catch(() => {
        if (active) {
          setAttention({});
        }
      });

    return () => {
      active = false;
    };
  }, [dismissedAttention, isProtected, pathname, user]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      if (!isProtected) {
        setOpenedAttention(null);
        return;
      }

      try {
        const stored = window.sessionStorage.getItem(openedAttentionStorageKey);
        const parsed = stored ? JSON.parse(stored) : null;
        if (
          parsed &&
          parsed.pathname === pathname &&
          typeof parsed.label === "string" &&
          typeof parsed.count === "number"
        ) {
          setOpenedAttention(parsed);
          return;
        }
      } catch {
        // Ignore malformed session attention state.
      }

      setOpenedAttention(null);
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [isProtected, pathname, searchParams]);

  useEffect(() => {
    if (!isProtected) {
      return;
    }

    const cleanups = new Map<HTMLElement, () => void>();

    function mountTopScrollbars() {
      document
        .querySelectorAll<HTMLElement>(".overflow-x-auto:not(.glv-top-scrollbar)")
        .forEach((scrollArea) => {
          if (scrollArea.dataset.topScrollbarMounted === "true") {
            return;
          }

          if (scrollArea.scrollWidth <= scrollArea.clientWidth) {
            return;
          }

          const topScrollbar = document.createElement("div");
          const topScrollbarInner = document.createElement("div");
          topScrollbar.className = "glv-top-scrollbar";
          topScrollbar.style.overflowX = "auto";
          topScrollbar.style.overflowY = "hidden";
          topScrollbarInner.style.width = `${scrollArea.scrollWidth}px`;
          topScrollbarInner.style.height = "1px";
          topScrollbar.appendChild(topScrollbarInner);
          scrollArea.before(topScrollbar);
          scrollArea.dataset.topScrollbarMounted = "true";

          let syncing = false;
          const syncFromTop = () => {
            if (syncing) return;
            syncing = true;
            scrollArea.scrollLeft = topScrollbar.scrollLeft;
            syncing = false;
          };
          const syncFromBottom = () => {
            if (syncing) return;
            syncing = true;
            topScrollbar.scrollLeft = scrollArea.scrollLeft;
            syncing = false;
          };
          const resizeObserver = new ResizeObserver(() => {
            topScrollbarInner.style.width = `${scrollArea.scrollWidth}px`;
            topScrollbar.hidden = scrollArea.scrollWidth <= scrollArea.clientWidth;
          });

          topScrollbar.addEventListener("scroll", syncFromTop, { passive: true });
          scrollArea.addEventListener("scroll", syncFromBottom, { passive: true });
          resizeObserver.observe(scrollArea);

          cleanups.set(scrollArea, () => {
            topScrollbar.removeEventListener("scroll", syncFromTop);
            scrollArea.removeEventListener("scroll", syncFromBottom);
            resizeObserver.disconnect();
            delete scrollArea.dataset.topScrollbarMounted;
            topScrollbar.remove();
          });
        });
    }

    let frame = window.requestAnimationFrame(mountTopScrollbars);
    const mutationObserver = new MutationObserver(() => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(mountTopScrollbars);
    });
    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });
    window.addEventListener("resize", mountTopScrollbars);

    return () => {
      window.cancelAnimationFrame(frame);
      mutationObserver.disconnect();
      window.removeEventListener("resize", mountTopScrollbars);
      cleanups.forEach((cleanup) => cleanup());
    };
  }, [isProtected, pathname]);

  function dismissAttention(key: string, item?: AttentionMap[string]) {
    if (!item) {
      setMobileOpen(false);
      return;
    }

    const signature = attentionSignature(key, item);
    try {
      const target = new URL(item.href ?? key, window.location.origin);
      window.sessionStorage.setItem(
        openedAttentionStorageKey,
        JSON.stringify({
          count: item.count,
          label: item.label,
          pathname: target.pathname,
        })
      );
    } catch {
      // The navigation itself should not fail if attention marking fails.
    }
    setAttention((current) => {
      const remaining = { ...current };
      delete remaining[key];
      return remaining;
    });
    setDismissedAttention((current) => {
      const next = new Set(current);
      next.add(signature);
      try {
        window.localStorage.setItem(
          dismissedAttentionStorageKey,
          JSON.stringify(Array.from(next))
        );
      } catch {
        // Local dismissal is best effort; the live notification still works.
      }
      return next;
    });
    setMobileOpen(false);
  }

  function clearOpenedAttention() {
    try {
      window.sessionStorage.removeItem(openedAttentionStorageKey);
    } catch {
      // Best effort only.
    }
    setOpenedAttention(null);
  }

  if (!isProtected || !user) {
    return <div className="flex min-h-screen flex-col"><div className="flex-1">{children}</div><Footer /></div>;
  }

  const roleLabel = user.role === "SUPER_ADMIN" ? "Super Admin" : user.role === "ADMIN" ? "Admin" : "Staff";
  const tradingName = brand?.tradingName || "GLV";
  const companyName = brand?.companyName || "God's Love Ventures";
  const tagline = brand?.tagline || "Pay Small. Own Big.";

  return (
    <div className="glv-app-shell min-h-screen bg-gray-50 lg:grid lg:grid-cols-[16.5rem_minmax(0,1fr)]">
      {mobileOpen ? <button type="button" aria-label="Close navigation" className="fixed inset-0 z-40 bg-gray-950/45 backdrop-blur-[1px] lg:hidden" onClick={() => setMobileOpen(false)} /> : null}
      <aside className={`glv-sidebar fixed inset-y-0 left-0 z-50 flex w-[17rem] flex-col text-white transition-transform duration-200 lg:sticky lg:top-0 lg:h-screen lg:w-auto lg:translate-x-0 ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex h-18 items-center justify-between border-b border-white/10 px-5">
          <div className="flex items-center gap-3"><span className="glv-brand-mark">{tradingName.slice(0, 4)}</span><div><p className="text-sm font-bold text-white">{companyName}</p><p className="text-xs text-lime-200">{tagline}</p></div></div>
          <button type="button" onClick={() => setMobileOpen(false)} className="inline-flex size-9 items-center justify-center rounded-md text-white/75 hover:bg-white/10 hover:text-white lg:hidden" aria-label="Close menu"><X className="size-5" /></button>
        </div>
        <DashboardNav
          isAdmin={isAdmin}
          permissions={user.permissions}
          attention={attention}
          onNavigate={dismissAttention}
        />
        <div className="mt-auto border-t border-white/10 p-4"><LogoutButton /></div>
      </aside>

      <div className="flex min-h-screen min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex h-18 items-center justify-between gap-4 border-b border-gray-200 bg-white/95 px-4 backdrop-blur sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button type="button" onClick={() => setMobileOpen(true)} className="inline-flex size-10 shrink-0 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 lg:hidden" aria-label="Open menu"><Menu className="size-5" /></button>
            <div className="min-w-0"><p className="truncate text-lg font-bold text-gray-950">{pageTitle}</p><p className="hidden text-xs text-gray-500 sm:block">GLV Management System</p></div>
          </div>
          <a href="/profile" className="flex min-w-0 items-center gap-3 rounded-md px-2 py-1 text-right hover:bg-gray-50">
            <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full border bg-lime-50 text-sm font-bold text-green-900">
              {user.profileImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.profileImageUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                (user.name || "G").slice(0, 1).toUpperCase()
              )}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-gray-900">{user.name || "GLV User"}</span>
              <span className="flex items-center justify-end gap-2 text-xs text-gray-500">{user.staffCode ? <span className="font-semibold text-green-700">{user.staffCode}</span> : null}{user.staffCode ? <span aria-hidden="true">•</span> : null}<span>{roleLabel}</span></span>
            </span>
          </a>
        </header>
        <main className="glv-main-content min-w-0 flex-1 px-4 py-5 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
          <div className="mx-auto max-w-[90rem]">
            {openedAttention ? (
              <div className="mb-4 flex items-start justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 shadow-sm">
                <div className="flex gap-3">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-amber-400 text-base font-black text-amber-950">
                    !
                  </span>
                  <div>
                    <p className="font-semibold">Attention needed here</p>
                    <p className="mt-0.5 text-amber-900">{openedAttention.label}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={clearOpenedAttention}
                  className="rounded-md px-2 py-1 text-xs font-semibold text-amber-900 hover:bg-amber-100"
                >
                  Clear
                </button>
              </div>
            ) : null}
            {children}
          </div>
        </main>
        <Footer />
      </div>
      {isAdmin ? (
        <AiSupportChat userName={user.name || "GLV User"} roleLabel={roleLabel} />
      ) : null}
      <CalculatorWidget />
    </div>
  );
}
