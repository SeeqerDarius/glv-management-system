"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { createAccount, type AccountFormState } from "@/actions/accounts";
import { ProductImagePreview } from "@/components/product-image-preview";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/accounts";
import { todayDateInputValue } from "@/lib/date-rules";

type CustomerOption = {
  id: string;
  customerId: string;
  fullName: string;
  staff: {
    id: string;
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
  imageUrl?: string | null;
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
  const [selectedProductId, setSelectedProductId] = useState("");
  const selectedCustomerExists = customers.some(
    (customer) => customer.id === selectedCustomerId
  );
  const [customerId, setCustomerId] = useState(
    selectedCustomerExists ? selectedCustomerId : ""
  );
  const selectedCustomer = customers.find((customer) => customer.id === customerId);
  const availableProducts = selectedCustomer ? products : [];
  const selectedProduct = products.find(
    (product) => product.id === selectedProductId
  );
  const today = todayDateInputValue();

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
          value={customerId}
          onChange={(event) => {
            setCustomerId(event.target.value);
            setSelectedProductId("");
          }}
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
        {selectedCustomer ? (
          <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
            <p className="font-medium text-gray-950">
              Assigned staff: {selectedCustomer.staff.fullName}
            </p>
            <p className="mt-0.5 text-xs text-gray-600">
              Staff code: {selectedCustomer.staff.code} | Customer ID:{" "}
              {selectedCustomer.customerId}
            </p>
          </div>
        ) : null}
        <FieldError message={state.errors?.customerId} />
      </label>

      <label className="block space-y-1">
        <span className="text-sm font-medium text-gray-700">Product</span>
        <select
          name="productId"
          value={selectedProductId}
          onChange={(event) => setSelectedProductId(event.target.value)}
          className="w-full rounded border p-3"
          disabled={!selectedCustomer}
          required
        >
          <option value="">
            {selectedCustomer
              ? "Select product"
              : "Select customer first"}
          </option>
          {availableProducts.map((product) => (
            <option key={product.id} value={product.id}>
              {product.name} - {product.category} |{" "}
              {formatMoney(product.layawayPrice)} |{" "}
              {formatMoney(product.dailyAmount)}/day | {product.duration} days
            </option>
          ))}
        </select>
        {selectedProduct ? (
          <div className="grid gap-3 rounded-md border border-lime-200 bg-lime-50 p-3 text-sm sm:grid-cols-[minmax(12rem,18rem)_minmax(0,1fr)]">
            <ProductImagePreview
              src={selectedProduct.imageUrl}
              alt={selectedProduct.name}
              className="h-48 w-full rounded-lg bg-white sm:h-56"
              iconClassName="size-12"
              imageClassName="object-contain"
              previewTitle={selectedProduct.name}
            />
            <div className="min-w-0 self-center">
              <p className="truncate font-semibold text-gray-950">
                {selectedProduct.name}
              </p>
              <p className="mt-0.5 text-xs text-gray-600">
                {selectedProduct.category} | {formatMoney(selectedProduct.layawayPrice)} |{" "}
                {formatMoney(selectedProduct.dailyAmount)}/day
              </p>
              {selectedProduct.imageUrl ? (
                <p className="mt-2 text-xs font-medium text-green-700">
                  Click the picture to preview it full size.
                </p>
              ) : null}
            </div>
          </div>
        ) : null}
        <FieldError message={state.errors?.productId} />
      </label>

      <label className="block space-y-1">
        <span className="text-sm font-medium text-gray-700">Start Date</span>
        <input
          name="startDate"
          type="date"
          max={today}
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
              max={today}
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
            defaultValue="Cash"
            className="w-full rounded border bg-white p-3"
            required={Boolean(firstPaymentAmount)}
          >
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
