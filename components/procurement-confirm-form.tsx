"use client";

import { useState } from "react";
import { PackageCheck } from "lucide-react";
import { confirmProcurement } from "@/actions/procurement";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";

type ProcurementConfirmFormProps = {
  productId: string;
  productName: string;
  /** Units still waiting to be bought for this product. */
  maxQuantity: number;
  returnTo: string;
};

/**
 * Confirms how many units of a product were actually bought, so the
 * procurement list reduces by that quantity.
 *
 * The quantity lives in a dialog rather than inline in the table row: a number
 * box and a button in every row of an already dense table added a column,
 * widened the table and buried the figures the list exists to show.
 *
 * The trigger carries a visible "Confirm" label rather than being a bare icon.
 * An unlabelled icon sitting beside the view icon was not findable — the first
 * question asked of it was where the control actually was.
 */
export function ProcurementConfirmForm({
  productId,
  productName,
  maxQuantity,
  returnTo,
}: ProcurementConfirmFormProps) {
  const [open, setOpen] = useState(false);

  if (maxQuantity < 1) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Confirm procured units for ${productName}`}
        title="Confirm how many units you bought"
        className="inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border border-green-700/25 bg-lime-50 px-2.5 text-xs font-semibold text-green-800 transition-colors hover:border-green-700/50 hover:bg-lime-100"
      >
        <PackageCheck className="size-3.5" />
        Confirm
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-lg border bg-white p-5 text-left shadow-xl">
            <h2 className="text-lg font-semibold text-gray-950">
              How many did you buy?
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              {productName} &middot; {maxQuantity} outstanding
            </p>

            <form action={confirmProcurement} className="mt-4 space-y-4">
              <input type="hidden" name="productId" value={productId} />
              <input type="hidden" name="returnTo" value={returnTo} />

              <label className="block space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                  Quantity procured
                </span>
                <input
                  name="quantity"
                  type="number"
                  min={1}
                  max={maxQuantity}
                  step={1}
                  defaultValue={maxQuantity}
                  required
                  autoFocus
                  className="h-10 w-full rounded-md border border-gray-200 bg-white px-3 text-sm tabular-nums outline-none focus:border-green-700 focus:ring-2 focus:ring-green-700/20"
                />
                <span className="block text-xs text-gray-500">
                  That many units leave the procurement list.
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
                <SubmitButton pendingLabel="Confirming">Confirm</SubmitButton>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
