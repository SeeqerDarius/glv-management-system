"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  requestPasswordReset,
  type ForgotPasswordState,
} from "@/actions/auth";
import { Button } from "@/components/ui/button";

const initialState: ForgotPasswordState = {};

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(
    requestPasswordReset,
    initialState
  );

  return (
    <form
      action={formAction}
      className="w-full max-w-md space-y-4 rounded-lg border bg-white p-6 shadow-sm"
    >
      <div>
        <h1 className="text-2xl font-bold text-gray-950">Reset Password</h1>
        <p className="mt-1 text-sm text-gray-600">
          Enter your staff email. An admin will issue a one-time password.
        </p>
      </div>

      {state.error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      ) : null}

      {state.success ? (
        <p className="rounded-md border border-lime-200 bg-lime-50 px-3 py-2 text-sm text-lime-800">
          {state.success}
        </p>
      ) : null}

      <label className="block space-y-1">
        <span className="text-sm font-medium text-gray-700">Email</span>
        <input
          name="email"
          type="email"
          autoComplete="email"
          className="w-full rounded border p-3"
          required
        />
      </label>

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Submitting..." : "Request Reset"}
      </Button>

      <Button asChild type="button" variant="outline" className="w-full">
        <Link href="/login">Back to Login</Link>
      </Button>
    </form>
  );
}
