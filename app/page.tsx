import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-5xl font-bold text-green-700">
          GOD&apos;S LOVE VENTURES
        </h1>

        <p className="mt-4 text-gray-600">
          Micro Installment Asset Management System
        </p>

        <div className="mt-8">
          <Link
            href="/login"
            className="bg-green-600 text-white px-6 py-3 rounded-lg"
          >
            Login
          </Link>
        </div>
      </div>
    </main>
  );
}
