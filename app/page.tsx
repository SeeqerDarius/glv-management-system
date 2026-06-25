import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden bg-[#0d2b18]">

      {/* Background radial glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(184,237,78,0.13) 0%, transparent 70%), radial-gradient(ellipse 60% 40% at 80% 100%, rgba(184,237,78,0.07) 0%, transparent 70%)",
        }}
      />

      {/* Subtle grid overlay */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage:
            "linear-gradient(rgb(255 255 255 / 1) 1px, transparent 1px), linear-gradient(90deg, rgb(255 255 255 / 1) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      {/* Card */}
      <div
        className="relative z-10 flex flex-col items-center text-center px-8 py-14 rounded-3xl mx-4 max-w-md w-full"
        style={{
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 32px 80px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          animation: "glv-slide-up 600ms cubic-bezier(0.22, 1, 0.36, 1) both",
        }}
      >
        {/* Brand mark */}
        <div
          className="glv-brand-mark mb-6"
          style={{ width: "3.5rem", height: "3.5rem", fontSize: "1rem" }}
          aria-hidden
        >
          GLV
        </div>

        {/* Eyebrow */}
        <p
          className="text-xs font-bold tracking-[0.18em] uppercase mb-3"
          style={{ color: "rgba(184,237,78,0.7)" }}
        >
          God&apos;s Love Ventures
        </p>

        {/* Headline */}
        <h1
          className="text-3xl sm:text-4xl font-black leading-tight mb-3"
          style={{
            color: "#ffffff",
            letterSpacing: "-0.03em",
          }}
        >
          Micro Installment
          <br />
          <span style={{ color: "#b8ed4e" }}>Asset Management</span>
        </h1>

        {/* Sub */}
        <p
          className="text-sm leading-relaxed mb-10 max-w-xs"
          style={{ color: "rgba(255,255,255,0.45)" }}
        >
          A unified platform for managing layaway plans, customer accounts, and
          staff operations — all in one place.
        </p>

        {/* CTA */}
        <Link
          href="/login"
          className="glv-btn-primary w-full justify-center text-base py-3 rounded-xl"
          style={{ fontSize: "0.9375rem" }}
        >
          Sign in to continue
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden
          >
            <path
              d="M3 8h10M9 4l4 4-4 4"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </Link>
      </div>

      {/* Footer */}
      <p
        className="relative z-10 mt-8 text-xs"
        style={{ color: "rgba(255,255,255,0.22)", letterSpacing: "0.01em" }}
      >
        Powered by{" "}
        <span style={{ color: "rgba(184,237,78,0.45)", fontWeight: 600 }}>
          Rock Frost Group
        </span>{" "}
        © 2025
      </p>
    </main>
  );
}