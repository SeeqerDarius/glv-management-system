"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvasEl = canvasRef.current;
    const rootEl = rootRef.current;
    if (!canvasEl || !rootEl) return;

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
      const n = Math.floor((canvas.width * canvas.height) / 9000);
      for (let i = 0; i < n; i++) {
        dots.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: (Math.random() - 0.5) * 0.3,
          vy: (Math.random() - 0.5) * 0.3,
          r: Math.random() * 1.5 + 0.5,
          o: Math.random() * 0.5 + 0.2,
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
        if (dist < 80) { d.x += (dx / dist) * 1.2; d.y += (dy / dist) * 1.2; }
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(184,237,78,${d.o})`;
        ctx.fill();
      }
      for (let i = 0; i < dots.length; i++) {
        for (let j = i + 1; j < dots.length; j++) {
          const dx = dots[i].x - dots[j].x;
          const dy = dots[i].y - dots[j].y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < 110) {
            ctx.beginPath();
            ctx.moveTo(dots[i].x, dots[i].y);
            ctx.lineTo(dots[j].x, dots[j].y);
            ctx.strokeStyle = `rgba(184,237,78,${0.12 * (1 - d / 110)})`;
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
      className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#0a1f10] px-4 py-12"
    >
      {/* Particle canvas */}
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />

      {/* Glow orbs */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 h-[320px] w-[520px] -translate-x-1/2 rounded-full opacity-[0.18]"
        style={{ background: "radial-gradient(ellipse,#b8ed4e 0%,transparent 70%)", filter: "blur(80px)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 bottom-0 h-[280px] w-[280px] rounded-full opacity-[0.14]"
        style={{ background: "radial-gradient(ellipse,#4ade80 0%,transparent 70%)", filter: "blur(80px)" }}
      />

      {/* Grid */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.028]"
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
          background: "linear-gradient(90deg,transparent,rgba(184,237,78,0.12),transparent)",
          animation: "glv-scan 6s linear infinite",
        }}
      />

      {/* Card */}
      <div
        className="relative z-10 flex w-full max-w-sm flex-col items-center px-8 py-12 text-center"
        style={{ animation: "glv-slide-up 0.7s cubic-bezier(0.22,1,0.36,1) both" }}
      >
        {/* Brand mark */}
        <div className="relative mb-5">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-[14px] bg-lime-400 text-base font-black tracking-wide text-[#0a1f10]"
            style={{ boxShadow: "0 0 0 1px rgba(184,237,78,0.3), 0 8px 32px rgba(184,237,78,0.3)" }}
          >
            GLV
          </div>
          {/* Pulse ring */}
          <div
            aria-hidden
            className="absolute inset-0 rounded-[14px] border border-lime-400/40"
            style={{ animation: "glv-pulse-ring 2.4s cubic-bezier(0.22,1,0.36,1) infinite" }}
          />
        </div>

        <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-lime-400/65">
          God&apos;s Love Ventures
        </p>

        <h1
          className="mb-3 text-4xl font-black leading-tight tracking-tight text-white"
          style={{ letterSpacing: "-0.03em" }}
        >
          Micro Installment
          <br />
          <span className="text-lime-400">Asset Management</span>
        </h1>

        <p className="mb-8 max-w-[280px] text-sm leading-relaxed text-white/42">
          A unified platform for managing layaway plans, customer accounts, and
          staff operations — all in one place.
        </p>

        <Link
          href="/login"
          className="group flex w-full items-center justify-center gap-2 rounded-xl bg-lime-400 py-3 text-[15px] font-bold text-[#0a1f10] transition-all duration-200 hover:brightness-105"
          style={{ boxShadow: "0 4px 24px rgba(184,237,78,0.35), 0 1px 0 rgba(255,255,255,0.2) inset" }}
        >
          Sign in to continue
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden
            className="transition-transform duration-200 group-hover:translate-x-1"
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

      <p
        className="relative z-10 mt-6 text-[11px] text-white/20"
        style={{ animation: "glv-slide-up 0.8s 0.4s cubic-bezier(0.22,1,0.36,1) both" }}
      >
        Powered by{" "}
        <span className="font-semibold text-lime-400/40">Rock Frost Group</span>{" "}
        © 2025
      </p>

      <style>{`
        @keyframes glv-slide-up {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes glv-pulse-ring {
          0%   { transform: scale(1);   opacity: 0.5; }
          100% { transform: scale(1.9); opacity: 0; }
        }
        @keyframes glv-scan {
          0%   { top: 0%;   opacity: 0; }
          8%   { opacity: 1; }
          92%  { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
      `}</style>
    </main>
  );
}