"use client";

import { useActionState } from "react";
import { submitStaffApplication, type SignupState } from "@/actions/applications";
import { Button } from "@/components/ui/button";

const initialState: SignupState = {};

export function SignupForm() {
  const [state, formAction, pending] = useActionState(
    submitStaffApplication,
    initialState
  );

  return (
    <form action={formAction} className="w-full max-w-md space-y-4 rounded-lg border bg-white p-6 shadow-sm">
      <div>
        <h1 className="text-2xl font-bold text-gray-950">Staff Signup</h1>
        <p className="mt-1 text-sm text-gray-600">
          Apply for GLV staff access. Admin approval is required.
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
        <span className="text-sm font-medium text-gray-700">Full Name</span>
        <input name="fullName" className="w-full rounded border p-3" required />
      </label>

      <label className="block space-y-1">
        <span className="text-sm font-medium text-gray-700">Email</span>
        <input name="email" type="email" className="w-full rounded border p-3" required />
      </label>

      <label className="block space-y-1">
        <span className="text-sm font-medium text-gray-700">Phone</span>
        <input name="phone" className="w-full rounded border p-3" />
      </label>

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Submitting..." : "Submit Application"}
      </Button>
    </form>
  );
}
