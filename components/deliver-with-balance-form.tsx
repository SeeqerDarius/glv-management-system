"use client";

import { useState } from "react";
import { DeliveryStatus } from "@prisma/client";
import { PackageCheck } from "lucide-react";
import { updateAccountDeliveryStatus } from "@/actions/accounts";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";

type DeliverWithBalanceFormProps = {
  accountId: string;
  customerName: string;
  productName: string;
  /** Formatted balance still owed, shown so the decision is explicit. */
  balanceLabel: string;
};

/**
 * Releases a product to a trusted customer who has not finished paying. The
 * reason is required and stored, and the balance owed at handover is recorded
 * on the account so the debt stays visible.
 */
export function DeliverWithBalanceForm({
  accountId,
  customerName,
  productName,
  balanceLabel,
}: DeliverWithBalanceFormProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const canSubmit = reason.trim().length > 0 && acknowledged;

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="w-full gap-2 sm:w-auto"
        onClick={() => setOpen(true)}
      >
        <PackageCheck className="size-4" />
        Deliver with balance owing
      </Button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-lg border bg-white p-5 shadow-xl">
            <h2 className="text-lg font-semibold text-gray-950">
              Deliver before the plan is fully paid?
            </h2>
            <p className="mt-2 text-sm text-gray-700">
              {customerName} still owes{" "}
              <span className="font-semibold text-gray-950">
                {balanceLabel}
              </span>{" "}
              on {productName}. Use this only for consistent, well-behaved
              customers.
            </p>
            <p className="mt-2 text-sm text-gray-600">
              The account stays open and the customer keeps paying the remaining
              balance. The amount owed at handover is recorded on the account
              and in the audit log.
            </p>

            <form
              action={updateAccountDeliveryStatus}
              className="mt-4 space-y-4"
            >
              <input type="hidden" name="id" value={accountId} />
              <input
                type="hidden"
                name="deliveryStatus"
                value={DeliveryStatus.DELIVERED}
              />
              <input
                type="hidden"
                name="allowOutstandingBalance"
                value="yes"
              />

              <label className="block space-y-1">
                <span className="text-sm font-medium text-gray-700">
                  Reason for early delivery
                </span>
                <textarea
                  name="deliveryNote"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  rows={3}
                  maxLength={500}
                  required
                  placeholder="For example: long-standing customer, never missed a week, balance agreed with the owner."
                  className="w-full rounded border p-3 text-sm outline-none focus:border-green-700 focus:ring-2 focus:ring-green-700/20"
                />
                <span className="block text-xs text-gray-500">
                  {reason.length}/500 characters
                </span>
              </label>

              <label className="flex items-start gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={acknowledged}
                  onChange={(event) => setAcknowledged(event.target.checked)}
                  className="mt-0.5 size-4 accent-lime-600"
                />
                <span>
                  I confirm the product may be released now and that{" "}
                  {balanceLabel} is still collectible from this customer.
                </span>
              </label>

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setOpen(false);
                    setReason("");
                    setAcknowledged(false);
                  }}
                >
                  Cancel
                </Button>
                <SubmitButton disabled={!canSubmit} pendingLabel="Confirming">
                  Confirm delivery
                </SubmitButton>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
