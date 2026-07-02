"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/password-input";

const errorMessages: Record<string, string> = {
  "missing-fields": "Current password and new password are required.",
  "password-mismatch": "New password and confirmation must match.",
  "password-too-short": "New password must be at least 8 characters.",
  "password-unchanged": "New password must be different from the current password.",
  "invalid-current-password": "Current password is incorrect.",
};

export function ChangePasswordForm({ error }: { error?: string }) {
  const [clientError, setClientError] = useState<string>();
  const serverError = error ? errorMessages[error] : undefined;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const formData = new FormData(event.currentTarget);
    const newPassword = String(formData.get("newPassword") ?? "");
    const confirmPassword = String(formData.get("confirmPassword") ?? "");

    if (newPassword !== confirmPassword) {
      event.preventDefault();
      setClientError("New password and confirmation must match.");
      return;
    }

    setClientError(undefined);
  }

  return (
    <form
      action="/api/change-password"
      method="post"
      onSubmit={handleSubmit}
      className="w-full max-w-md space-y-4 rounded-lg border bg-white p-6 shadow-sm"
    >
      <div>
        <h1 className="text-2xl font-bold text-gray-950">Change Password</h1>
        <p className="mt-1 text-sm text-gray-600">
          Update your temporary password before continuing.
        </p>
      </div>

      {serverError || clientError ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {clientError || serverError}
        </p>
      ) : null}

      <label className="block space-y-1">
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

      <label className="block space-y-1">
        <span className="text-sm font-medium text-gray-700">New Password</span>
        <PasswordInput
          name="newPassword"
          autoComplete="new-password"
          className="rounded border p-3"
          required
        />
      </label>

      <label className="block space-y-1">
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

      <Button type="submit" className="w-full">
        Update Password
      </Button>
    </form>
  );
}
