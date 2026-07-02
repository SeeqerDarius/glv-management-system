"use client";

import { useActionState } from "react";
import Link from "next/link";
import { createAccount, type AccountFormState } from "@/actions/accounts";
import { Button } from "@/components/ui/button";

type CustomerOption = {
  id: string;
  customerId: string;
  fullName: string;
  staff: {
    code: string;
    fullName: string;
  };
};

type ProductOption = {
  id: string;
  name: string;
  category: string;
  layawayPrice: number;
  dailyAmount: number;
  duration: number;
};

type AccountFormProps = {
  customers: CustomerOption[];
  products: ProductOption[];
  selectedCustomerId?: string;
};

const initialState: AccountFormState = {};

function FieldError({ message }: { message?: string }) {
  if (!message) return null;

  return <p className="text-sm text-red-700">{message}</p>;
}

export function AccountForm({
  customers,
  products,
  selectedCustomerId = "",
}: AccountFormProps) {
  const [state, formAction, pending] = useActionState(
    createAccount,
    initialState
  );

  return (
    <form action={formAction} className="space-y-4 rounded-lg border bg-white p-5">
      {state.errors?.form ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.errors.form}
        </p>
      ) : null}

      <label className="block space-y-1">
        <span className="text-sm font-medium text-gray-700">Customer</span>
        <select
          name="customerId"
          defaultValue={selectedCustomerId}
          className="w-full rounded border p-3"
          required
        >
          <option value="">Select customer</option>
          {customers.map((customer) => (
            <option key={customer.id} value={customer.id}>
              {customer.fullName}
            </option>
          ))}
        </select>
        <FieldError message={state.errors?.customerId} />
      </label>

      <label className="block space-y-1">
        <span className="text-sm font-medium text-gray-700">Product</span>
        <select name="productId" className="w-full rounded border p-3" required>
          <option value="">Select product</option>
          {products.map((product) => (
            <option key={product.id} value={product.id}>
              {product.name} - {product.category} | GHS{" "}
              {product.layawayPrice.toFixed(2)} | GHS{" "}
              {product.dailyAmount.toFixed(2)}/day | {product.duration} days
            </option>
          ))}
        </select>
        <FieldError message={state.errors?.productId} />
      </label>

      <label className="block space-y-1">
        <span className="text-sm font-medium text-gray-700">Start Date</span>
        <input
          name="startDate"
          type="date"
          className="w-full rounded border p-3"
          required
        />
        <FieldError message={state.errors?.startDate} />
      </label>

      <div className="flex gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Creating..." : "Create Account"}
        </Button>
        <Button asChild type="button" variant="outline">
          <Link href="/accounts">Cancel</Link>
        </Button>
      </div>
    </form>
  );
}
