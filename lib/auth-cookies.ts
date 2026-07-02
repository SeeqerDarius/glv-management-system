import { cookies } from "next/headers";

const authCookiePrefixes = [
  "authjs.",
  "__Secure-authjs.",
  "__Host-authjs.",
  "next-auth.",
  "__Secure-next-auth.",
  "__Host-next-auth.",
];

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
      maxAge: 0,
    });
  }
}
