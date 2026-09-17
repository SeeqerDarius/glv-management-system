import { PackageCheck } from "lucide-react";
import { confirmProcurement } from "@/actions/procurement";
import { PlainSubmitButton } from "@/components/ui/plain-submit-button";

type ProcurementConfirmFormProps = {
  productId: string;
  /** Units still waiting to be bought for this product. */
  maxQuantity: number;
  returnTo: string;
  /** Compact fits inside a table row; stacked suits a page header card. */
  layout?: "compact" | "stacked";
};

/**
 * Confirms how many units of a product were actually bought. Confirmed units
 * drop off the procurement list, so a partial purchase only reduces the
 * outstanding count.
 */
export function ProcurementConfirmForm({
  productId,
  maxQuantity,
  returnTo,
  layout = "compact",
}: ProcurementConfirmFormProps) {
  if (maxQuantity < 1) {
    return null;
  }

  const inputId = `procured-quantity-${productId}`;

  return (
    <form
      action={confirmProcurement}
      className={
        layout === "stacked"
          ? "flex flex-wrap items-end gap-3"
          : "flex items-center justify-end gap-2"
      }
    >
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <label
        htmlFor={inputId}
        className={layout === "stacked" ? "space-y-1.5" : "sr-only"}
      >
        {layout === "stacked" ? (
          <span className="block text-xs font-semibold uppercase tracking-wide text-gray-600">
            Quantity bought
          </span>
        ) : (
          "Quantity bought"
        )}
        <input
          id={inputId}
          name="quantity"
          type="number"
          min={1}
          max={maxQuantity}
          step={1}
          defaultValue={maxQuantity}
          required
          aria-describedby={`${inputId}-hint`}
          className="h-9 w-20 rounded-md border border-gray-200 bg-white px-2 text-right text-sm tabular-nums outline-none focus:border-green-600 focus:ring-2 focus:ring-green-600/20"
        />
      </label>
      <PlainSubmitButton
        pendingLabel="Confirming"
        className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-green-800 px-3 text-sm font-medium text-white hover:bg-green-900"
      >
        <PackageCheck className="size-4" />
        Confirm procured
      </PlainSubmitButton>
      <p id={`${inputId}-hint`} className="sr-only">
        Up to {maxQuantity} unit{maxQuantity === 1 ? "" : "s"} can be confirmed
        for this product. Confirmed units leave the procurement list.
      </p>
    </form>
  );
}
