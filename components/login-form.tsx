"use client";

import { useActionState } from "react";
import { login, type LoginState } from "@/actions/auth";

const initialState: LoginState = {};

export function LoginForm() {
  const [state, formAction, pending] = useActionState(login, initialState);

  return (
    <form
      action={formAction}
      className="w-full space-y-5 rounded-lg border border-white/10 bg-white p-6 shadow-2xl"
    >
      <div>
        <h2 className="text-xl font-bold text-gray-950">Welcome back</h2>
        <p className="mt-1 text-sm text-gray-600">
          Sign in to your GLV workspace.
        </p>
      </div>

      {state.error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      ) : null}

      <label className="block space-y-1">
        <span className="text-sm font-medium text-gray-700">Email</span>
        <input
          name="email"
          type="email"
          autoComplete="email"
          className="w-full border p-3 rounded"
          required
        />
      </label>

      <label className="block space-y-1">
        <span className="text-sm font-medium text-gray-700">Password</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          className="w-full border p-3 rounded"
          required
        />
      </label>

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-[#176b3a] p-3 font-medium text-white shadow-md hover:bg-[#125c31] disabled:cursor-not-allowed disabled:opacity-70"
      >
        {pending ? "Signing in..." : "Login"}
      </button>
    </form>
  );
}
