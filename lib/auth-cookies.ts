import { cookies } from "next/headers";

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

export async function clearAuthCookies() {
  const cookieStore = await cookies();
  const authCookies = cookieStore
    .getAll()
    .filter((cookie) =>
      authCookiePrefixes.some((prefix) => cookie.name.startsWith(prefix))
    );

  for (const cookie of authCookies) {
    cookieStore.set(cookie.name, "", {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: shouldUseSecureCookie(cookie.name),
      expires: new Date(0),
      maxAge: 0,
    });
  }
}
