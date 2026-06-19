"use client";

import { useActionState } from "react";
import type { StaffApplication } from "@prisma/client";
import {
  approveStaffApplication,
  rejectStaffApplication,
  type ApprovalState,
} from "@/actions/applications";
import { Button } from "@/components/ui/button";

const initialState: ApprovalState = {};

function ApprovalForm({ application }: { application: StaffApplication }) {
  const [state, formAction, pending] = useActionState(
    approveStaffApplication,
    initialState
  );

  return (
    <div className="space-y-2">
      {state.error ? <p className="text-sm text-red-700">{state.error}</p> : null}
      {state.credentials ? (
        <div className="rounded border border-lime-300 bg-lime-50 p-3 text-xs text-lime-950">
          <p className="font-semibold">Approved. One-time credentials:</p>
          <p>Email: <span className="font-mono">{state.credentials.email}</span></p>
          <p>Password: <span className="font-mono">{state.credentials.temporaryPassword}</span></p>
        </div>
      ) : null}
      <form action={formAction}>
        <input type="hidden" name="id" value={application.id} />
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Approving..." : "Approve"}
        </Button>
      </form>
    </div>
  );
}

export function StaffApplicationsList({
  applications,
}: {
  applications: StaffApplication[];
}) {
  return (
    <div className="overflow-hidden rounded-lg border bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-100 text-left text-gray-700">
            <th className="p-3 font-medium">Name</th>
            <th className="p-3 font-medium">Email</th>
            <th className="p-3 font-medium">Phone</th>
            <th className="p-3 font-medium">Status</th>
            <th className="p-3 text-right font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {applications.map((application) => (
            <tr key={application.id} className="border-t align-top">
              <td className="p-3">{application.fullName}</td>
              <td className="p-3">{application.email}</td>
              <td className="p-3">{application.phone || "-"}</td>
              <td className="p-3">{application.status}</td>
              <td className="p-3">
                {application.status === "PENDING" ? (
                  <div className="flex justify-end gap-2">
                    <ApprovalForm application={application} />
                    <form action={rejectStaffApplication}>
                      <input type="hidden" name="id" value={application.id} />
                      <Button type="submit" variant="destructive" size="sm">
                        Reject
                      </Button>
                    </form>
                  </div>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {applications.length === 0 ? (
        <div className="border-t p-8 text-center text-sm text-gray-600">
          No applications found.
        </div>
      ) : null}
    </div>
  );
}
