"use client";

import { useState } from "react";
import { PackagePlus } from "lucide-react";
import { receiveStock } from "@/actions/inventory";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";

type InventoryReceiveFormProps = {
  productId: string;
  productName: string;
  /** Units the product currently holds, shown so the operator sees the effect. */
  stockOnHand: number;
  /** Units still to buy, used as the default so the common case is one click. */
  suggestedQuantity?: number;
  returnTo: string;
  /** `chip` for a dense table row, `button` for a page-level action. */
  variant?: "chip" | "button";
};

/**
 * Books bought units into stock.
 *
 * The quantity lives in a dialog rather than inline: a number box in every row
 * of an already dense table adds a column, widens the table, and buries the
 * figures the list exists to show.
 */
export function InventoryReceiveForm({
  productId,
  productName,
  stockOnHand,
  suggestedQuantity,
  returnTo,
  variant = "chip",
}: InventoryReceiveFormProps) {
  const [open, setOpen] = useState(false);
  const defaultQuantity =
    suggestedQuantity && suggestedQuantity > 0 ? suggestedQuantity : 1;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Receive stock for ${productName}`}
        title="Receive stock"
        className={
          variant === "button"
            ? "inline-flex items-center gap-1.5 rounded-lg bg-[#123824] px-4 py-2 text-sm font-medium text-lime-400 transition hover:bg-[#1a4f33]"
            : "inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border border-green-700/25 bg-lime-50 px-2.5 text-xs font-semibold text-green-800 transition-colors hover:border-green-700/50 hover:bg-lime-100"
        }
      >
        <PackagePlus className={variant === "button" ? "size-4" : "size-3.5"} />
        Receive
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-lg border bg-white p-5 text-left shadow-xl">
            <h2 className="text-lg font-semibold text-gray-950">
              How many did you buy?
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              {productName} &middot; {stockOnHand} in stock now
            </p>

            <form action={receiveStock} className="mt-4 space-y-4">
              <input type="hidden" name="productId" value={productId} />
              <input type="hidden" name="returnTo" value={returnTo} />

              <label className="block space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                  Quantity received
                </span>
                <input
                  name="quantity"
                  type="number"
                  min={1}
                  step={1}
                  defaultValue={defaultQuantity}
                  required
                  autoFocus
                  className="h-10 w-full rounded-md border border-gray-200 bg-white px-3 text-sm tabular-nums outline-none focus:border-green-700 focus:ring-2 focus:ring-green-700/20"
                />
                <span className="block text-xs text-gray-500">
                  These units go into stock and leave the procurement list.
                </span>
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                  Note <span className="font-normal normal-case">(optional)</span>
                </span>
                <input
                  name="note"
                  maxLength={500}
                  placeholder="Supplier, invoice number, anything worth remembering"
                  className="h-10 w-full rounded-md border border-gray-200 bg-white px-3 text-sm outline-none focus:border-green-700 focus:ring-2 focus:ring-green-700/20"
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
                <SubmitButton pendingLabel="Saving">Receive</SubmitButton>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
