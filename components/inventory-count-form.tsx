"use client";

import { useState } from "react";
import { ClipboardCheck } from "lucide-react";
import { correctStock } from "@/actions/inventory";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";

type InventoryCountFormProps = {
  productId: string;
  productName: string;
  stockOnHand: number;
  returnTo: string;
};

/**
 * Sets stock on hand to what was counted on the shelf.
 *
 * The reason is required: a correction without one is how a count quietly
 * drifts, and the ledger exists so drift can be traced back to a person.
 */
export function InventoryCountForm({
  productId,
  productName,
  stockOnHand,
  returnTo,
}: InventoryCountFormProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Correct counted stock for ${productName}`}
        title="Correct count"
        className="group/count flex size-8 items-center justify-center rounded-md text-gray-400 transition-all duration-150 hover:bg-amber-50 hover:text-amber-700"
      >
        <ClipboardCheck className="size-4 transition-transform duration-200 group-hover/count:scale-125 group-hover/count:-translate-y-0.5" />
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-lg border bg-white p-5 text-left shadow-xl">
            <h2 className="text-lg font-semibold text-gray-950">
              What did you count?
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              {productName} &middot; system says {stockOnHand}
            </p>

            <form action={correctStock} className="mt-4 space-y-4">
              <input type="hidden" name="productId" value={productId} />
              <input type="hidden" name="returnTo" value={returnTo} />

              <label className="block space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                  Counted on the shelf
                </span>
                <input
                  name="counted"
                  type="number"
                  min={0}
                  step={1}
                  defaultValue={stockOnHand}
                  required
                  autoFocus
                  className="h-10 w-full rounded-md border border-gray-200 bg-white px-3 text-sm tabular-nums outline-none focus:border-amber-600 focus:ring-2 focus:ring-amber-600/20"
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                  Reason
                </span>
                <input
                  name="note"
                  required
                  maxLength={500}
                  placeholder="Damaged unit, miscount, returned to supplier"
                  className="h-10 w-full rounded-md border border-gray-200 bg-white px-3 text-sm outline-none focus:border-amber-600 focus:ring-2 focus:ring-amber-600/20"
                />
                <span className="block text-xs text-gray-500">
                  The difference is recorded against your name.
                </span>
              </label>

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </Button>
                <SubmitButton pendingLabel="Saving">Save count</SubmitButton>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
