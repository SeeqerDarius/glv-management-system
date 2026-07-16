import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

const { auth } = NextAuth(authConfig);

export function proxy(request: Parameters<typeof auth>[0]) {
  return auth(request);
}

export const config = {
  matcher: [
    "/login",
    "/change-password",
    "/dashboard/:path*",
    "/activity/:path*",
    "/accounts/:path*",
    "/staff/:path*",
    "/customers/:path*",
    "/products/:path*",
    "/payments/:path*",
    "/credits/:path*",
    "/reports/:path*",
    "/audit-logs/:path*",
    "/profile",
    "/profile/:path*",
    "/settings",
    "/settings/:path*",
  ],
};
