"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { useState } from "react";
import { useActionState } from "react";
import type { CustomerFormState } from "@/actions/customers";
import { Button } from "@/components/ui/button";
import { GlvLoading } from "@/components/glv-loading";
import { ProductImagePreview } from "@/components/product-image-preview";
import { formatMoney } from "@/lib/accounts";
import { todayDateInputValue } from "@/lib/date-rules";

type StaffOption = { id: string; fullName: string; code: string };
type ProductOption = {
  id: string;
  name: string;
  category: string;
  layawayPrice: number;
  dailyAmount: number;
  duration: number;
  imageUrl?: string | null;
  staffInventory: Array<{
    staffId: string;
    quantity: number;
  }>;
};
type ExistingCustomerOption = {
  id: string;
  fullName: string;
  customerId: string;
};

function normalizeName(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

export function CustomerForm({ action, staff, products, existingCustomers, canAssignStaff, currentStaffId }: {
  action: (state: CustomerFormState, formData: FormData) => Promise<CustomerFormState>;
  staff: StaffOption[];
  products: ProductOption[];
  existingCustomers: ExistingCustomerOption[];
  canAssignStaff: boolean;
  currentStaffId?: string | null;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [fullName, setFullName] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedStaffId, setSelectedStaffId] = useState("");
  const [firstPaymentAmount, setFirstPaymentAmount] = useState("");
  const inventoryStaffId = canAssignStaff ? selectedStaffId : currentStaffId;
  const availableProducts = inventoryStaffId
    ? products
        .map((product) => ({
          ...product,
          staffQuantity:
            product.staffInventory.find(
              (inventory) => inventory.staffId === inventoryStaffId
            )?.quantity ?? 0,
        }))
        .filter((product) => product.staffQuantity > 0)
    : [];
  const selectedProduct = availableProducts.find(
    (product) => product.id === selectedProductId
  );
  const today = todayDateInputValue();
  const normalizedFullName = normalizeName(fullName);
  const existingNameMatch =
    normalizedFullName.length > 0
      ? existingCustomers.find(
          (customer) => normalizeName(customer.fullName) === normalizedFullName
        )
      : null;
  const submitLabel = selectedProduct
    ? "Create Customer & Account"
    : "Create Customer";

  return (
    <form action={formAction} className="space-y-4 rounded-lg border bg-white p-5">
      {state.errors?.form ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.errors.form}
        </p>
      ) : null}

      {state.duplicateWarning ? (
        <div className="flex gap-3 rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          <AlertTriangle className="mt-0.5 size-5 shrink-0" />
          <div><p className="font-semibold">Possible duplicate found</p><p className="mt-1">{state.duplicateWarning}</p></div>
        </div>
      ) : null}
      {state.duplicateWarning ? <input type="hidden" name="confirmDuplicate" value="true" /> : null}

      <label className="block space-y-1">
        <span className="text-sm font-medium text-gray-700">Full Name</span>
        <input
          name="fullName"
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          className="w-full rounded border p-3"
          required
        />
        {existingNameMatch ? (
          <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            This name already exists as {existingNameMatch.fullName} (
            {existingNameMatch.customerId}).
          </p>
        ) : null}
        {state.errors?.fullName ? <p className="text-sm text-red-700">{state.errors.fullName}</p> : null}
      </label>
      <label className="block space-y-1"><span className="text-sm font-medium text-gray-700">Phone <span className="font-normal text-gray-400">(optional)</span></span><input name="phone" className="w-full rounded border p-3" />{state.errors?.phone ? <p className="text-sm text-red-700">{state.errors.phone}</p> : null}</label>
      <label className="block space-y-1"><span className="text-sm font-medium text-gray-700">Address</span><textarea name="address" className="min-h-24 w-full rounded border p-3" /></label>
      <label className="block space-y-1"><span className="text-sm font-medium text-gray-700">National ID <span className="font-normal text-gray-400">(optional)</span></span><input name="nationalId" className="w-full rounded border p-3" /></label>

      {canAssignStaff ? (
        <label className="block space-y-1"><span className="text-sm font-medium text-gray-700">Assigned Staff</span><select name="staffId" value={selectedStaffId} onChange={(event) => { setSelectedStaffId(event.target.value); setSelectedProductId(""); }} className="w-full rounded border p-3" required><option value="">Select staff</option>{staff.map((member) => <option key={member.id} value={member.id}>{member.fullName} ({member.code})</option>)}</select></label>
      ) : null}

      <div className="space-y-4 rounded-lg border border-lime-200 bg-lime-50 p-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-950">
            Initial Product Account
          </h2>
          <p className="mt-1 text-xs text-gray-600">
            Select a product now to open the customer&apos;s first account with this
            customer record.
          </p>
        </div>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-gray-700">Product</span>
          <select
            name="productId"
            value={selectedProductId}
            onChange={(event) => setSelectedProductId(event.target.value)}
            className="w-full rounded border bg-white p-3"
            disabled={!inventoryStaffId}
          >
            <option value="">
              {inventoryStaffId
                ? "No product account yet"
                : "Select staff before product"}
            </option>
            {availableProducts.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name} - {product.category} |{" "}
                {formatMoney(product.layawayPrice)} ({product.staffQuantity} in
                staff inventory)
              </option>
            ))}
          </select>
          {inventoryStaffId && availableProducts.length === 0 ? (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              This staff member has no product stock available. Admin or Super
              Admin must restock their inventory first.
            </p>
          ) : null}
          {state.errors?.productId ? (
            <p className="text-sm text-red-700">{state.errors.productId}</p>
          ) : null}
        </label>

        {selectedProduct ? (
          <div className="rounded-md border bg-white p-3 text-sm">
            <div className="mb-3 grid gap-3 sm:grid-cols-[minmax(12rem,18rem)_minmax(0,1fr)]">
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
                <p className="mt-0.5 text-xs text-gray-500">
                  {selectedProduct.category}
                </p>
                {selectedProduct.imageUrl ? (
                  <p className="mt-2 text-xs font-medium text-green-700">
                    Click the picture to preview it full size.
                  </p>
                ) : null}
                <p className="mt-2 text-xs font-semibold text-green-800">
                  Staff inventory: {selectedProduct.staffQuantity}
                </p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <p className="text-xs text-gray-500">Daily Amount</p>
                <p className="font-semibold text-gray-950">
                  {formatMoney(selectedProduct.dailyAmount)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Duration</p>
                <p className="font-semibold text-gray-950">
                  {selectedProduct.duration} days
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Target</p>
                <p className="font-semibold text-gray-950">
                  {formatMoney(selectedProduct.layawayPrice)}
                </p>
              </div>
            </div>
          </div>
        ) : null}

        <label className="block space-y-1">
          <span className="text-sm font-medium text-gray-700">Start Date</span>
          <input
            name="startDate"
            type="date"
            max={today}
            className="w-full rounded border bg-white p-3"
            required={Boolean(selectedProduct)}
          />
          {state.errors?.startDate ? (
            <p className="text-sm text-red-700">{state.errors.startDate}</p>
          ) : null}
        </label>

        {selectedProduct ? (
          <div className="space-y-4 rounded-md border bg-white p-3">
            <div>
              <h3 className="text-sm font-semibold text-gray-950">
                First Payment
              </h3>
              <p className="mt-1 text-xs text-gray-500">
                Leave this blank if the customer is opening the account without
                paying today.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="block space-y-1">
                <span className="text-sm font-medium text-gray-700">
                  Amount
                </span>
                <input
                  name="amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={firstPaymentAmount}
                  onChange={(event) => setFirstPaymentAmount(event.target.value)}
                  className="w-full rounded border p-3"
                />
                {state.errors?.amount ? (
                  <p className="text-sm text-red-700">{state.errors.amount}</p>
                ) : null}
              </label>

              <label className="block space-y-1">
                <span className="text-sm font-medium text-gray-700">
                  Payment Date
                </span>
                <input
                  name="paymentDate"
                  type="date"
                  max={today}
                  className="w-full rounded border p-3"
                  required={Boolean(firstPaymentAmount)}
                />
                {state.errors?.paymentDate ? (
                  <p className="text-sm text-red-700">
                    {state.errors.paymentDate}
                  </p>
                ) : null}
              </label>
            </div>

            <label className="block space-y-1">
              <span className="text-sm font-medium text-gray-700">Method</span>
              <select
                name="method"
                defaultValue="Cash"
                className="w-full rounded border p-3"
                required={Boolean(firstPaymentAmount)}
              >
                <option value="Cash">Cash</option>
                <option value="Mobile Money">Mobile Money</option>
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Cheque">Cheque</option>
              </select>
              {state.errors?.method ? (
                <p className="text-sm text-red-700">{state.errors.method}</p>
              ) : null}
            </label>

            <label className="block space-y-1">
              <span className="text-sm font-medium text-gray-700">Notes</span>
              <textarea name="notes" className="min-h-20 w-full rounded border p-3" />
            </label>
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-3"><Button type="submit" disabled={pending}>{pending ? <GlvLoading compact label="Saving" /> : state.duplicateWarning ? "Add Anyway" : submitLabel}</Button><Button asChild type="button" variant="outline"><Link href="/customers">Cancel</Link></Button></div>
    </form>
  );
}
