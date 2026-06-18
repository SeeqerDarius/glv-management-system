import Link from "next/link";
import { notFound } from "next/navigation";
import { updateStaff } from "@/actions/staff";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";

type EditStaffPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function EditStaffPage({ params }: EditStaffPageProps) {
  const { id } = await params;
  const staff = await prisma.staff.findUnique({
    where: {
      id,
    },
  });

  if (!staff) {
    notFound();
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-950">Edit Staff</h1>
        <p className="mt-1 text-sm text-gray-600">
          Update contact details, assignment code, and status.
        </p>
      </div>

      <form action={updateStaff} className="space-y-4 rounded-lg border bg-white p-5">
        <input type="hidden" name="id" value={staff.id} />

        <label className="block space-y-1">
          <span className="text-sm font-medium text-gray-700">Full Name</span>
          <input
            name="fullName"
            defaultValue={staff.fullName}
            className="w-full border p-3 rounded"
            required
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-gray-700">Email</span>
          <input
            name="email"
            type="email"
            defaultValue={staff.email}
            className="w-full border p-3 rounded"
            required
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-gray-700">Phone</span>
          <input
            name="phone"
            defaultValue={staff.phone ?? ""}
            className="w-full border p-3 rounded"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-gray-700">Staff Code</span>
          <input
            name="code"
            defaultValue={staff.code}
            className="w-full border p-3 rounded uppercase"
            required
          />
        </label>

        <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <input
            type="checkbox"
            name="active"
            defaultChecked={staff.active}
            className="size-4"
          />
          Active
        </label>

        <div className="flex gap-3">
          <Button type="submit">Save Changes</Button>
          <Button asChild type="button" variant="outline">
            <Link href="/staff">Cancel</Link>
          </Button>
        </div>
      </form>
    </div>
  );
}
