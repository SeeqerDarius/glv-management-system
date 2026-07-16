"use client";

import { useActionState } from "react";
import {
  updateMyPassword,
  type ProfilePasswordState,
} from "@/actions/profile";
import { GlvLoading } from "@/components/glv-loading";
import { PasswordInput } from "@/components/password-input";
import { Button } from "@/components/ui/button";

const errorMessages: Record<string, string> = {
  "missing-fields": "Current password, new password, and confirmation are required.",
  "password-mismatch": "New password and confirmation must match.",
  "password-too-short": "New password must be at least 8 characters.",
  "password-unchanged": "New password must be different from the current password.",
  "invalid-current-password": "Current password is incorrect.",
  "profile-not-found": "Your profile could not be found. Please sign in again.",
};

const initialState: ProfilePasswordState = {};

export function ProfilePasswordForm() {
  const [state, formAction, pending] = useActionState(
    updateMyPassword,
    initialState
  );

  return (
    <form action={formAction} className="space-y-4 rounded-lg border bg-white p-5">
      <div>
        <h2 className="text-lg font-semibold text-gray-950">Change Password</h2>
        <p className="mt-1 text-sm text-gray-600">
          This updates your password immediately and does not need Super Admin
          approval.
        </p>
      </div>

      {state.error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {errorMessages[state.error] ?? "Unable to change password."}
        </p>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <label className="space-y-1.5">
          <span className="text-sm font-medium text-gray-700">
            Current Password
          </span>
          <PasswordInput
            name="currentPassword"
            autoComplete="current-password"
            className="rounded border p-3"
            required
          />
        </label>
        <label className="space-y-1.5">
          <span className="text-sm font-medium text-gray-700">New Password</span>
          <PasswordInput
            name="newPassword"
            autoComplete="new-password"
            className="rounded border p-3"
            required
          />
        </label>
        <label className="space-y-1.5">
          <span className="text-sm font-medium text-gray-700">
            Confirm Password
          </span>
          <PasswordInput
            name="confirmPassword"
            autoComplete="new-password"
            className="rounded border p-3"
            required
          />
        </label>
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? <GlvLoading compact label="Changing" /> : "Change Password"}
      </Button>
    </form>
  );
}
