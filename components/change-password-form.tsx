"use client";

import { useActionState } from "react";
import {
  changePassword,
  type ChangePasswordState,
} from "@/actions/auth";
import { Button } from "@/components/ui/button";

const initialState: ChangePasswordState = {};

export function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState(
    changePassword,
    initialState
  );

  return (
    <form
      action={formAction}
      className="w-full max-w-md space-y-4 rounded-lg border bg-white p-6 shadow-sm"
    >
      <div>
        <h1 className="text-2xl font-bold text-gray-950">Change Password</h1>
        <p className="mt-1 text-sm text-gray-600">
          Update your temporary password before continuing.
        </p>
      </div>

      {state.error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      ) : null}

      <label className="block space-y-1">
        <span className="text-sm font-medium text-gray-700">
          Current Password
        </span>
        <input
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          className="w-full rounded border p-3"
          required
        />
      </label>

      <label className="block space-y-1">
        <span className="text-sm font-medium text-gray-700">New Password</span>
        <input
          name="newPassword"
          type="password"
          autoComplete="new-password"
          className="w-full rounded border p-3"
          required
        />
      </label>

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Updating..." : "Update Password"}
      </Button>
    </form>
  );
}
