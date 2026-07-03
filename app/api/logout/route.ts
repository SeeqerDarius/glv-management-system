import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { clearAuthCookies } from "@/lib/auth-cookies";
import { markUserOffline } from "@/lib/presence";

export async function GET() {
  const session = await auth();

  if (session?.user?.id) {
    await markUserOffline(session.user.id);
  }

  await clearAuthCookies();
  redirect("/login");
}
