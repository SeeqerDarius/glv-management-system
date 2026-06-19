"use client";

import { useState, type FormEvent } from "react";
import { UsersRoundIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlvLoading } from "@/components/glv-loading";

type StaffOption = {
  id: string;
  code: string;
  fullName: string;
};

export function BulkReassignmentForm({
  action,
  staff,
  formId,
  returnTo,
}: {
  action: (formData: FormData) => void | Promise<void>;
  staff: StaffOption[];
  formId: string;
  returnTo: string;
}) {
  const [submitting, setSubmitting] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const formData = new FormData(event.currentTarget);
    const selectedCount = formData.getAll("customerIds").length;

    if (selectedCount === 0) {
      event.preventDefault();
      window.alert("Select at least one customer or account.");
      return;
    }

    if (
      !window.confirm(
        `Reassign ${selectedCount} selected item${selectedCount === 1 ? "" : "s"} to the chosen staff member?`
      )
    ) {
      event.preventDefault();
      return;
    }

    setSubmitting(true);
  }

  return (
    <form
      id={formId}
      action={action}
      onSubmit={handleSubmit}
      className="flex flex-wrap items-end gap-3 rounded-lg border bg-white p-4"
    >
      <input type="hidden" name="returnTo" value={returnTo} />
      <label className="min-w-56 flex-1 space-y-1">
        <span className="text-sm font-medium text-gray-700">
          Delegate selected records
        </span>
        <select name="staffId" className="w-full rounded border p-3" required>
          <option value="">Select staff</option>
          {staff.map((member) => (
            <option key={member.id} value={member.id}>
              {member.fullName} ({member.code})
            </option>
          ))}
        </select>
      </label>
      <Button type="submit" disabled={submitting}>
        <UsersRoundIcon className="size-4" />
        {submitting ? <GlvLoading compact label="Delegating" /> : "Apply Delegation"}
      </Button>
    </form>
  );
}
