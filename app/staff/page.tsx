import Link from "next/link";
import { PencilIcon, UserXIcon } from "lucide-react";
import { deactivateStaff } from "@/actions/staff";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";

type StaffPageProps = {
  searchParams: Promise<Record<string, string | undefined>>;
};

export default async function StaffPage({ searchParams }: StaffPageProps) {
  await searchParams;
  const staff = await prisma.staff.findMany({
    orderBy: {
      createdAt: "desc",
    },
    include: {
      user: true,
      _count: {
        select: {
          customers: true,
        },
      },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gray-950">
            Staff Management
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            Manage GLV staff profiles and assignment codes.
          </p>
        </div>

        <Button asChild>
          <Link href="/staff/new">Add Staff</Link>
        </Button>
      </div>

      <div className="overflow-hidden rounded-lg border bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-100 text-left text-gray-700">
              <th className="p-3 font-medium">Code</th>
              <th className="p-3 font-medium">Name</th>
              <th className="p-3 font-medium">Email</th>
              <th className="p-3 font-medium">Phone</th>
              <th className="p-3 font-medium">Customers</th>
              <th className="p-3 font-medium">Status</th>
              <th className="p-3 font-medium">Login</th>
              <th className="p-3 text-right font-medium">Actions</th>
            </tr>
          </thead>

          <tbody>
            {staff.map((member) => (
              <tr key={member.id} className="border-t">
                <td className="p-3 font-semibold text-gray-950">
                  {member.code}
                </td>
                <td className="p-3">{member.fullName}</td>
                <td className="p-3">{member.email}</td>
                <td className="p-3">{member.phone || "-"}</td>
                <td className="p-3">{member._count.customers}</td>
                <td className="p-3">
                  <Badge variant={member.active ? "default" : "secondary"}>
                    {member.active ? "Active" : "Inactive"}
                  </Badge>
                </td>
                <td className="p-3">
                  <Badge variant={member.user ? "default" : "secondary"}>
                    {member.user ? "Created" : "Missing"}
                  </Badge>
                </td>
                <td className="p-3">
                  <div className="flex justify-end gap-2">
                    <Button asChild variant="outline" size="icon-sm">
                      <Link href={`/staff/${member.id}/edit`} title="Edit staff">
                        <PencilIcon />
                        <span className="sr-only">Edit staff</span>
                      </Link>
                    </Button>
                    {member.active ? (
                      <form action={deactivateStaff}>
                        <input type="hidden" name="id" value={member.id} />
                        <Button
                          type="submit"
                          variant="destructive"
                          size="icon-sm"
                          title="Deactivate staff"
                        >
                          <UserXIcon />
                          <span className="sr-only">Deactivate staff</span>
                        </Button>
                      </form>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {staff.length === 0 ? (
          <div className="border-t p-8 text-center text-sm text-gray-600">
            No staff records yet.
          </div>
        ) : null}
      </div>
    </div>
  );
}
