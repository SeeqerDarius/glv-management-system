import { ChangePasswordForm } from "@/components/change-password-form";

export default async function ChangePasswordPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
  }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <ChangePasswordForm error={error} />
    </main>
  );
}
