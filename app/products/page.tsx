import Link from "next/link";
import {
  Eye,
  ListChecksIcon,
  PackageCheckIcon,
  Pencil,
  SearchIcon,
  Trash2,
} from "lucide-react";
import { deleteProduct } from "@/actions/products";
import { ConfirmDeleteForm } from "@/components/confirm-delete-form";
import { formatMoney } from "@/lib/accounts";
import { ProductCategoryBadge } from "@/lib/product-categories";
import { getProcurementList } from "@/lib/procurement";
import { prisma } from "@/lib/prisma";

type ProductsPageProps = {
  searchParams: Promise<{
    q?: string;
    tab?: string;
    error?: string;
    deleted?: string;
  }>;
};

function percent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const { q, tab, error, deleted } = await searchParams;
  const query = q?.trim() ?? "";
  const activeTab = tab === "procurement" ? "procurement" : "products";

  const [products, procurement] = await Promise.all([
    prisma.product.findMany({
      where: query
        ? {
            OR: [
              { name: { contains: query, mode: "insensitive" } },
              { category: { contains: query, mode: "insensitive" } },
            ],
          }
        : undefined,
      orderBy: { name: "asc" },
      include: { _count: { select: { accounts: true } } },
    }),
    getProcurementList(),
  ]);

  const procurementItems = query
    ? procurement.items.filter(
        (item) =>
          item.productName.toLowerCase().includes(query.toLowerCase()) ||
          item.category.toLowerCase().includes(query.toLowerCase())
      )
    : procurement.items;

  const totalQty = products.reduce((s, p) => s + p._count.accounts, 0);
  const totalProfit = products.reduce(
    (s, p) =>
      s + (p.layawayPrice - p.costPrice - p.transportCost) * p._count.accounts,
    0,
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-950">Products</h1>
          <p className="mt-1 text-sm text-gray-500">
            Layaway assets, combos, daily amounts, and installment terms.
          </p>
        </div>
        <Link
          href="/products/new"
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#123824] px-4 py-2 text-sm font-medium text-lime-400 transition hover:bg-[#1a4f33]"
        >
          <span className="text-lg leading-none">+</span> Create product
        </Link>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-2">
        <Link
          href="/products"
          className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition ${
            activeTab === "products"
              ? "bg-green-900 text-lime-300"
              : "bg-white text-gray-600 hover:bg-gray-50"
          }`}
        >
          <ListChecksIcon className="size-4" />
          Product List
        </Link>
        <Link
          href="/products?tab=procurement"
          className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition ${
            activeTab === "procurement"
              ? "bg-green-900 text-lime-300"
              : "bg-white text-gray-600 hover:bg-gray-50"
          }`}
        >
          <PackageCheckIcon className="size-4" />
          Procurement List
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {(activeTab === "procurement"
          ? [
              { label: "Products to buy", value: procurementItems.length },
              { label: "Total units", value: procurementItems.reduce((sum, item) => sum + item.quantity, 0) },
              {
                label: "Estimated total cost",
                value: formatMoney(procurementItems.reduce((sum, item) => sum + item.totalCost, 0)),
                green: true,
              },
            ]
          : [
              { label: "Total products", value: products.length },
              { label: "Total qty on sale", value: totalQty },
              { label: "Expected profit", value: formatMoney(totalProfit), green: true },
            ]).map((s) => (
          <div key={s.label} className="rounded-lg bg-gray-50 px-4 py-3">
            <p className="text-[11px] uppercase tracking-widest text-gray-400">
              {s.label}
            </p>
            <p
              className={`mt-1 text-xl font-semibold tabular-nums ${
                s.green ? "text-green-700" : "text-gray-950"
              }`}
            >
              {s.value}
            </p>
          </div>
        ))}
      </div>

      {/* Toasts */}
      {error === "product-delete-blocked" && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3.5 text-sm text-amber-900">
          Product deletion was blocked by related records. Remove or correct
          the related records first.
        </div>
      )}
      {error === "delete-confirmation-required" && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3.5 text-sm text-red-800">
          Type DELETE in the confirmation box before deleting a product.
        </div>
      )}
      {(error === "admin-password-required" ||
        error === "invalid-admin-password") && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3.5 text-sm text-red-800">
          Enter a valid admin password before deleting product records.
        </div>
      )}
      {deleted === "product" && (
        <div className="rounded-lg border border-lime-200 bg-lime-50 p-3.5 text-sm text-lime-900">
          Product and all related accounts and payments were permanently deleted.
        </div>
      )}

      {activeTab === "procurement" ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3.5 text-sm text-amber-900">
          Products appear here when customer accounts for that product are at
          least {procurement.thresholdPercent}% paid, including fully paid
          accounts that are still pending delivery.
        </div>
      ) : null}

      {/* Search */}
      <form className="relative max-w-sm">
        {activeTab === "procurement" ? (
          <input type="hidden" name="tab" value="procurement" />
        ) : null}
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
        <input
          name="q"
          defaultValue={query}
          placeholder="Search by name or category"
          className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-green-600 focus:ring-2 focus:ring-green-600/20"
        />
      </form>

      {activeTab === "procurement" ? (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[840px] text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-3 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-gray-400">Product</th>
                  <th className="px-3 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-gray-400">Category</th>
                  <th className="px-3 py-2.5 text-right text-[11px] font-medium uppercase tracking-wider text-gray-400">Units</th>
                  <th className="px-3 py-2.5 text-right text-[11px] font-medium uppercase tracking-wider text-gray-400">Cost price</th>
                  <th className="px-3 py-2.5 text-right text-[11px] font-medium uppercase tracking-wider text-gray-400">Transport</th>
                  <th className="px-3 py-2.5 text-right text-[11px] font-medium uppercase tracking-wider text-gray-400">Unit total</th>
                  <th className="px-3 py-2.5 text-right text-[11px] font-medium uppercase tracking-wider text-gray-400">Total</th>
                  <th className="px-3 py-2.5 text-right text-[11px] font-medium uppercase tracking-wider text-gray-400">Avg. paid</th>
                  <th className="px-3 py-2.5 text-right text-[11px] font-medium uppercase tracking-wider text-gray-400"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {procurementItems.map((item) => (
                  <tr
                    key={item.productId}
                    className="transition-colors hover:bg-gray-50/70"
                  >
                    <td className="px-3 py-3 font-medium text-gray-900">
                      {item.productName}
                    </td>
                    <td className="px-3 py-3">
                      <ProductCategoryBadge category={item.category} />
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums font-semibold text-gray-950">
                      {item.quantity}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-gray-700">
                      {formatMoney(item.unitCost)}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-gray-700">
                      {formatMoney(item.transportCost)}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-gray-700">
                      {formatMoney(item.landedUnitCost)}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums font-semibold text-green-700">
                      {formatMoney(item.totalCost)}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-gray-700">
                      {percent(item.averageProgress)}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <Link
                        href={`/products/${item.productId}`}
                        aria-label={`View ${item.productName}`}
                        title="View"
                        className="group/view ml-auto flex size-8 items-center justify-center rounded-md text-gray-400 transition-all duration-150 hover:bg-blue-50 hover:text-blue-600"
                      >
                        <Eye className="size-4 transition-transform duration-200 group-hover/view:scale-125 group-hover/view:-rotate-6" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
              {procurementItems.length > 0 ? (
                <tfoot>
                  <tr className="border-t bg-gray-50 font-semibold text-gray-950">
                    <td className="px-3 py-3" colSpan={2}>Total</td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {procurementItems.reduce((sum, item) => sum + item.quantity, 0)}
                    </td>
                    <td className="px-3 py-3" colSpan={3}></td>
                    <td className="px-3 py-3 text-right tabular-nums text-green-700">
                      {formatMoney(procurementItems.reduce((sum, item) => sum + item.totalCost, 0))}
                    </td>
                    <td className="px-3 py-3" colSpan={2}></td>
                  </tr>
                </tfoot>
              ) : null}
            </table>

            {procurementItems.length === 0 && (
              <div className="flex flex-col items-center gap-1 py-14 text-center">
                <p className="text-sm font-medium text-gray-700">
                  No products are ready for procurement
                </p>
                <p className="text-xs text-gray-400">
                  Products will appear here when accounts cross the payment threshold.
                </p>
              </div>
            )}
          </div>
        </div>
      ) : (
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm" style={{ tableLayout: "fixed" }}>
            {/* Widths now sum perfectly to 100% */}
            <colgroup>
              <col style={{ width: "25%" }} />
              <col style={{ width: "15%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "14%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "14%" }} />
              <col style={{ width: "10%" }} />
            </colgroup>
            
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {/* Replaced dynamic mapping with explicit classes so Tailwind compiles them correctly */}
                <th className="px-3 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-gray-400">Name</th>
                <th className="px-3 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-gray-400">Category</th>
                <th className="px-3 py-2.5 text-right text-[11px] font-medium uppercase tracking-wider text-gray-400">Daily</th>
                <th className="px-3 py-2.5 text-right text-[11px] font-medium uppercase tracking-wider text-gray-400">Layaway total</th>
                <th className="px-3 py-2.5 text-right text-[11px] font-medium uppercase tracking-wider text-gray-400">Qty on sale</th>
                <th className="px-3 py-2.5 text-right text-[11px] font-medium uppercase tracking-wider text-gray-400">Exp. profit</th>
                <th className="px-3 py-2.5 text-right text-[11px] font-medium uppercase tracking-wider text-gray-400"></th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {products.map((product) => {
                const unitProfit =
                  product.layawayPrice -
                  product.costPrice -
                  product.transportCost;
                const expectedProfit = unitProfit * product._count.accounts;

                return (
                  <tr
                    key={product.id}
                    className="group transition-colors hover:bg-gray-50/70"
                  >
                    <td className="px-3 py-3 text-left font-medium text-gray-900 truncate">
                      {product.name}
                    </td>

                    <td className="px-3 py-3 text-left">
                      <ProductCategoryBadge category={product.category} />
                    </td>

                    <td className="px-3 py-3 text-right tabular-nums text-gray-700">
                      {formatMoney(product.dailyAmount)}
                    </td>

                    <td className="px-3 py-3 text-right tabular-nums text-gray-700">
                      {formatMoney(product.layawayPrice)}
                    </td>

                    <td className="px-3 py-3 text-right tabular-nums text-gray-700">
                      {product._count.accounts}
                    </td>

                    <td className="px-3 py-3 text-right tabular-nums font-medium text-green-700">
                      {formatMoney(expectedProfit)}
                    </td>

                    <td className="px-3 py-3 text-right">
                      <div className="flex items-center justify-end gap-0.5">
                        {/* View */}
                        <Link
                          href={`/products/${product.id}`}
                          aria-label={`View ${product.name}`}
                          title="View"
                          className="
                            group/view flex size-8 items-center justify-center rounded-md
                            text-gray-400 transition-all duration-150
                            hover:bg-blue-50 hover:text-blue-600
                          "
                        >
                          <Eye className="size-4 transition-transform duration-200 group-hover/view:scale-125 group-hover/view:-rotate-6" />
                        </Link>

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
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {products.length === 0 && (
            <div className="flex flex-col items-center gap-1 py-14 text-center">
              <p className="text-sm font-medium text-gray-700">
                No products found
              </p>
              <p className="text-xs text-gray-400">
                {query
                  ? `No results for "${query}". Try a different search.`
                  : "Create your first product to get started."}
              </p>
            </div>
          )}
        </div>
      </div>
      )}
    </div>
  );
}
