"use client";

import { useActionState } from "react";
import { KeyRound } from "lucide-react";
import {
  resetStaffPassword,
  type StaffPasswordResetState,
} from "@/actions/staff";

const initialState: StaffPasswordResetState = {};

export function StaffPasswordResetForm({
  staffId,
  staffName,
  disabled,
}: {
  staffId: string;
  staffName: string;
  disabled?: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    resetStaffPassword,
    initialState
  );

  return (
    <div className="space-y-2">
      <form action={formAction}>
        <input type="hidden" name="id" value={staffId} />
        <button
          type="submit"
          disabled={pending || disabled}
          aria-label={`Reset password for ${staffName}`}
          title="Reset password"
          className="
            group/reset flex size-8 items-center justify-center rounded-md
            text-gray-400 transition-all duration-150
            hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-40
          "
        >
          <KeyRound className="size-4 transition-transform duration-200 group-hover/reset:scale-125 group-hover/reset:-translate-y-0.5" />
        </button>
      </form>

      {state.error ? (
        <p className="max-w-52 rounded-md border border-red-200 bg-red-50 p-2 text-left text-xs text-red-700">
          {state.error}
        </p>
      ) : null}

      {state.credentials ? (
        <div className="max-w-64 rounded-md border border-lime-300 bg-lime-50 p-3 text-left text-xs text-lime-950 shadow-sm">
          <p className="font-semibold">One-time reset login</p>
          <p className="mt-1">
            Email:{" "}
            <span className="font-mono">{state.credentials.email}</span>
          </p>
          <p>
            Password:{" "}
            <span className="font-mono">
              {state.credentials.temporaryPassword}
            </span>
          </p>
          <p className="mt-1 text-lime-800">
            Staff must change this password after login.
          </p>
        </div>
      ) : null}
    </div>
  );
}
