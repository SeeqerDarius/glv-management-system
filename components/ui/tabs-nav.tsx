import Link from "next/link";
import type { LucideIcon } from "lucide-react";

export type TabsNavItem = {
  key: string;
  label: string;
  href: string;
  icon?: LucideIcon;
  /** Optional trailing count, for example the number of items on that tab. */
  badge?: number;
};

type TabsNavProps = {
  items: TabsNavItem[];
  activeKey: string;
  /** Names the tab set for screen readers, e.g. "Settings sections". */
  label: string;
};

/**
 * Link-driven tabs shared by every tabbed page, so Settings and Products read
 * as the same control instead of each inventing its own filled-pill style.
 *
 * The active tab is marked with an underline rather than a solid dark fill: a
 * filled pill competes with the page's primary buttons, while an underline is
 * the conventional signal for "which view am I in" and keeps the row quiet on a
 * dense operational screen.
 *
 * The row scrolls horizontally when the tabs outgrow the viewport, which is the
 * normal case on a phone.
 */
export function TabsNav({ items, activeKey, label }: TabsNavProps) {
  if (items.length < 2) {
    return null;
  }

  return (
    <nav aria-label={label} className="border-b border-gray-200">
      <ul className="glv-tabs -mb-px flex min-w-full gap-1 overflow-x-auto">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = item.key === activeKey;

          return (
            <li key={item.key} className="shrink-0">
              <Link
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={`group/tab inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "border-green-800 text-green-900"
                    : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-900"
                }`}
              >
                {Icon ? (
                  <Icon
                    className={`size-4 transition-colors ${
                      isActive ? "text-green-700" : "text-gray-400 group-hover/tab:text-gray-600"
                    }`}
                  />
                ) : null}
                {item.label}
                {typeof item.badge === "number" ? (
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums transition-colors ${
                      isActive
                        ? "bg-lime-100 text-green-900"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {item.badge}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
