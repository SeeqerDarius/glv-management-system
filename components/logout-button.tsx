import { LogOutIcon } from "lucide-react";
import { logout } from "@/actions/auth";

export function LogoutButton() {
  return (
    <form action={logout}>
      <button
        type="submit"
        className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-white/20 px-3 py-2 text-sm font-medium text-white hover:bg-white/10 md:w-auto"
      >
        <LogOutIcon className="size-4" />
        Logout
      </button>
    </form>
  );
}
