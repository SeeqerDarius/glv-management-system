"use client";

import { useActionState } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import type { Product } from "@prisma/client";
import type { ProductFormState } from "@/actions/products";
import { Button } from "@/components/ui/button";
import { GlvLoading } from "@/components/glv-loading";

const categories = [
  "Refrigerators",
  "Air Conditioners",
  "TVs",
  "Fans",
  "Phones",
  "Rice Cookers",
  "Blenders",
  "Home Appliances",
];

type ProductFormProps = {
  action: (
    state: ProductFormState,
    formData: FormData
  ) => Promise<ProductFormState>;
  product?: Product;
  submitLabel: string;
};

const initialState: ProductFormState = {};

function FieldError({ message }: { message?: string }) {
  if (!message) return null;

  return <p className="text-sm text-red-700">{message}</p>;
}

export function ProductForm({
  action,
  product,
  submitLabel,
}: ProductFormProps) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-4 rounded-lg border bg-white p-5">
      {product ? <input type="hidden" name="id" value={product.id} /> : null}
      {state.duplicateWarning ? <input type="hidden" name="confirmDuplicate" value="true" /> : null}

      {state.duplicateWarning ? (
        <div className="flex gap-3 rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          <AlertTriangle className="mt-0.5 size-5 shrink-0" />
          <div><p className="font-semibold">Possible duplicate found</p><p className="mt-1">{state.duplicateWarning}</p></div>
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
          {categories.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
        <FieldError message={state.errors?.category} />
      </label>

      <div className="grid gap-4 md:grid-cols-2">
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
      </div>

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
          <span className="text-sm font-medium text-gray-700">Cash Price</span>
          <input
            name="cashPrice"
            type="number"
            min="0"
            step="0.01"
            defaultValue={product?.cashPrice ?? ""}
            className="w-full rounded border p-3"
            required
          />
          <FieldError message={state.errors?.cashPrice} />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-gray-700">
            Layaway Price
          </span>
          <input
            name="layawayPrice"
            type="number"
            min="0"
            step="0.01"
            defaultValue={product?.layawayPrice ?? ""}
            className="w-full rounded border p-3"
            required
          />
          <FieldError message={state.errors?.layawayPrice} />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-gray-700">
            Daily Amount
          </span>
          <input
            name="dailyAmount"
            type="number"
            min="0"
            step="0.01"
            defaultValue={product?.dailyAmount ?? ""}
            className="w-full rounded border p-3"
            required
          />
          <FieldError message={state.errors?.dailyAmount} />
        </label>
      </div>

      <label className="block space-y-1">
        <span className="text-sm font-medium text-gray-700">Duration Days</span>
        <input
          name="duration"
          type="number"
          min="1"
          step="1"
          defaultValue={product?.duration ?? 184}
          className="w-full rounded border p-3"
          required
        />
        <FieldError message={state.errors?.duration} />
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
          {pending ? <GlvLoading compact label="Saving" /> : state.duplicateWarning ? "Add Anyway" : submitLabel}
        </Button>
        <Button asChild type="button" variant="outline">
          <Link href="/products">Cancel</Link>
        </Button>
      </div>
    </form>
  );
}
