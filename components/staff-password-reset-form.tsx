"use client";

import { useActionState, useState } from "react";
import { KeyRound, X } from "lucide-react";
import {
  resetStaffPassword,
  type StaffPasswordResetState,
} from "@/actions/staff";

const initialState: StaffPasswordResetState = {};

export function StaffPasswordResetForm({
  staffId,
  staffName,
  disabled,
  showLabel = false,
}: {
  staffId: string;
  staffName: string;
  disabled?: boolean;
  showLabel?: boolean;
}) {
  const [dismissed, setDismissed] = useState(false);
  const [state, formAction, pending] = useActionState(
    resetStaffPassword,
    initialState
  );
  const credentials = dismissed ? undefined : state.credentials;

  return (
    <div>
      <form action={formAction} onSubmit={() => setDismissed(false)}>
        <input type="hidden" name="id" value={staffId} />
        <button
          type="submit"
          disabled={pending || disabled}
          aria-label={`Reset password for ${staffName}`}
          title="Reset password"
          className={
            showLabel
              ? "inline-flex h-9 items-center justify-center gap-2 rounded-md border border-blue-200 px-3 text-sm font-medium text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-40"
              : "group/reset flex size-8 items-center justify-center rounded-md text-gray-400 transition-all duration-150 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
          }
        >
          <KeyRound className="size-4 transition-transform duration-200 group-hover/reset:scale-125 group-hover/reset:-translate-y-0.5" />
          {showLabel ? <span>Reset password</span> : null}
        </button>
      </form>

      {state.error ? (
        <p className="max-w-52 rounded-md border border-red-200 bg-red-50 p-2 text-left text-xs text-red-700">
          {state.error}
        </p>
      ) : null}

      {credentials ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/45 px-4 py-6">
          <div className="w-full max-w-md rounded-lg border border-lime-300 bg-white p-5 text-left shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-lg font-semibold text-gray-950">
                  One-time reset login
                </p>
                <p className="mt-1 text-sm text-gray-600">
                  Share these details with {credentials.fullName}.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDismissed(true)}
                className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                aria-label="Close reset password details"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3 rounded-md border border-lime-200 bg-lime-50 p-4">
              <div>
                <p className="text-xs font-medium uppercase text-lime-800">
                  Email
                </p>
                <p className="mt-1 break-all font-mono text-sm text-lime-950">
                  {credentials.email}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-lime-800">
                  Temporary password
                </p>
                <p className="mt-1 break-all font-mono text-base font-semibold text-lime-950">
                  {credentials.temporaryPassword}
                </p>
              </div>
            </div>

            <p className="mt-3 text-sm text-gray-600">
              Staff must change this password after login.
            </p>
            <button
              type="button"
              onClick={() => setDismissed(true)}
              className="mt-4 inline-flex h-10 w-full items-center justify-center rounded-md bg-[#123824] px-4 text-sm font-medium text-lime-300 hover:bg-[#1a4f33]"
            >
              Done
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
