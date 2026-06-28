import type { NextAuthConfig } from "next-auth";

const privilegedRoutes = [
  { route: "/staff", permission: "MANAGE_STAFF" },
  { route: "/products", permission: "MANAGE_PRODUCTS" },
  { route: "/reports", permission: "VIEW_REPORTS" },
  { route: "/audit-logs", permission: "VIEW_AUDIT_LOGS" },
] as const;
const staffAllowedRoutes = [
  "/dashboard",
  "/activity",
  "/accounts",
  "/customers",
  "/payments",
  "/change-password",
];

export const authConfig = {
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      const isLoggedIn = Boolean(auth?.user);

      if (
        isLoggedIn &&
        auth?.user?.mustChangePassword === true &&
        pathname !== "/change-password"
      ) {
        return Response.redirect(new URL("/change-password", request.nextUrl));
      }

      if (pathname === "/login" && isLoggedIn) {
        return Response.redirect(new URL("/dashboard", request.nextUrl));
      }

      if (!isLoggedIn) {
        return false;
      }

      const role = auth?.user?.role;
      const mustChangePassword = auth?.user?.mustChangePassword === true;

      if (!mustChangePassword && pathname === "/change-password") {
        return Response.redirect(new URL("/dashboard", request.nextUrl));
      }

      const permissions = Array.isArray(auth?.user?.permissions)
        ? auth.user.permissions
        : [];
      const privilegedRoute = privilegedRoutes.find(({ route }) =>
        pathname.startsWith(route)
      );

      if (
        role === "STAFF" &&
        privilegedRoute &&
        !permissions.includes(privilegedRoute.permission)
      ) {
        return Response.redirect(new URL("/dashboard", request.nextUrl));
      }

      if (
        role !== "STAFF" &&
        role !== "ADMIN" &&
        role !== "SUPER_ADMIN"
      ) {
        return Response.redirect(new URL("/login", request.nextUrl));
      }

      if (
        role === "STAFF" &&
        !staffAllowedRoutes.some((route) => pathname.startsWith(route)) &&
        !privilegedRoute
      ) {
        return Response.redirect(new URL("/dashboard", request.nextUrl));
      }

      return true;
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.permissions = user.permissions ?? [];
        token.staffId = user.staffId;
        token.mustChangePassword = user.mustChangePassword;
      }

      return token;
    },
    session({ session, token }) {
      if (session.user) {
        if (typeof token.id === "string") {
          session.user.id = token.id;
        }

        if (
          token.role === "ADMIN" ||
          token.role === "SUPER_ADMIN" ||
          token.role === "STAFF"
        ) {
          session.user.role = token.role;
        }

        session.user.permissions = Array.isArray(token.permissions)
          ? token.permissions
          : [];

        session.user.staffId =
          typeof token.staffId === "string" ? token.staffId : null;
        session.user.mustChangePassword =
          typeof token.mustChangePassword === "boolean"
            ? token.mustChangePassword
            : undefined;
      }

      return session;
    },
  },
  providers: [],
} satisfies NextAuthConfig;
