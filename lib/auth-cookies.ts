import { cookies } from "next/headers";
import type { NextRequest, NextResponse } from "next/server";

const authCookiePrefixes = [
  "authjs.",
  "__Secure-authjs.",
  "__Host-authjs.",
  "next-auth.",
  "__Secure-next-auth.",
  "__Host-next-auth.",
];

function shouldUseSecureCookie(name: string) {
  return (
    process.env.NODE_ENV === "production" ||
    name.startsWith("__Secure-") ||
    name.startsWith("__Host-")
  );
}

function isAuthCookie(name: string) {
  return authCookiePrefixes.some((prefix) => name.startsWith(prefix));
}

function expiredAuthCookieOptions(name: string) {
  return {
    path: "/",
    httpOnly: true,
    sameSite: "lax" as const,
    secure: shouldUseSecureCookie(name),
    expires: new Date(0),
    maxAge: 0,
  };
}

export async function clearAuthCookies() {
  const cookieStore = await cookies();
  const authCookies = cookieStore
    .getAll()
    .filter((cookie) => isAuthCookie(cookie.name));

  for (const cookie of authCookies) {
    cookieStore.set(cookie.name, "", expiredAuthCookieOptions(cookie.name));
  }
}

export function clearAuthCookiesOnResponse(
  request: NextRequest,
  response: NextResponse
) {
  for (const cookie of request.cookies.getAll()) {
    if (!isAuthCookie(cookie.name)) continue;

    response.cookies.set(
      cookie.name,
      "",
      expiredAuthCookieOptions(cookie.name)
    );
  }

  return response;
}
