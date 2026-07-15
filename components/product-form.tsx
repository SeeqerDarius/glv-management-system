"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import type { Product } from "@prisma/client";
import type { ProductFormState } from "@/actions/products";
import { Button } from "@/components/ui/button";
import { GlvLoading } from "@/components/glv-loading";
import { ProductImage } from "@/components/product-image";
import { productCategories } from "@/lib/product-categories";

type ProductFormProps = {
  action: (
    state: ProductFormState,
    formData: FormData
  ) => Promise<ProductFormState>;
  product?: Product;
  submitLabel: string;
  defaultDailyAmount?: number;
  defaultDuration?: number;
};

const initialState: ProductFormState = {};

function FieldError({ message }: { message?: string }) {
  if (!message) return null;

  return <p className="text-sm text-red-700">{message}</p>;
}

function money(value: number) {
  if (!Number.isFinite(value)) return "GHS 0.00";
  return `GHS ${value.toFixed(2)}`;
}

export function ProductForm({
  action,
  product,
  submitLabel,
  defaultDailyAmount = 0,
  defaultDuration = 184,
}: ProductFormProps) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const [dailyAmount, setDailyAmount] = useState(
    product?.dailyAmount ?? defaultDailyAmount
  );
  const [duration, setDuration] = useState(product?.duration ?? defaultDuration);

  const calculatedLayawayPrice = useMemo(() => {
    return dailyAmount * duration;
  }, [dailyAmount, duration]);

  return (
    <form
      action={formAction}
      encType="multipart/form-data"
      className="space-y-4 rounded-lg border bg-white p-5"
    >
      {product ? <input type="hidden" name="id" value={product.id} /> : null}
      {state.duplicateWarning ? (
        <input type="hidden" name="confirmDuplicate" value="true" />
      ) : null}

      {state.duplicateWarning ? (
        <div className="flex gap-3 rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          <AlertTriangle className="mt-0.5 size-5 shrink-0" />
          <div>
            <p className="font-semibold">Possible duplicate found</p>
            <p className="mt-1">{state.duplicateWarning}</p>
          </div>
        </div>
      ) : null}

      {state.errors?.form ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.errors.form}
        </p>
      ) : null}

      <label className="block space-y-1">
        <span className="text-sm font-medium text-gray-700">Product Name</span>
        <input
          name="name"
          defaultValue={product?.name ?? ""}
          className="w-full rounded border p-3"
          required
        />
        <FieldError message={state.errors?.name} />
      </label>

      <div className="space-y-2 rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4">
        <div className="flex items-start gap-3">
          <ProductImage
            src={product?.imageUrl}
            alt={product?.name ?? "Product image placeholder"}
            className="size-16 bg-white"
            iconClassName="size-7"
          />
          <div className="min-w-0 flex-1 space-y-2">
            <div>
              <p className="text-sm font-medium text-gray-800">Product Picture</p>
              <p className="mt-0.5 text-xs text-gray-500">
                Upload a clear product image for staff to recognize it during selection.
              </p>
            </div>
            <input
              name="image"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="block w-full rounded border bg-white p-2 text-sm"
            />
            {product?.imageUrl ? (
              <label className="flex items-center gap-2 text-xs font-medium text-gray-600">
                <input type="checkbox" name="removeImage" className="size-4" />
                Remove current picture
              </label>
            ) : null}
            <FieldError message={state.errors?.image} />
          </div>
        </div>
      </div>

      <label className="block space-y-1">
        <span className="text-sm font-medium text-gray-700">Description</span>
        <textarea
          name="description"
          defaultValue={product?.description ?? ""}
          className="min-h-24 w-full rounded border p-3"
          placeholder="Product specification or procurement notes"
        />
      </label>

      <label className="block space-y-1">
        <span className="text-sm font-medium text-gray-700">Category</span>
        <select
          name="category"
          defaultValue={product?.category ?? ""}
          className="w-full rounded border p-3"
          required
        >
          <option value="">Select category</option>
          {productCategories.map((category) => (
            <option key={category.label} value={category.label}>
              {category.label}
            </option>
          ))}
        </select>
        <FieldError message={state.errors?.category} />
      </label>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block space-y-1">
          <span className="text-sm font-medium text-gray-700">Cost Price</span>
          <input
            name="costPrice"
            type="number"
            min="0"
            step="0.01"
            defaultValue={product?.costPrice ?? ""}
            className="w-full rounded border p-3"
            required
          />
          <FieldError message={state.errors?.costPrice} />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-gray-700">Transport Cost</span>
          <input
            name="transportCost"
            type="number"
            min="0"
            step="0.01"
            defaultValue={product?.transportCost ?? 0}
            className="w-full rounded border p-3"
            required
          />
          <FieldError message={state.errors?.transportCost} />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block space-y-1">
          <span className="text-sm font-medium text-gray-700">Daily Amount</span>
          <input
            name="dailyAmount"
            type="number"
            min="0"
            step="0.01"
            defaultValue={product?.dailyAmount ?? defaultDailyAmount}
            className="w-full rounded border p-3"
            required
            onChange={(event) => setDailyAmount(Number(event.target.value))}
          />
          <FieldError message={state.errors?.dailyAmount} />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-gray-700">Duration Days</span>
          <input
            name="duration"
            type="number"
            min="1"
            step="1"
            defaultValue={product?.duration ?? defaultDuration}
            className="w-full rounded border p-3"
            required
            onChange={(event) => setDuration(Number(event.target.value))}
          />
          <FieldError message={state.errors?.duration} />
        </label>
      </div>

      <div className="rounded-md border border-lime-200 bg-lime-50 p-4">
        <p className="text-sm font-medium text-lime-950">
          Layaway Price is calculated automatically.
        </p>
        <p className="mt-1 text-sm text-lime-800">
          {money(dailyAmount)} × {duration || 0} days ={" "}
          <span className="font-semibold">{money(calculatedLayawayPrice)}</span>
        </p>
      </div>

      <label className="block space-y-1">
        <span className="text-sm font-medium text-gray-700">Quantity On Sale</span>
        <input
          name="quantityOnSale"
          type="number"
          min="0"
          step="1"
          defaultValue={product?.quantityOnSale ?? 0}
          className="w-full rounded border p-3"
          required
        />
        <FieldError message={state.errors?.quantityOnSale} />
      </label>

      <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
        <input
          type="checkbox"
          name="active"
          defaultChecked={product?.active ?? true}
          className="size-4"
        />
        Active
      </label>

      <div className="flex gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? (
            <GlvLoading compact label="Saving" />
          ) : state.duplicateWarning ? (
            "Add Anyway"
          ) : (
            submitLabel
          )}
        </Button>

        <Button asChild type="button" variant="outline">
          <Link href="/products">Cancel</Link>
        </Button>
      </div>
    </form>
  );
}
