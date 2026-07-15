"use client";

import { useMemo, useState } from "react";
import { PackageSearch } from "lucide-react";
import { updateAccountProduct } from "@/actions/accounts";
import { PasswordInput } from "@/components/password-input";
import { ProductImagePreview } from "@/components/product-image-preview";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/accounts";

type ProductOption = {
  id: string;
  name: string;
  category: string;
  layawayPrice: number;
  dailyAmount: number;
  duration: number;
  imageUrl?: string | null;
};

type AccountProductCorrectionFormProps = {
  accountId: string;
  currentProductId: string;
  currentProductName: string;
  products: ProductOption[];
  totalPaid: number;
  returnTo: string;
  showLabel?: boolean;
};

export function AccountProductCorrectionForm({
  accountId,
  currentProductId,
  currentProductName,
  products,
  totalPaid,
  returnTo,
  showLabel = false,
}: AccountProductCorrectionFormProps) {
  const [open, setOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState("");
  const selectedProduct = useMemo(
    () => products.find((product) => product.id === selectedProductId),
    [products, selectedProductId]
  );
  const nextBalance = selectedProduct
    ? Math.max(selectedProduct.layawayPrice - totalPaid, 0)
    : null;

  return (
    <>
      <button
        type="button"
        aria-label={`Correct product for ${currentProductName} account`}
        title="Correct product"
        onClick={() => setOpen(true)}
        className={
          showLabel
            ? "group/product flex h-8 items-center gap-2 rounded-md px-2 text-sm font-medium text-gray-600 transition-all duration-150 hover:bg-blue-50 hover:text-blue-700"
            : "group/product flex size-8 items-center justify-center rounded-md text-gray-400 transition-all duration-150 hover:bg-blue-50 hover:text-blue-700"
        }
      >
        <PackageSearch className="size-4 transition-transform duration-200 group-hover/product:scale-125 group-hover/product:-rotate-6" />
        {showLabel ? <span>Correct product</span> : null}
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-lg border bg-white p-5 shadow-xl">
            <h2 className="text-lg font-semibold text-gray-950">
              Correct account product
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              Payments already recorded on this account will stay attached to
              the account and count toward the selected product.
            </p>

            <form action={updateAccountProduct} className="mt-4 space-y-4">
              <input type="hidden" name="id" value={accountId} />
              <input type="hidden" name="returnTo" value={returnTo} />

              <div className="rounded-md border bg-gray-50 p-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-gray-500">Current product</span>
                  <span className="font-medium text-gray-950">
                    {currentProductName}
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <span className="text-gray-500">Payments retained</span>
                  <span className="font-medium text-gray-950">
                    {formatMoney(totalPaid)}
                  </span>
                </div>
              </div>

              <label className="block space-y-1">
                <span className="text-sm font-medium text-gray-700">
                  Correct product
                </span>
                <select
                  name="productId"
                  value={selectedProductId}
                  onChange={(event) => setSelectedProductId(event.target.value)}
                  className="w-full rounded border p-3"
                  required
                >
                  <option value="">Select product</option>
                  {products
                    .filter((product) => product.id !== currentProductId)
                    .map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name} - {product.category} |{" "}
                        {formatMoney(product.layawayPrice)}
                      </option>
                    ))}
                </select>
              </label>

              {selectedProduct ? (
                <div className="rounded-md border border-blue-100 bg-blue-50 p-3 text-sm text-blue-950">
                  <div className="mb-3 flex items-center gap-3">
                    <ProductImagePreview
                      src={selectedProduct.imageUrl}
                      alt={selectedProduct.name}
                      className="size-14 bg-white"
                      previewTitle={selectedProduct.name}
                    />
                    <div className="min-w-0">
                      <p className="truncate font-semibold">
                        {selectedProduct.name}
                      </p>
                      <p className="text-xs text-blue-700">
                        {selectedProduct.category}
                      </p>
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div>
                      <p className="text-blue-700">New target</p>
                      <p className="font-semibold">
                        {formatMoney(selectedProduct.layawayPrice)}
                      </p>
                    </div>
                    <div>
                      <p className="text-blue-700">Daily amount</p>
                      <p className="font-semibold">
                        {formatMoney(selectedProduct.dailyAmount)}
                      </p>
                    </div>
                    <div>
                      <p className="text-blue-700">New balance</p>
                      <p className="font-semibold">
                        {formatMoney(nextBalance ?? 0)}
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}

              <label className="block space-y-1">
                <span className="text-sm font-medium text-gray-700">
                  Super admin password
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
                <Button type="submit">Correct product</Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
