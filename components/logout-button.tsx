import Link from "next/link";
import { LogOutIcon } from "lucide-react";

export function LogoutButton() {
  return (
    <Link
      href="/api/logout"
      prefetch={false}
      className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border border-white/15 bg-white/5 px-3 text-sm font-medium text-white hover:border-white/25 hover:bg-white/10 md:w-auto"
    >
      <LogOutIcon className="size-4" />
      Logout
    </Link>
  );
}
