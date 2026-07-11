"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { useActionState } from "react";
import { login, type LoginState } from "@/actions/auth";
import { PasswordInput } from "@/components/password-input";

const initialState: LoginState = {};

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, initialState);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvasEl = canvasRef.current;
    const rootEl = rootRef.current;
    if (!canvasEl || !rootEl) return;

    const shouldSkipCanvas = window.matchMedia("(max-width: 640px), (prefers-reduced-motion: reduce)").matches;
    if (shouldSkipCanvas) {
      canvasEl.hidden = true;
      return;
    }

    const canvas = canvasEl;
    const root = rootEl;
    const ctx = canvas.getContext("2d")!;
    let animId: number;
    const mouse = { x: -999, y: -999 };

    type Dot = { x: number; y: number; vx: number; vy: number; r: number; o: number };
    let dots: Dot[] = [];

    function resize() {
      canvas.width = root.offsetWidth;
      canvas.height = root.offsetHeight;
    }

    function initDots() {
      dots = [];
      const n = Math.floor((canvas.width * canvas.height) / 10000);
      for (let i = 0; i < n; i++) {
        dots.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: (Math.random() - 0.5) * 0.25,
          vy: (Math.random() - 0.5) * 0.25,
          r: Math.random() * 1.4 + 0.4,
          o: Math.random() * 0.45 + 0.15,
        });
      }
    }

    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const d of dots) {
        d.x += d.vx;
        d.y += d.vy;
        if (d.x < 0) d.x = canvas.width;
        if (d.x > canvas.width) d.x = 0;
        if (d.y < 0) d.y = canvas.height;
        if (d.y > canvas.height) d.y = 0;
        const dx = d.x - mouse.x;
        const dy = d.y - mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 90) { d.x += (dx / dist); d.y += (dy / dist); }
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(163,230,53,${d.o})`;
        ctx.fill();
      }
      for (let i = 0; i < dots.length; i++) {
        for (let j = i + 1; j < dots.length; j++) {
          const dx = dots[i].x - dots[j].x;
          const dy = dots[i].y - dots[j].y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < 100) {
            ctx.beginPath();
            ctx.moveTo(dots[i].x, dots[i].y);
            ctx.lineTo(dots[j].x, dots[j].y);
            ctx.strokeStyle = `rgba(163,230,53,${0.1 * (1 - d / 100)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }
      animId = requestAnimationFrame(draw);
    }

    function onMouseMove(e: MouseEvent) {
      const rect = canvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
    }
    function onMouseLeave() { mouse.x = -999; mouse.y = -999; }
    function onResize() { resize(); initDots(); }

    resize();
    initDots();
    draw();

    root.addEventListener("mousemove", onMouseMove);
    root.addEventListener("mouseleave", onMouseLeave);
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(animId);
      root.removeEventListener("mousemove", onMouseMove);
      root.removeEventListener("mouseleave", onMouseLeave);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <main
      ref={rootRef}
      className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#07130d] px-4 py-10"
    >
      {/* Particle canvas */}
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />

      {/* Glow orbs */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 h-[280px] w-[500px] -translate-x-1/2 rounded-full opacity-[0.14]"
        style={{ background: "radial-gradient(ellipse,rgba(163,230,53,0.9) 0%,transparent 70%)", filter: "blur(60px)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-0 right-0 h-[220px] w-[220px] rounded-full opacity-[0.09]"
        style={{ background: "radial-gradient(ellipse,#4ade80 0%,transparent 70%)", filter: "blur(60px)" }}
      />

      {/* Grid */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,1) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,1) 1px,transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      {/* Scan line */}
      <div
        aria-hidden
        className="pointer-events-none absolute w-full"
        style={{
          height: 1,
          background: "linear-gradient(90deg,transparent,rgba(163,230,53,0.1),transparent)",
          animation: "glv-login-scan 6s linear infinite",
        }}
      />

      {/* Content */}
      <div
        className="relative z-10 w-full max-w-[390px]"
        style={{ animation: "glv-login-up 0.7s cubic-bezier(0.22,1,0.36,1) both" }}
      >
        {/* Brand */}
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="relative mb-4">
            <div
              className="flex h-[52px] w-[52px] items-center justify-center rounded-[13px] bg-lime-400 text-[15px] font-black tracking-wide text-[#07130d]"
              style={{ boxShadow: "0 0 0 1px rgba(163,230,53,0.3), 0 6px 28px rgba(163,230,53,0.3)" }}
            >
              GLV
            </div>
            <div
              aria-hidden
              className="absolute inset-[-6px] rounded-[18px] border border-lime-400/30"
              style={{ animation: "glv-login-ring 2.6s cubic-bezier(0.22,1,0.36,1) infinite" }}
            />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white" style={{ letterSpacing: "-0.02em" }}>
            Welcome back
          </h1>
          <p className="mt-1 text-[12.5px] text-white/38">
            Sign in to GLV Management System
          </p>
        </div>

        {/* Card */}
        <div
          className="rounded-[18px] px-[1.6rem] py-[1.6rem]"
          style={{
            background: "rgba(255,255,255,0.035)",
            border: "0.5px solid rgba(255,255,255,0.09)",
            boxShadow: "0 24px 64px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.05)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
          }}
        >
          {state.error && (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2.5 text-[12.5px] text-red-300">
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              {state.error}
            </div>
          )}

          <form action={formAction} className="space-y-4">
            <label className="block space-y-1.5">
              <span className="block text-[10.5px] font-semibold uppercase tracking-[0.12em] text-white/38">
                Email address
              </span>
              <input
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="admin@glv.com"
                className="w-full rounded-lg border border-white/12 bg-white/[0.05] px-3.5 py-2.5 text-[13.5px] text-white outline-none transition placeholder:text-white/20 focus:border-lime-400 focus:bg-lime-400/[0.04] focus:ring-2 focus:ring-lime-400/20"
              />
            </label>

            <label className="block space-y-1.5">
              <span className="block text-[10.5px] font-semibold uppercase tracking-[0.12em] text-white/38">
                Password
              </span>
              <PasswordInput
                name="password"
                autoComplete="current-password"
                required
                placeholder="••••••••"
                className="rounded-lg border border-white/12 bg-white/[0.05] py-2.5 pl-3.5 text-[13.5px] text-white outline-none transition placeholder:text-white/20 focus:border-lime-400 focus:bg-lime-400/[0.04] focus:ring-2 focus:ring-lime-400/20"
              />
            </label>

            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="text-white/35">Use your GLV staff or admin account.</span>
              <div className="flex shrink-0 items-center gap-2">
                <Link
                  href="/forgot-password"
                  className="text-lime-400/75 transition hover:text-lime-400 hover:underline"
                >
                  Forgot password?
                </Link>
                <span className="text-white/20">/</span>
                <Link
                  href="/signup"
                  className="text-lime-400/75 transition hover:text-lime-400 hover:underline"
                >
                  Sign up
                </Link>
              </div>
            </div>

            <button
              type="submit"
              disabled={pending}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-lime-400 py-2.5 text-[13.5px] font-bold tracking-wide text-[#07130d] transition hover:brightness-105 active:scale-[0.99] disabled:opacity-65"
              style={{ boxShadow: "0 4px 20px rgba(163,230,53,0.3)" }}
            >
              {pending && (
                <svg className="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden>
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
                </svg>
              )}
              {pending ? "Signing in…" : "Sign in"}
            </button>
          </form>

        </div>
      </div>

      <style>{`
        @keyframes glv-login-up {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes glv-login-ring {
          0%   { transform: scale(1);   opacity: 0.5; }
          100% { transform: scale(1.7); opacity: 0; }
        }
        @keyframes glv-login-scan {
          0%   { top: 0%;   opacity: 0; }
          8%   { opacity: 1; }
          92%  { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
      `}</style>
    </main>
  );
}
