import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/accounts";
import { ProductCategoryBadge } from "@/lib/product-categories";
import { getProcurementAccounts } from "@/lib/procurement";
import { prisma } from "@/lib/prisma";

type ProcurementProductPageProps = {
  params: Promise<{
    productId: string;
  }>;
};

function percent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

export default async function ProcurementProductPage({
  params,
}: ProcurementProductPageProps) {
  const { productId } = await params;
  const [product, procurement] = await Promise.all([
    prisma.product.findUnique({
      where: {
        id: productId,
      },
      select: {
        id: true,
        name: true,
        category: true,
      },
    }),
    getProcurementAccounts(productId),
  ]);

  if (!product) {
    notFound();
  }

  const totalCost = procurement.items.reduce(
    (sum, item) => sum + item.landedUnitCost,
    0
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <Link
            href="/products?tab=procurement"
            aria-label="Back to procurement list"
            title="Back"
            className="mt-1 flex size-8 items-center justify-center rounded-md text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
          >
            <ArrowLeft className="size-4" />
          </Link>
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

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Units
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
            Threshold
          </p>
          <p className="mt-1 text-2xl font-semibold text-gray-950">
            {procurement.thresholdPercent}%
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
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
                  <td className="p-3 text-right">
                    <Link
                      href={`/accounts/${item.accountId}`}
                      className="font-medium text-green-700 hover:underline"
                    >
                      View account
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {procurement.items.length === 0 ? (
          <div className="border-t p-8 text-center text-sm text-gray-600">
            No customer accounts for this product are currently above the
            procurement threshold.
          </div>
        ) : null}
      </div>
    </div>
  );
}
