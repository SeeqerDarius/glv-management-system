"use client";

import { useActionState } from "react";
import { login, type LoginState } from "@/actions/auth";

const initialState: LoginState = {};

export function LoginForm() {
  const [state, formAction, pending] = useActionState(login, initialState);

  return (
    <form
      action={formAction}
      className="w-full max-w-md border rounded-lg bg-white p-6 space-y-4 shadow-sm"
    >
      <div>
        <h1 className="text-2xl font-bold text-gray-950">GLV Login</h1>
        <p className="mt-1 text-sm text-gray-600">
          Sign in to manage God&apos;s Love Ventures.
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
        className="w-full bg-green-600 text-white p-3 rounded disabled:cursor-not-allowed disabled:opacity-70"
      >
        {pending ? "Signing in..." : "Login"}
      </button>
    </form>
  );
}
