import { redirect } from "next/navigation";
import { clearAuthCookies } from "@/lib/auth-cookies";

export async function GET() {
  await clearAuthCookies();
  redirect("/login");
}
