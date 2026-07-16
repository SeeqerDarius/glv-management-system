import type { Metadata, Viewport } from "next";
import type { CSSProperties } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import { AppShell } from "@/components/app-shell";
import { PwaRegister } from "@/components/pwa-register";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { touchUserPresence } from "@/lib/presence";
import { fallbackSettings, getAppearanceSettings, getSettings } from "@/lib/settings";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "GLV Management System",
  description: "God's Love Ventures installment and layaway management system.",
  applicationName: "GLV",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "GLV",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#0d2b18",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

function normalizeTheme(theme: string | null | undefined) {
  if (theme === "dark" || theme === "system") {
    return theme;
  }

  return "light";
}

function normalizeColor(color: string | null | undefined, fallback: string) {
  return /^#[0-9a-f]{6}$/i.test(color ?? "") ? color : fallback;
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();
  const staff = session?.user?.staffId
    ? await prisma.staff.findUnique({
        where: { id: session.user.staffId },
        select: {
          code: true,
          user: {
            select: {
              id: true,
              lastSeenAt: true,
            },
          },
        },
      })
    : null;

  if (staff?.user) {
    await touchUserPresence(staff.user.id, staff.user.lastSeenAt);
  }

  const [settings, appearance] = session?.user
    ? await Promise.all([
        getSettings().catch(() => fallbackSettings),
        getAppearanceSettings(session.user.id).catch(() => fallbackSettings),
      ])
    : [fallbackSettings, fallbackSettings];
  const theme = normalizeTheme(appearance.theme);
  const primaryColor = normalizeColor(
    appearance.primaryColor,
    fallbackSettings.primaryColor
  );
  const secondaryColor = normalizeColor(
    appearance.secondaryColor,
    fallbackSettings.secondaryColor
  );
  const themeStyle = {
    "--glv-primary": primaryColor,
    "--glv-secondary": secondaryColor,
    "--primary": primaryColor,
    "--ring": primaryColor,
  } as CSSProperties;
  const shellUser = session?.user?.role
    ? { name: session.user.name, role: session.user.role, permissions: session.user.permissions ?? [], staffCode: staff?.code ?? null }
    : null;

  return (
    <html
      lang="en"
      data-theme={theme}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      style={themeStyle}
    >
      <body className="min-h-full">
        <PwaRegister />
        <AppShell
          user={shellUser}
          brand={{
            companyName: settings.companyName,
            tradingName: settings.tradingName ?? "GLV",
            tagline: settings.tagline,
          }}
        >
          {children}
        </AppShell>
      </body>
    </html>
  );
}
