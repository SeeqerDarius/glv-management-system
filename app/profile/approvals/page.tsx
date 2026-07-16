import Link from "next/link";
import { redirect } from "next/navigation";
import { ProfileChangeStatus } from "@prisma/client";
import {
  approveProfileChange,
  rejectProfileChange,
} from "@/actions/profile";
import { Button } from "@/components/ui/button";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSuperAdminRole } from "@/lib/roles";

type ProfileApprovalsPageProps = {
  searchParams: Promise<{
    error?: string;
    reviewed?: string;
  }>;
};

const errorMessages: Record<string, string> = {
  "request-not-found": "That request was not found or has already been reviewed.",
  "email-in-use": "That email address is already in use.",
};

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default async function ProfileApprovalsPage({
  searchParams,
}: ProfileApprovalsPageProps) {
  const session = await auth();
  if (!session?.user?.id || !isSuperAdminRole(session.user.role)) {
    redirect("/dashboard");
  }

  const { error, reviewed } = await searchParams;
  const requests = await prisma.profileChangeRequest.findMany({
    where: { status: ProfileChangeStatus.PENDING },
    orderBy: { createdAt: "asc" },
    include: {
      user: {
        include: { staff: true },
      },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gray-950">
            Profile Approval Requests
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            Approve or reject email and profile picture changes submitted by
            users.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/profile">Back to Profile</Link>
        </Button>
      </div>

      {reviewed ? (
        <div className="rounded-lg border border-lime-200 bg-lime-50 p-4 text-sm text-lime-900">
          Request {reviewed}.
        </div>
      ) : null}

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {errorMessages[error] ?? "Unable to review request."}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-lg border bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-left text-xs uppercase text-gray-500">
                <th className="p-3">User</th>
                <th className="p-3">Current Email</th>
                <th className="p-3">Requested Email</th>
                <th className="p-3">Requested Picture</th>
                <th className="p-3">Submitted</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {requests.map((request) => (
                <tr key={request.id}>
                  <td className="p-3">
                    <p className="font-semibold text-gray-950">
                      {request.user.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {request.user.staff?.code ?? request.user.role}
                    </p>
                  </td>
                  <td className="p-3">{request.user.email}</td>
                  <td className="p-3">{request.requestedEmail ?? "-"}</td>
                  <td className="p-3">
                    {request.requestedProfileImageUrl ? (
                      <a
                        href={request.requestedProfileImageUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium text-green-700 hover:underline"
                      >
                        View image
                      </a>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="p-3">{formatDate(request.createdAt)}</td>
                  <td className="p-3">
                    <div className="flex flex-wrap justify-end gap-2">
                      <form action={approveProfileChange}>
                        <input type="hidden" name="id" value={request.id} />
                        <Button type="submit" size="sm">
                          Approve
                        </Button>
                      </form>
                      <form action={rejectProfileChange} className="flex gap-2">
                        <input type="hidden" name="id" value={request.id} />
                        <input
                          name="rejectionReason"
                          placeholder="Reason"
                          className="h-9 w-36 rounded border px-2 text-sm"
                        />
                        <Button type="submit" size="sm" variant="outline">
                          Reject
                        </Button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {requests.length === 0 ? (
            <p className="border-t py-10 text-center text-sm text-gray-600">
              No pending profile requests.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
