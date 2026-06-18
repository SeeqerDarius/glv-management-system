"use client";

import { useActionState } from "react";
import Link from "next/link";
import { recordPayment, type PaymentFormState } from "@/actions/payments";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/accounts";

type AccountOption = {
  id: string;
  balance: number;
  dailyAmount: number;
  customer: {
    customerId: string;
    fullName: string;
  };
  product: {
    name: string;
  };
};

type PaymentFormProps = {
  accounts: AccountOption[];
};

const initialState: PaymentFormState = {};

function FieldError({ message }: { message?: string }) {
  if (!message) return null;

  return <p className="text-sm text-red-700">{message}</p>;
}

export function PaymentForm({ accounts }: PaymentFormProps) {
  const [state, formAction, pending] = useActionState(
    recordPayment,
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
        <span className="text-sm font-medium text-gray-700">Account</span>
        <select name="accountId" className="w-full rounded border p-3" required>
          <option value="">Select account</option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.customer.fullName} - {account.customer.customerId} |{" "}
              {account.product.name} | Balance {formatMoney(account.balance)}
            </option>
          ))}
        </select>
        <FieldError message={state.errors?.accountId} />
      </label>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block space-y-1">
          <span className="text-sm font-medium text-gray-700">Amount</span>
          <input
            name="amount"
            type="number"
            min="0"
            step="0.01"
            className="w-full rounded border p-3"
            required
          />
          <FieldError message={state.errors?.amount} />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-gray-700">Payment Date</span>
          <input
            name="paymentDate"
            type="date"
            className="w-full rounded border p-3"
            required
          />
          <FieldError message={state.errors?.paymentDate} />
        </label>
      </div>

      <label className="block space-y-1">
        <span className="text-sm font-medium text-gray-700">Method</span>
        <select name="method" className="w-full rounded border p-3" required>
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
        <textarea name="notes" className="min-h-24 w-full rounded border p-3" />
      </label>

      <div className="flex gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Recording..." : "Record Payment"}
        </Button>
        <Button asChild type="button" variant="outline">
          <Link href="/payments">Cancel</Link>
        </Button>
      </div>
    </form>
  );
}
