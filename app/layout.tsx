import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppShell } from "@/components/app-shell";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
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
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();
  const staff = session?.user?.staffId
    ? await prisma.staff.findUnique({ where: { id: session.user.staffId }, select: { code: true } })
    : null;
  const shellUser = session?.user?.role
    ? { name: session.user.name, role: session.user.role, permissions: session.user.permissions ?? [], staffCode: staff?.code ?? null }
    : null;

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full"><AppShell user={shellUser}>{children}</AppShell></body>
    </html>
  );
}
