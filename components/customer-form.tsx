"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { useActionState } from "react";
import type { CustomerFormState } from "@/actions/customers";
import { Button } from "@/components/ui/button";
import { GlvLoading } from "@/components/glv-loading";

type StaffOption = { id: string; fullName: string; code: string };

export function CustomerForm({ action, staff, canAssignStaff }: {
  action: (state: CustomerFormState, formData: FormData) => Promise<CustomerFormState>;
  staff: StaffOption[];
  canAssignStaff: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <form action={formAction} className="space-y-4 rounded-lg border bg-white p-5">
      {state.duplicateWarning ? (
        <div className="flex gap-3 rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          <AlertTriangle className="mt-0.5 size-5 shrink-0" />
          <div><p className="font-semibold">Possible duplicate found</p><p className="mt-1">{state.duplicateWarning}</p></div>
        </div>
      ) : null}
      {state.duplicateWarning ? <input type="hidden" name="confirmDuplicate" value="true" /> : null}

      <label className="block space-y-1"><span className="text-sm font-medium text-gray-700">Full Name</span><input name="fullName" className="w-full rounded border p-3" required />{state.errors?.fullName ? <p className="text-sm text-red-700">{state.errors.fullName}</p> : null}</label>
      <label className="block space-y-1"><span className="text-sm font-medium text-gray-700">Phone <span className="font-normal text-gray-400">(optional)</span></span><input name="phone" className="w-full rounded border p-3" />{state.errors?.phone ? <p className="text-sm text-red-700">{state.errors.phone}</p> : null}</label>
      <label className="block space-y-1"><span className="text-sm font-medium text-gray-700">Address</span><textarea name="address" className="min-h-24 w-full rounded border p-3" /></label>
      <label className="block space-y-1"><span className="text-sm font-medium text-gray-700">National ID <span className="font-normal text-gray-400">(optional)</span></span><input name="nationalId" className="w-full rounded border p-3" /></label>

      {canAssignStaff ? (
        <label className="block space-y-1"><span className="text-sm font-medium text-gray-700">Assigned Staff</span><select name="staffId" className="w-full rounded border p-3" required><option value="">Select staff</option>{staff.map((member) => <option key={member.id} value={member.id}>{member.fullName} ({member.code})</option>)}</select></label>
      ) : null}

      <div className="flex flex-wrap gap-3"><Button type="submit" disabled={pending}>{pending ? <GlvLoading compact label="Saving" /> : state.duplicateWarning ? "Add Anyway" : "Create Customer"}</Button><Button asChild type="button" variant="outline"><Link href="/customers">Cancel</Link></Button></div>
    </form>
  );
}
