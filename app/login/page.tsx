import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#123824] px-4 py-10">
      <div className="w-full max-w-md space-y-5">
        <div className="text-center text-white">
          <span className="glv-brand-mark mx-auto">GLV</span>
          <h1 className="mt-4 text-2xl font-bold text-white">
            God&apos;s Love Ventures
          </h1>
          <p className="mt-1 text-sm text-lime-200">Pay Small. Own Big.</p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
