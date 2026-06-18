import { StaffForm } from "@/components/staff-form";

export default function NewStaffPage() {
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-950">Add Staff</h1>
        <p className="mt-1 text-sm text-gray-600">
          Staff codes are generated from the name unless you enter one. A linked
          staff login will be created with a random one-time password.
        </p>
      </div>

      <StaffForm />
    </div>
  );
}
