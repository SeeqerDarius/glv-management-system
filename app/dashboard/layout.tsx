// app/(dashboard)/layout.tsx
// Passthrough — the AppShell in root layout handles sidebar + header.
// Add any dashboard-specific providers here if needed.

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}