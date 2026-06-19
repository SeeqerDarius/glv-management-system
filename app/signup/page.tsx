import Link from "next/link";
import { SignupForm } from "@/components/signup-form";

export default function SignupPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md space-y-4">
        <SignupForm />
        <p className="text-center text-sm text-gray-600">
          Already approved?{" "}
          <Link href="/login" className="font-medium text-green-700">
            Login
          </Link>
        </p>
      </div>
    </main>
  );
}
