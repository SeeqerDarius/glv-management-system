"use client";

import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { markCustomerCreditRefunded } from "@/actions/payments";
import { PasswordInput } from "@/components/password-input";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/accounts";

type CustomerCreditRefundFormProps = {
  creditId: string;
  amount: number;
  returnTo: string;
};

export function CustomerCreditRefundForm({
  creditId,
  amount,
  returnTo,
}: CustomerCreditRefundFormProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        aria-label={`Mark ${formatMoney(amount)} credit as refunded`}
        title="Mark refunded"
        onClick={() => setOpen(true)}
        className="group/refund flex size-8 items-center justify-center rounded-md text-gray-400 transition-all duration-150 hover:bg-blue-50 hover:text-blue-700"
      >
        <RotateCcw className="size-4 transition-transform duration-200 group-hover/refund:scale-125 group-hover/refund:-rotate-45" />
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg border bg-white p-5 shadow-xl">
            <h2 className="text-lg font-semibold text-gray-950">
              Mark credit refunded
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              Confirm that {formatMoney(amount)} has been returned to the
              customer. The original payment record will remain unchanged.
            </p>

            <form action={markCustomerCreditRefunded} className="mt-4 space-y-4">
              <input type="hidden" name="id" value={creditId} />
              <input type="hidden" name="returnTo" value={returnTo} />

              <label className="block space-y-1">
                <span className="text-sm font-medium text-gray-700">
                  Admin password
                </span>
                <PasswordInput
                  name="adminPassword"
                  className="rounded border p-3"
                  autoComplete="current-password"
                  required
                />
              </label>

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit">Mark refunded</Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
