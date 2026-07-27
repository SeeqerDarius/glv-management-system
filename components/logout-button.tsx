import Link from "next/link";
import { LogOutIcon } from "lucide-react";

export function LogoutButton({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <Link
      href="/api/logout"
      prefetch={false}
      title={collapsed ? "Logout" : undefined}
      className={`inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border border-white/15 bg-white/5 px-3 text-sm font-medium text-white hover:border-white/25 hover:bg-white/10 md:w-auto ${collapsed ? "lg:w-9 lg:px-0" : ""}`}
    >
      <LogOutIcon className="size-4 shrink-0" />
      <span className={`glv-sidebar-fade ${collapsed ? "glv-sidebar-fade-hidden" : ""}`}>Logout</span>
    </Link>
  );
}
