"use client";

import { useState } from "react";
import { PencilLine } from "lucide-react";
import { updateAccountPrice } from "@/actions/accounts";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/password-input";

type AccountPriceOverrideFormProps = {
  accountId: string;
  productName: string;
  currentPrice: number;
  returnTo: string;
};

export function AccountPriceOverrideForm({
  accountId,
  productName,
  currentPrice,
  returnTo,
}: AccountPriceOverrideFormProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        aria-label={`Edit ${productName} account price`}
        title="Edit account price"
        onClick={() => setOpen(true)}
        className="group/price flex size-8 items-center justify-center rounded-md text-gray-400 transition-all duration-150 hover:bg-amber-50 hover:text-amber-700"
      >
        <PencilLine className="size-4 transition-transform duration-200 group-hover/price:scale-125 group-hover/price:rotate-6" />
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg border bg-white p-5 shadow-xl">
            <h2 className="text-lg font-semibold text-gray-950">
              Edit account price
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              This changes only this customer&apos;s account price. The product
              catalog price will not change.
            </p>

            <form action={updateAccountPrice} className="mt-4 space-y-4">
              <input type="hidden" name="id" value={accountId} />
              <input type="hidden" name="returnTo" value={returnTo} />

              <label className="block space-y-1">
                <span className="text-sm font-medium text-gray-700">
                  New price
                </span>
                <input
                  name="targetAmount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  defaultValue={currentPrice.toFixed(2)}
                  className="w-full rounded border p-3"
                  required
                />
              </label>

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
                <Button type="submit">Save price</Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
