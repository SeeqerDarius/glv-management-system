import Link from "next/link";
import { redirect } from "next/navigation";
import { ProfileChangeStatus } from "@prisma/client";
import { updateMyProfile } from "@/actions/profile";
import { ProfileForm } from "@/components/profile-form";
import { Button } from "@/components/ui/button";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSuperAdminRole } from "@/lib/roles";

type ProfilePageProps = {
  searchParams: Promise<{
    saved?: string;
  }>;
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

export default async function ProfilePage({ searchParams }: ProfilePageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const { saved } = await searchParams;
  const [user, pendingCount] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        staff: true,
        profileRequests: {
          orderBy: { createdAt: "desc" },
          take: 8,
        },
      },
    }),
    isSuperAdminRole(session.user.role)
      ? prisma.profileChangeRequest.count({
          where: { status: ProfileChangeStatus.PENDING },
        })
      : Promise.resolve(0),
  ]);

  if (!user) {
    redirect("/dashboard");
  }

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gray-950">My Profile</h1>
          <p className="mt-1 text-sm text-gray-600">
            Update your profile details. Email and profile picture changes need
            Super Admin approval.
          </p>
        </div>
        {isSuperAdminRole(session.user.role) ? (
          <Button asChild variant="outline">
            <Link href="/profile/approvals">
              Review Profile Requests
              {pendingCount > 0 ? ` (${pendingCount})` : ""}
            </Link>
          </Button>
        ) : null}
      </div>

      {saved ? (
        <div className="rounded-lg border border-lime-200 bg-lime-50 p-4 text-sm text-lime-900">
          Profile saved. Email or picture changes will appear after Super Admin
          approval.
        </div>
      ) : null}

      <ProfileForm action={updateMyProfile} user={user} />

      <section className="rounded-lg border bg-white p-5">
        <h2 className="text-lg font-semibold text-gray-950">
          Recent Profile Requests
        </h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[680px] text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-left text-xs uppercase text-gray-500">
                <th className="p-3">Requested</th>
                <th className="p-3">Email</th>
                <th className="p-3">Picture</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {user.profileRequests.map((request) => (
                <tr key={request.id}>
                  <td className="p-3">{formatDate(request.createdAt)}</td>
                  <td className="p-3">{request.requestedEmail ?? "-"}</td>
                  <td className="p-3">
                    {request.requestedProfileImageUrl ? "Submitted" : "-"}
                  </td>
                  <td className="p-3 font-semibold">{request.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {user.profileRequests.length === 0 ? (
            <p className="border-t py-8 text-center text-sm text-gray-600">
              No profile approval requests yet.
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
