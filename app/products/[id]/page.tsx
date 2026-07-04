import Link from "next/link";
import { notFound } from "next/navigation";
import { AccountStatus } from "@prisma/client";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import { deleteProduct } from "@/actions/products";
import { ConfirmDeleteForm } from "@/components/confirm-delete-form";
import { formatMoney } from "@/lib/accounts";
import { prisma } from "@/lib/prisma";

type ProductDetailsPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function ProductDetailsPage({
  params,
}: ProductDetailsPageProps) {
  const { id } = await params;

  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          accounts: true,
        },
      },
      accounts: {
        select: {
          id: true,
          status: true,
        },
      },
    },
  });

  if (!product) {
    notFound();
  }

  const layawayProfit =
    product.layawayPrice - product.costPrice - product.transportCost;

  const layawayProfitPercentage =
    product.costPrice > 0 ? (layawayProfit / product.costPrice) * 100 : 0;

  const expectedLayawayRevenue =
    product.layawayPrice * product._count.accounts;

  const expectedLayawayProfit =
    layawayProfit * product._count.accounts;

  const activeAccounts = product.accounts.filter(
    (account) => account.status === AccountStatus.ACTIVE
  ).length;
  const completedAccounts = product.accounts.filter(
    (account) => account.status === AccountStatus.COMPLETED
  ).length;
  const cancelledAccounts = product.accounts.filter(
    (account) => account.status === AccountStatus.CANCELLED
  ).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Link
            href="/products"
            aria-label="Back to products"
            title="Back"
            className="group/back mt-0.5 flex size-8 items-center justify-center rounded-md text-gray-400 transition-all duration-150 hover:bg-gray-100 hover:text-gray-700"
          >
            <ArrowLeft className="size-4 transition-transform duration-200 group-hover/back:scale-125 group-hover/back:-translate-x-0.5" />
          </Link>
          <div>
            <h1 className="text-2xl font-semibold text-gray-950">
              {product.name}
            </h1>

            <p className="mt-1 text-sm text-gray-500">{product.category}</p>

            {product.description ? (
              <p className="mt-2 max-w-2xl text-sm text-gray-500">
                {product.description}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-0.5">
          {/* Edit */}
          <Link
            href={`/products/${product.id}/edit`}
            aria-label={`Edit ${product.name}`}
            title="Edit"
            className="
              group/edit flex size-8 items-center justify-center rounded-md
              text-gray-400 transition-all duration-150
              hover:bg-lime-50 hover:text-green-700
            "
          >
            <Pencil className="size-4 transition-transform duration-200 group-hover/edit:scale-125 group-hover/edit:rotate-12" />
          </Link>

          {/* Delete */}
          <ConfirmDeleteForm
            action={deleteProduct}
            id={product.id}
            title={`Delete ${product.name}?`}
            hasLinkedHistory={product._count.accounts > 0}
            description="This permanently deletes the product, every related account, and all payment records. This cannot be undone."
            triggerClassName="
              group/del flex size-8 items-center justify-center rounded-md
              text-gray-400 transition-all duration-150
              hover:bg-red-50 hover:text-red-600
            "
          >
            <Trash2 className="size-4 transition-transform duration-200 group-hover/del:scale-125 group-hover/del:-translate-y-0.5" />
          </ConfirmDeleteForm>
        </div>
      </div>

      {/* Product Details Stats */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-gray-950">
          Product Details
        </h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <div className="rounded-lg bg-gray-50 px-4 py-3">
            <p className="text-[11px] uppercase tracking-widest text-gray-400">
              Cost Price
            </p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-gray-950">
              {formatMoney(product.costPrice)}
            </p>
          </div>
          <div className="rounded-lg bg-gray-50 px-4 py-3">
            <p className="text-[11px] uppercase tracking-widest text-gray-400">
              Transport Cost
            </p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-gray-950">
              {formatMoney(product.transportCost)}
            </p>
          </div>
          <div className="rounded-lg bg-gray-50 px-4 py-3">
            <p className="text-[11px] uppercase tracking-widest text-gray-400">
              Daily Amount
            </p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-gray-950">
              {formatMoney(product.dailyAmount)}
            </p>
          </div>
          <div className="rounded-lg bg-gray-50 px-4 py-3">
            <p className="text-[11px] uppercase tracking-widest text-gray-400">
              Duration
            </p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-gray-950">
              {product.duration} days
            </p>
          </div>
          <div className="rounded-lg bg-gray-50 px-4 py-3">
            <p className="text-[11px] uppercase tracking-widest text-gray-400">
              Layaway Price
            </p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-gray-950">
              {formatMoney(product.layawayPrice)}
            </p>
          </div>
        </div>
      </div>

      {/* Profitability Stats */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-gray-950">
          Profitability
        </h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-lg bg-gray-50 px-4 py-3">
            <p className="text-[11px] uppercase tracking-widest text-gray-400">
              Profit / Unit
            </p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-green-700">
              {formatMoney(layawayProfit)}
            </p>
          </div>
          <div className="rounded-lg bg-gray-50 px-4 py-3">
            <p className="text-[11px] uppercase tracking-widest text-gray-400">
              Profit Margin
            </p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-green-700">
              {layawayProfitPercentage.toFixed(1)}%
            </p>
          </div>
          <div className="rounded-lg bg-gray-50 px-4 py-3">
            <p className="text-[11px] uppercase tracking-widest text-gray-400">
              Exp. Revenue
            </p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-gray-950">
              {formatMoney(expectedLayawayRevenue)}
            </p>
          </div>
          <div className="rounded-lg bg-gray-50 px-4 py-3">
            <p className="text-[11px] uppercase tracking-widest text-gray-400">
              Exp. Profit
            </p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-green-700">
              {formatMoney(expectedLayawayProfit)}
            </p>
          </div>
        </div>
        
        {/* Formula Note */}
        <div className="mt-3 rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-600">
          <p>
            <span className="font-medium text-gray-900">Formula:</span> Daily ×
            Duration = Layaway Price
          </p>
          <p className="mt-1">
            <span className="font-medium text-gray-900">Calculated:</span>{" "}
            {formatMoney(product.dailyAmount)} × {product.duration} ={" "}
            {formatMoney(product.layawayPrice)}
          </p>
        </div>
      </div>

      {/* Account Summary Stats */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-gray-950">
          Account Summary
        </h2>
        <p className="-mt-1 mb-3 text-sm text-gray-500">
          Quantity is derived from customer accounts using this product.
        </p>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-lg bg-gray-50 px-4 py-3">
            <p className="text-[11px] uppercase tracking-widest text-gray-400">
              Total Accounts
            </p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-gray-950">
              {product._count.accounts}
            </p>
          </div>
          <div className="rounded-lg bg-gray-50 px-4 py-3">
            <p className="text-[11px] uppercase tracking-widest text-gray-400">
              Active
            </p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-blue-700">
              {activeAccounts}
            </p>
          </div>
          <div className="rounded-lg bg-gray-50 px-4 py-3">
            <p className="text-[11px] uppercase tracking-widest text-gray-400">
              Completed
            </p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-green-700">
              {completedAccounts}
            </p>
          </div>
          <div className="rounded-lg bg-gray-50 px-4 py-3">
            <p className="text-[11px] uppercase tracking-widest text-gray-400">
              Cancelled
            </p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-red-700">
              {cancelledAccounts}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
