"use client";

import { useState } from "react";
import { generateCustomerDocument } from "@/actions/customer-documents";
import { Button } from "@/components/ui/button";

type AccountOption = {
  id: string;
  productName: string;
  totalPaid: number;
  balance: number;
  status: string;
};

type CustomerOption = {
  id: string;
  customerId: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  accounts: AccountOption[];
};

function money(value: number) {
  return new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency: "GHS",
  }).format(value);
}

export function CustomerDocumentGenerator({
  customers,
}: {
  customers: CustomerOption[];
}) {
  const [customerId, setCustomerId] = useState("");
  const [accountId, setAccountId] = useState("");
  const customer = customers.find((item) => item.id === customerId);
  const account = customer?.accounts.find((item) => item.id === accountId);

  return (
    <form
      action={generateCustomerDocument}
      className="space-y-5 rounded-lg border border-lime-200 bg-lime-50 p-5"
    >
      <div>
        <h2 className="text-lg font-semibold text-gray-950">
          Generate Customer Terms and Conditions
        </h2>
        <p className="text-sm text-gray-600">
          Select the customer and account. Their live database information will
          fill the addressed terms automatically.
        </p>
      </div>

      <input type="hidden" name="kind" value="TERMS" />
      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1">
          <span className="text-sm font-medium">Customer</span>
          <select
            value={customerId}
            onChange={(event) => {
              setCustomerId(event.target.value);
              setAccountId("");
            }}
            className="w-full rounded border bg-white p-3"
            required
          >
            <option value="">Select customer</option>
            {customers.map((item) => (
              <option key={item.id} value={item.id}>
                {item.fullName} ({item.customerId})
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1">
          <span className="text-sm font-medium">Customer account</span>
          <select
            name="accountId"
            value={accountId}
            onChange={(event) => setAccountId(event.target.value)}
            disabled={!customer}
            className="w-full rounded border bg-white p-3 disabled:bg-gray-100"
            required
          >
            <option value="">
              {customer ? "Select account" : "Select customer first"}
            </option>
            {customer?.accounts.map((item) => (
              <option key={item.id} value={item.id}>
                {item.productName} — {item.status}
              </option>
            ))}
          </select>
        </label>

      </div>

      {customer ? (
        <div className="grid gap-3 rounded-md border bg-white p-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div><span className="text-gray-500">Customer</span><p className="font-medium">{customer.fullName}</p></div>
          <div><span className="text-gray-500">Phone</span><p className="font-medium">{customer.phone || "Not provided"}</p></div>
          <div><span className="text-gray-500">Email</span><p className="font-medium">{customer.email || "Not provided"}</p></div>
          <div><span className="text-gray-500">Account</span><p className="font-medium">{account?.productName || "Select an account"}</p></div>
          {account ? (
            <>
              <div><span className="text-gray-500">Total paid</span><p className="font-medium">{money(account.totalPaid)}</p></div>
              <div><span className="text-gray-500">Balance</span><p className="font-medium">{money(account.balance)}</p></div>
              <div><span className="text-gray-500">Status</span><p className="font-medium">{account.status}</p></div>
            </>
          ) : null}
        </div>
      ) : null}

      <Button type="submit" disabled={!account}>
        Generate Addressed Terms
      </Button>
    </form>
  );
}
