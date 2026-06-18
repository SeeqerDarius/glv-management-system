"use client";

import Link from "next/link";
import { useActionState } from "react";
import { createStaff, type StaffFormState } from "@/actions/staff";
import { Button } from "@/components/ui/button";

const initialState: StaffFormState = {};

function FieldError({ message }: { message?: string }) {
  if (!message) return null;

  return <p className="text-sm text-red-700">{message}</p>;
}

export function StaffForm() {
  const [state, formAction, pending] = useActionState(
    createStaff,
    initialState
  );

  return (
    <div className="space-y-4">
      {state.credentials ? (
        <div className="rounded-lg border border-lime-300 bg-lime-50 p-4 text-sm text-lime-950">
          <p className="font-semibold">Staff login created.</p>
          <dl className="mt-3 grid gap-2">
            <div>
              <dt className="text-lime-800">Staff</dt>
              <dd className="font-medium">{state.credentials.fullName}</dd>
            </div>
            <div>
              <dt className="text-lime-800">Email</dt>
              <dd className="font-mono font-medium">{state.credentials.email}</dd>
            </div>
            <div>
              <dt className="text-lime-800">Staff Code</dt>
              <dd className="font-mono font-medium">{state.credentials.code}</dd>
            </div>
            <div>
              <dt className="text-lime-800">One-Time Password</dt>
              <dd className="font-mono text-lg font-semibold">
                {state.credentials.temporaryPassword}
              </dd>
            </div>
          </dl>
          <p className="mt-3 text-lime-800">
            Share this password with the staff member now. It will not be shown
            again, and they must change it on first login.
          </p>
        </div>
      ) : null}

      <form action={formAction} className="space-y-4 rounded-lg border bg-white p-5">
        {state.errors?.form ? (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {state.errors.form}
          </p>
        ) : null}

        <label className="block space-y-1">
          <span className="text-sm font-medium text-gray-700">Full Name</span>
          <input
            name="fullName"
            className="w-full rounded border p-3"
            required
          />
          <FieldError message={state.errors?.fullName} />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-gray-700">Email</span>
          <input
            name="email"
            type="email"
            className="w-full rounded border p-3"
            required
          />
          <FieldError message={state.errors?.email} />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-gray-700">Phone</span>
          <input name="phone" className="w-full rounded border p-3" />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-gray-700">
            Staff Code Override
          </span>
          <input
            name="code"
            className="w-full rounded border p-3 uppercase"
            placeholder="Leave blank to auto-generate"
          />
          <FieldError message={state.errors?.code} />
        </label>

        <div className="flex gap-3">
          <Button type="submit" disabled={pending}>
            {pending ? "Creating..." : "Create Staff"}
          </Button>
          <Button asChild type="button" variant="outline">
            <Link href="/staff">Cancel</Link>
          </Button>
        </div>
      </form>
    </div>
  );
}
