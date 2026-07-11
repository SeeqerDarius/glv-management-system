import Link from "next/link";

export default function OfflinePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0d2b18] px-4 py-10 text-white">
      <section className="w-full max-w-md rounded-xl border border-white/10 bg-white/[0.06] p-6 shadow-2xl backdrop-blur">
        <div className="mb-5 inline-flex size-12 items-center justify-center rounded-xl bg-lime-300 text-lg font-black text-green-950">
          GLV
        </div>
        <h1 className="text-2xl font-bold">You are offline</h1>
        <p className="mt-3 text-sm leading-6 text-white/75">
          GLV needs a connection for live customer, account, payment, and report
          data. Check your network and try again.
        </p>
        <Link
          href="/dashboard"
          className="mt-6 inline-flex rounded-lg bg-lime-300 px-4 py-2 text-sm font-semibold text-green-950 hover:bg-lime-200"
        >
          Retry dashboard
        </Link>
      </section>
    </main>
  );
}
