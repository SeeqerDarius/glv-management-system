import Link from "next/link";
import { BackButton } from "@/components/back-button";
import { notFound } from "next/navigation";
import { ArrowLeft, FileSpreadsheet, PackageCheck, RotateCcw } from "lucide-react";
import { confirmProcurement, undoProcurement } from "@/actions/procurement";
import { ProcurementConfirmForm } from "@/components/procurement-confirm-form";
import { ProductImagePreview } from "@/components/product-image-preview";
import { Button } from "@/components/ui/button";
import { PlainSubmitButton } from "@/components/ui/plain-submit-button";
import { formatMoney } from "@/lib/accounts";
import { ProductCategoryBadge } from "@/lib/product-categories";
import {
  getProcuredAwaitingDelivery,
  getProcurementAccounts,
} from "@/lib/procurement";
import { prisma } from "@/lib/prisma";

type ProcurementProductPageProps = {
  params: Promise<{
    productId: string;
  }>;
  searchParams: Promise<{
    error?: string;
    procured?: string;
    procurement?: string;
  }>;
};

function percent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function formatDay(value: Date) {
  return value.toISOString().slice(0, 10);
}

export default async function ProcurementProductPage({
  params,
  searchParams,
}: ProcurementProductPageProps) {
  const { productId } = await params;
  const { error, procured, procurement: procurementNotice } = await searchParams;
  const [product, procurement, procuredItems] = await Promise.all([
    prisma.product.findUnique({
      where: {
        id: productId,
      },
      select: {
        id: true,
        name: true,
        category: true,
        imageUrl: true,
      },
    }),
    getProcurementAccounts(productId),
    getProcuredAwaitingDelivery(productId),
  ]);

  if (!product) {
    notFound();
  }

  const totalCost = procurement.items.reduce(
    (sum, item) => sum + item.landedUnitCost,
    0
  );
  const returnTo = `/products/procurement/${product.id}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <BackButton
            fallbackHref="/products?tab=procurement"
            className="mt-1 flex size-8 items-center justify-center rounded-md text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
          >
            <ArrowLeft className="size-4" />
          </BackButton>
          <ProductImagePreview
            src={product.imageUrl}
            alt={product.name}
            className="size-16 rounded-lg bg-white"
            iconClassName="size-7"
            previewTitle={product.name}
          />
          <div className="min-w-0">
            <h1 className="break-words text-2xl font-bold text-gray-950 sm:text-3xl">
              {product.name}
            </h1>
            <div className="mt-2">
              <ProductCategoryBadge category={product.category} />
            </div>
            <p className="mt-2 text-sm text-gray-600">
              Customers whose accounts are at least{" "}
              {procurement.thresholdPercent}% paid and still pending delivery.
            </p>
          </div>
        </div>
        <Button asChild variant="outline">
          <Link href="/api/procurement/export" className="gap-2">
            <FileSpreadsheet className="size-4" />
            Export Excel
          </Link>
        </Button>
      </div>

      {procured ? (
        <div className="rounded-lg border border-lime-200 bg-lime-50 p-4 text-sm text-lime-900">
          {procured} unit{procured === "1" ? "" : "s"} confirmed as procured.
          Confirm delivery on each account once the customer receives the
          product.
        </div>
      ) : null}

      {procurementNotice === "reopened" ? (
        <div className="rounded-lg border border-lime-200 bg-lime-50 p-4 text-sm text-lime-900">
          Procurement confirmation reversed. The unit is back on the list to
          buy.
        </div>
      ) : null}

      {error === "procurement-invalid-quantity" ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Enter the quantity procured as a whole number of one or more.
        </div>
      ) : null}

      {error === "procurement-nothing-pending" ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Nothing is waiting to be procured for this product any more. Someone
          else may have confirmed it already.
        </div>
      ) : null}

      {error === "procurement-not-confirmed" ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          That unit is not marked as procured, so there is nothing to reverse.
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Units to buy
          </p>
          <p className="mt-1 text-2xl font-semibold text-gray-950">
            {procurement.items.length}
          </p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Estimated Cost
          </p>
          <p className="mt-1 text-2xl font-semibold text-green-700">
            {formatMoney(totalCost)}
          </p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Bought, awaiting delivery
          </p>
          <p className="mt-1 text-2xl font-semibold text-gray-950">
            {procuredItems.length}
          </p>
        </div>
      </div>

      {procurement.items.length > 0 ? (
        <div className="flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-medium">Confirm what you bought</p>
            <p className="mt-1 text-amber-800">
              Enter the number of units procured. That many units leave this
              list, starting with the customers closest to finishing their
              plan. A partial purchase only reduces the outstanding count.
            </p>
          </div>
          <ProcurementConfirmForm
            productId={product.id}
            maxQuantity={procurement.items.length}
            returnTo={returnTo}
            layout="stacked"
          />
        </div>
      ) : null}

      <div className="overflow-hidden rounded-lg border bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] text-sm">
            <thead>
              <tr className="bg-gray-100 text-left text-gray-700">
                <th className="p-3 font-medium">Customer</th>
                <th className="p-3 font-medium">Customer ID</th>
                <th className="p-3 font-medium">Staff</th>
                <th className="p-3 text-right font-medium">Paid %</th>
                <th className="p-3 text-right font-medium">Total Paid</th>
                <th className="p-3 text-right font-medium">Balance</th>
                <th className="p-3 text-right font-medium">Unit Cost</th>
                <th className="p-3 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {procurement.items.map((item) => (
                <tr key={item.accountId} className="border-t">
                  <td className="p-3 font-semibold text-gray-950">
                    {item.customerName}
                  </td>
                  <td className="p-3">{item.customerCode}</td>
                  <td className="p-3">
                    {item.staffCode} - {item.staffName}
                  </td>
                  <td className="p-3 text-right tabular-nums">
                    {percent(item.progress)}
                  </td>
                  <td className="p-3 text-right tabular-nums">
                    {formatMoney(item.totalPaid)}
                  </td>
                  <td className="p-3 text-right tabular-nums">
                    {formatMoney(item.balance)}
                  </td>
                  <td className="p-3 text-right tabular-nums font-semibold text-green-700">
                    {formatMoney(item.landedUnitCost)}
                  </td>
                  <td className="p-3">
                    <div className="flex items-center justify-end gap-3">
                      <form action={confirmProcurement}>
                        <input
                          type="hidden"
                          name="productId"
                          value={product.id}
                        />
                        <input
                          type="hidden"
                          name="accountId"
                          value={item.accountId}
                        />
                        <input type="hidden" name="returnTo" value={returnTo} />
                        <PlainSubmitButton
                          pendingLabel="Confirming"
                          title={`Confirm the unit for ${item.customerName} as procured`}
                          className="inline-flex h-9 items-center gap-2 rounded-md border border-green-700 px-3 text-sm font-medium text-green-800 hover:bg-green-50"
                        >
                          <PackageCheck className="size-4" />
                          Procured
                        </PlainSubmitButton>
                      </form>
                      <Link
                        href={`/accounts/${item.accountId}`}
                        className="font-medium text-green-700 hover:underline"
                      >
                        View account
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {procurement.items.length === 0 ? (
          <div className="border-t p-8 text-center text-sm text-gray-600">
            No customer accounts for this product are currently waiting to be
            procured.
          </div>
        ) : null}
      </div>

      {procuredItems.length > 0 ? (
        <section className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-950">
              Bought, awaiting delivery
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              These units are already procured, so they no longer appear on the
              buying list. Confirm delivery on the account once the customer
              receives the product.
            </p>
          </div>
          <div className="overflow-hidden rounded-lg border bg-white">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-sm">
                <thead>
                  <tr className="bg-gray-100 text-left text-gray-700">
                    <th className="p-3 font-medium">Customer</th>
                    <th className="p-3 font-medium">Customer ID</th>
                    <th className="p-3 font-medium">Staff</th>
                    <th className="p-3 font-medium">Procured on</th>
                    <th className="p-3 text-right font-medium">Paid %</th>
                    <th className="p-3 text-right font-medium">Balance</th>
                    <th className="p-3 text-right font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {procuredItems.map((item) => (
                    <tr key={item.accountId} className="border-t">
                      <td className="p-3 font-semibold text-gray-950">
                        {item.customerName}
                      </td>
                      <td className="p-3">{item.customerCode}</td>
                      <td className="p-3">
                        {item.staffCode} - {item.staffName}
                      </td>
                      <td className="p-3 tabular-nums">
                        {formatDay(item.procuredAt)}
                      </td>
                      <td className="p-3 text-right tabular-nums">
                        {percent(item.progress)}
                      </td>
                      <td className="p-3 text-right tabular-nums">
                        {formatMoney(item.balance)}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center justify-end gap-3">
                          <form action={undoProcurement}>
                            <input
                              type="hidden"
                              name="accountId"
                              value={item.accountId}
                            />
                            <input
                              type="hidden"
                              name="returnTo"
                              value={returnTo}
                            />
                            <PlainSubmitButton
                              pendingLabel="Reversing"
                              title={`Put the unit for ${item.customerName} back on the procurement list`}
                              className="inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
                            >
                              <RotateCcw className="size-4" />
                              Undo
                            </PlainSubmitButton>
                          </form>
                          <Link
                            href={`/accounts/${item.accountId}`}
                            className="font-medium text-green-700 hover:underline"
                          >
                            View account
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
