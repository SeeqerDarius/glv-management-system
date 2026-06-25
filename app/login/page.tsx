"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login, type LoginState } from "@/actions/auth";
import { PasswordInput } from "@/components/password-input";

const initialState: LoginState = {};

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, initialState);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#07130d] px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-lime-400 text-xl font-black text-[#123824] shadow-lg shadow-lime-500/20">
            GLV
          </div>
          <h1 className="text-2xl font-bold text-white">Welcome back</h1>
          <p className="mt-1 text-sm text-white/45">
            Sign in to GLV Management System
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-7 py-7 shadow-2xl shadow-black/20">
          {state.error ? (
            <div className="mb-4 rounded-lg border border-red-400/30 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-200">
              {state.error}
            </div>
          ) : null}

          <form action={formAction} className="space-y-4">
            <label className="block space-y-1.5">
              <span className="block text-[11px] font-medium uppercase tracking-widest text-white/45">
                Email address
              </span>
              <input
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="admin@glv.com"
                className="w-full rounded-lg border border-white/15 bg-white/[0.06] px-3.5 py-2.5 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-lime-400 focus:bg-lime-400/5 focus:ring-2 focus:ring-lime-400/20"
              />
            </label>

            <label className="block space-y-1.5">
              <span className="block text-[11px] font-medium uppercase tracking-widest text-white/45">
                Password
              </span>
              <PasswordInput
                name="password"
                autoComplete="current-password"
                required
                placeholder="Password"
                className="rounded-lg border border-white/15 bg-white/[0.06] py-2.5 pl-3.5 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-lime-400 focus:bg-lime-400/5 focus:ring-2 focus:ring-lime-400/20"
              />
            </label>

            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="text-white/40">Use your GLV staff or admin account.</span>
              <Link
                href="/signup"
                className="shrink-0 text-lime-300 transition hover:text-lime-200 hover:underline"
              >
                Staff sign up
              </Link>
            </div>

            <button
              type="submit"
              disabled={pending}
              className="flex w-full items-center justify-center rounded-lg bg-lime-400 py-2.5 text-sm font-semibold tracking-wide text-[#123824] transition hover:opacity-90 active:scale-[0.99] disabled:opacity-70"
            >
              {pending ? "Signing in..." : "Sign in"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
