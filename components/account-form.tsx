"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { createAccount, type AccountFormState } from "@/actions/accounts";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/accounts";

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
  const [firstPaymentAmount, setFirstPaymentAmount] = useState("");

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
              {product.name} - {product.category} |{" "}
              {formatMoney(product.layawayPrice)} |{" "}
              {formatMoney(product.dailyAmount)}/day | {product.duration} days
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

      <div className="space-y-4 rounded-lg border border-lime-200 bg-lime-50 p-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-950">
            First Payment
          </h2>
          <p className="mt-1 text-xs text-gray-600">
            Record the first payment while opening this account, or leave it
            blank to start with no payment.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block space-y-1">
            <span className="text-sm font-medium text-gray-700">Amount</span>
            <input
              name="amount"
              type="number"
              min="0"
              step="0.01"
              value={firstPaymentAmount}
              onChange={(event) => setFirstPaymentAmount(event.target.value)}
              className="w-full rounded border bg-white p-3"
            />
            <FieldError message={state.errors?.amount} />
          </label>

          <label className="block space-y-1">
            <span className="text-sm font-medium text-gray-700">
              Payment Date
            </span>
            <input
              name="paymentDate"
              type="date"
              className="w-full rounded border bg-white p-3"
              required={Boolean(firstPaymentAmount)}
            />
            <FieldError message={state.errors?.paymentDate} />
          </label>
        </div>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-gray-700">Method</span>
          <select
            name="method"
            className="w-full rounded border bg-white p-3"
            required={Boolean(firstPaymentAmount)}
          >
            <option value="">Select method</option>
            <option value="Cash">Cash</option>
            <option value="Mobile Money">Mobile Money</option>
            <option value="Bank Transfer">Bank Transfer</option>
            <option value="Cheque">Cheque</option>
          </select>
          <FieldError message={state.errors?.method} />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-gray-700">Notes</span>
          <textarea
            name="notes"
            className="min-h-20 w-full rounded border bg-white p-3"
          />
        </label>
      </div>

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
