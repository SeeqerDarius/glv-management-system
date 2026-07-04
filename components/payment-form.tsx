"use client";

import { useActionState, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { recordPayment, type PaymentFormState } from "@/actions/payments";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/accounts";

type AccountOption = {
  id: string;
  balance: number;
  dailyAmount: number;
  customer: {
    id: string;
    customerId: string;
    fullName: string;
  };
  product: {
    name: string;
  };
};

type PaymentFormProps = {
  accounts: AccountOption[];
  selectedCustomerId?: string;
  selectedAccountId?: string;
};

const initialState: PaymentFormState = {};

function FieldError({ message }: { message?: string }) {
  if (!message) return null;

  return <p className="text-sm text-red-700">{message}</p>;
}

export function PaymentForm({
  accounts,
  selectedCustomerId = "",
  selectedAccountId = "",
}: PaymentFormProps) {
  const [state, formAction, pending] = useActionState(
    recordPayment,
    initialState
  );
  const formRef = useRef<HTMLFormElement>(null);
  const preselectedAccount = accounts.find(
    (account) => account.id === selectedAccountId
  );
  const selectedCustomerExists = accounts.some(
    (account) => account.customer.id === selectedCustomerId
  );
  const initialCustomerId =
    preselectedAccount?.customer.id ||
    (selectedCustomerExists ? selectedCustomerId : "");
  const [customerId, setCustomerId] = useState(initialCustomerId);
  const [accountId, setAccountId] = useState(
    preselectedAccount ? selectedAccountId : ""
  );
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const selectedAccount = accounts.find((account) => account.id === accountId);
  const customers = Array.from(
    new Map(
      accounts.map((account) => [
        account.customer.id,
        {
          id: account.customer.id,
          fullName: account.customer.fullName,
        },
      ])
    ).values()
  ).sort((a, b) => a.fullName.localeCompare(b.fullName));
  const customerAccounts = customerId
    ? accounts.filter((account) => account.customer.id === customerId)
    : [];
  const paymentAmount = Number(amount);
  const balanceAfter =
    selectedAccount && Number.isFinite(paymentAmount)
      ? Math.max(selectedAccount.balance - paymentAmount, 0)
      : selectedAccount?.balance ?? 0;
  const creditAmount =
    selectedAccount && Number.isFinite(paymentAmount)
      ? Math.max(paymentAmount - selectedAccount.balance, 0)
      : 0;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (confirmed) {
      setConfirmed(false);
      return;
    }

    event.preventDefault();
    setConfirmOpen(true);
  }

  function confirmPayment() {
    setConfirmOpen(false);
    setConfirmed(true);
    window.setTimeout(() => {
      formRef.current?.requestSubmit();
    }, 0);
  }

  return (
    <form
      ref={formRef}
      action={formAction}
      onSubmit={handleSubmit}
      className="space-y-4 rounded-lg border bg-white p-5"
    >
      {state.errors?.form ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.errors.form}
        </p>
      ) : null}

      <label className="block space-y-1">
        <span className="text-sm font-medium text-gray-700">Customer</span>
        <select
          value={customerId}
          onChange={(event) => {
            setCustomerId(event.target.value);
            setAccountId("");
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
      </label>

      <label className="block space-y-1">
        <span className="text-sm font-medium text-gray-700">Account</span>
        <select
          name="accountId"
          value={accountId}
          onChange={(event) => setAccountId(event.target.value)}
          className="w-full rounded border p-3"
          disabled={!customerId}
          required
        >
          <option value="">
            {customerId ? "Select account" : "Select a customer first"}
          </option>
          {customerAccounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.product.name}
            </option>
          ))}
        </select>
        <FieldError message={state.errors?.accountId} />
      </label>

      <div className="space-y-1">
        <span className="text-sm font-medium text-gray-700">
          Account Balance
        </span>
        <div
          aria-live="polite"
          className="inline-flex min-h-11 w-full items-center justify-between rounded-md border border-lime-200 bg-lime-50 px-4 py-2 text-sm font-medium text-lime-950"
        >
          <span className="text-lime-800">Current balance</span>
          <span className="font-semibold tabular-nums">
            {selectedAccount ? formatMoney(selectedAccount.balance) : "-"}
          </span>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block space-y-1">
          <span className="text-sm font-medium text-gray-700">Amount</span>
          <input
            name="amount"
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
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
        <select
          name="method"
          value={method}
          onChange={(event) => setMethod(event.target.value)}
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

      {confirmOpen && selectedAccount ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-lg border bg-white p-5 shadow-xl">
            <h2 className="text-lg font-semibold text-gray-950">
              Confirm Payment
            </h2>
            <div className="mt-4 grid gap-3 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-gray-500">Customer</span>
                <span className="text-right font-medium text-gray-950">
                  {selectedAccount.customer.fullName}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-gray-500">Customer ID</span>
                <span className="text-right font-medium text-gray-950">
                  {selectedAccount.customer.customerId}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-gray-500">Product/account</span>
                <span className="text-right font-medium text-gray-950">
                  {selectedAccount.product.name}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-gray-500">Amount being paid</span>
                <span className="text-right font-medium text-gray-950">
                  {formatMoney(paymentAmount || 0)}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-gray-500">Payment method</span>
                <span className="text-right font-medium text-gray-950">
                  {method}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-gray-500">Balance before</span>
                <span className="text-right font-medium text-gray-950">
                  {formatMoney(selectedAccount.balance)}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-gray-500">Balance after</span>
                <span className="text-right font-medium text-gray-950">
                  {formatMoney(balanceAfter)}
                </span>
              </div>
              {creditAmount > 0 ? (
                <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-blue-950">
                  <div className="flex justify-between gap-4">
                    <span className="text-blue-700">Customer credit</span>
                    <span className="text-right font-semibold">
                      {formatMoney(creditAmount)}
                    </span>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={pending || confirmed}
                onClick={() => setConfirmOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={pending || confirmed}
                onClick={confirmPayment}
              >
                {pending || confirmed ? "Submitting..." : "Confirm Payment"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </form>
  );
}
