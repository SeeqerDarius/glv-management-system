"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  updatePayment,
  type PaymentEditFormState,
} from "@/actions/payments";
import { Button } from "@/components/ui/button";
import { todayDateInputValue } from "@/lib/date-rules";

type PaymentEditFormProps = {
  payment: {
    id: string;
    receiptNo: string;
    amount: number;
    paymentDate: string;
    method: string;
    notes: string;
    accountId: string;
  };
};

const initialState: PaymentEditFormState = {};

function FieldError({ message }: { message?: string }) {
  if (!message) return null;

  return <p className="text-sm text-red-700">{message}</p>;
}

export function PaymentEditForm({ payment }: PaymentEditFormProps) {
  const [state, formAction, pending] = useActionState(
    updatePayment,
    initialState
  );
  const today = todayDateInputValue();

  return (
    <form action={formAction} className="space-y-4 rounded-lg border bg-white p-5">
      <input type="hidden" name="id" value={payment.id} />

      {state.errors?.form ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.errors.form}
        </p>
      ) : null}

      <div className="rounded-md border bg-gray-50 px-3 py-2 text-sm text-gray-700">
        Receipt <span className="font-semibold text-gray-950">{payment.receiptNo}</span>
      </div>

      <label className="block space-y-1">
        <span className="text-sm font-medium text-gray-700">Amount</span>
        <input
          name="amount"
          type="number"
          min="0"
          step="0.01"
          defaultValue={payment.amount}
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
          defaultValue={payment.paymentDate}
          max={today}
          className="w-full rounded border p-3"
          required
        />
        <FieldError message={state.errors?.paymentDate} />
      </label>

      <label className="block space-y-1">
        <span className="text-sm font-medium text-gray-700">Method</span>
        <select
          name="method"
          defaultValue={payment.method}
          className="w-full rounded border p-3"
          required
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
          defaultValue={payment.notes}
          className="min-h-24 w-full rounded border p-3"
        />
      </label>

      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving..." : "Save Changes"}
        </Button>
        <Button asChild type="button" variant="outline">
          <Link href={`/accounts/${payment.accountId}`}>Cancel</Link>
        </Button>
      </div>
    </form>
  );
}
