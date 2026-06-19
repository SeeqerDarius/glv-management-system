import { StaffApplicationsList } from "@/components/staff-applications-list";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function StaffApplicationsPage() {
  const applications = await prisma.staffApplication.findMany({
    orderBy: {
      createdAt: "desc",
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-950">Staff Applications</h1>
        <p className="mt-1 text-sm text-gray-600">
          Review public staff signup requests. Public signup cannot create admin users.
        </p>
      </div>

      <StaffApplicationsList applications={applications} />
    </div>
  );
}
