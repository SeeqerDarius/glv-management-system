import Link from "next/link";
import { redirect } from "next/navigation";
import { ProfileChangeStatus } from "@prisma/client";
import { updateMyProfile } from "@/actions/profile";
import { ProfileForm } from "@/components/profile-form";
import { ProfilePasswordForm } from "@/components/profile-password-form";
import { Button } from "@/components/ui/button";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdminRole, isSuperAdminRole } from "@/lib/roles";
import { ensureStaffInventorySchemaForRead } from "@/lib/staff-inventory-schema";

type ProfilePageProps = {
  searchParams: Promise<{
    saved?: string;
    passwordChanged?: string;
  }>;
};

type ProfileInventoryItem = {
  id: string;
  quantity: number;
  product: {
    name: string;
    category: string;
  };
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

  const { saved, passwordChanged } = await searchParams;
  const inventorySchemaReady = await ensureStaffInventorySchemaForRead("PROFILE");
  const [user, pendingCount] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        staff: inventorySchemaReady
          ? {
              include: {
                inventory: {
                  include: {
                    product: true,
                  },
                  orderBy: {
                    product: {
                      name: "asc",
                    },
                  },
                },
              },
            }
          : true,
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

  const staffInventory: ProfileInventoryItem[] | null =
    user.staff && "inventory" in user.staff && Array.isArray(user.staff.inventory)
      ? (user.staff.inventory as ProfileInventoryItem[])
      : null;

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

      {passwordChanged ? (
        <div className="rounded-lg border border-lime-200 bg-lime-50 p-4 text-sm text-lime-900">
          Password changed successfully.
        </div>
      ) : null}

      <ProfileForm
        action={updateMyProfile}
        user={user}
        canEditPosition={isAdminRole(session.user.role)}
      />

      <ProfilePasswordForm />

      {user.staff ? (
        <section className="rounded-lg border bg-white p-5">
          <h2 className="text-lg font-semibold text-gray-950">My Inventory</h2>
          <p className="mt-1 text-sm text-gray-600">
            Products currently allocated to your staff profile. Creating a
            customer account uses one unit from this stock.
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-left text-xs uppercase text-gray-500">
                  <th className="p-3">Product</th>
                  <th className="p-3">Category</th>
                  <th className="p-3 text-right">Available</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {staffInventory?.map((item) => (
                  <tr key={item.id}>
                    <td className="p-3 font-semibold text-gray-950">
                      {item.product.name}
                    </td>
                    <td className="p-3 text-gray-700">{item.product.category}</td>
                    <td className="p-3 text-right">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                          item.quantity > 0
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {item.quantity}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {staffInventory?.length === 0 ? (
              <p className="border-t py-8 text-center text-sm text-gray-600">
                No products have been allocated to your inventory yet.
              </p>
            ) : null}
            {!staffInventory ? (
              <p className="border-t py-8 text-center text-sm text-gray-600">
                Inventory is temporarily unavailable. Please refresh shortly.
              </p>
            ) : null}
          </div>
        </section>
      ) : null}

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
