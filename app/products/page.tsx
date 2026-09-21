import Link from "next/link";
import { redirect } from "next/navigation";
import { UserPermission } from "@prisma/client";
import {
  Eye,
  FileSpreadsheet,
  ListChecksIcon,
  PackageCheckIcon,
  Pencil,
  SearchIcon,
  Trash2,
} from "lucide-react";
import { deleteProduct } from "@/actions/products";
import { ConfirmDeleteForm } from "@/components/confirm-delete-form";
import { TabsNav } from "@/components/ui/tabs-nav";
import { InventoryReceiveForm } from "@/components/inventory-receive-form";
import { ProductImagePreview } from "@/components/product-image-preview";
import { formatMoney } from "@/lib/accounts";
import { auth } from "@/lib/auth";
import { ProductCategoryBadge } from "@/lib/product-categories";
import { getProcurementList } from "@/lib/procurement";
import { prisma } from "@/lib/prisma";
import { hasPermission, isAdminRole } from "@/lib/roles";

type ProductsPageProps = {
  searchParams: Promise<{
    q?: string;
    tab?: string;
    sort?: string;
    error?: string;
    deleted?: string;
    received?: string;
    balance?: string;
  }>;
};

const productSortOptions = [
  "name-az",
  "name-za",
  "category-az",
  "daily-high",
  "price-high",
  "profit-high",
  "quantity-high",
] as const;
type ProductSort = (typeof productSortOptions)[number];

const procurementSortOptions = [
  "quantity-high",
  "product-az",
  "cost-high",
  "paid-high",
  "average-paid-high",
] as const;
type ProcurementSort = (typeof procurementSortOptions)[number];

function isProductSort(value: string): value is ProductSort {
  return productSortOptions.includes(value as ProductSort);
}

function isProcurementSort(value: string): value is ProcurementSort {
  return procurementSortOptions.includes(value as ProcurementSort);
}

function percent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const session = await auth();
  const canManageProducts =
    isAdminRole(session?.user?.role) ||
    hasPermission(
      session?.user?.role,
      session?.user?.permissions,
      UserPermission.MANAGE_PRODUCTS
    );

  if (!canManageProducts) {
    redirect("/dashboard");
  }

  const { q, tab, sort, error, deleted, received, balance } =
    await searchParams;
  const query = q?.trim() ?? "";
  const activeTab = tab === "procurement" ? "procurement" : "products";
  const sortParam = sort ?? "";
  const selectedProductSort: ProductSort = isProductSort(sortParam)
    ? sortParam
    : "name-az";
  const selectedProcurementSort: ProcurementSort = isProcurementSort(sortParam)
    ? sortParam
    : "product-az";

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

  const procurementItems = (query
    ? procurement.items.filter(
        (item) =>
          item.productName.toLowerCase().includes(query.toLowerCase()) ||
          item.category.toLowerCase().includes(query.toLowerCase())
      )
    : procurement.items
  ).sort((a, b) => {
    switch (selectedProcurementSort) {
      case "product-az":
        return a.productName.localeCompare(b.productName);
      case "cost-high":
        return b.totalCost - a.totalCost;
      case "paid-high":
        return b.highestProgress - a.highestProgress;
      case "average-paid-high":
        return b.averageProgress - a.averageProgress;
      case "quantity-high":
      default:
        return (
          b.quantity - a.quantity ||
          b.highestProgress - a.highestProgress ||
          a.productName.localeCompare(b.productName)
        );
    }
  });

  const sortedProducts = [...products].sort((a, b) => {
    const profitA =
      (a.layawayPrice - a.costPrice - a.transportCost) * a._count.accounts;
    const profitB =
      (b.layawayPrice - b.costPrice - b.transportCost) * b._count.accounts;

    switch (selectedProductSort) {
      case "name-za":
        return b.name.localeCompare(a.name);
      case "category-az":
        return (
          a.category.localeCompare(b.category) || a.name.localeCompare(b.name)
        );
      case "daily-high":
        return b.dailyAmount - a.dailyAmount;
      case "price-high":
        return b.layawayPrice - a.layawayPrice;
      case "profit-high":
        return profitB - profitA;
      case "quantity-high":
        return b._count.accounts - a._count.accounts;
      case "name-az":
      default:
        return a.name.localeCompare(b.name);
    }
  });

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

      <TabsNav
        label="Product views"
        activeKey={activeTab}
        items={[
          {
            key: "products",
            label: "Product List",
            href: "/products",
            icon: ListChecksIcon,
          },
          {
            key: "procurement",
            label: "Procurement List",
            href: "/products?tab=procurement",
            icon: PackageCheckIcon,
          },
        ]}
      />

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {(activeTab === "procurement"
          ? [
              { label: "Products to buy", value: procurementItems.length },
              { label: "Units to buy", value: procurementItems.reduce((sum, item) => sum + item.quantity, 0) },
              {
                label: "Estimated total cost",
                value: formatMoney(procurementItems.reduce((sum, item) => sum + item.totalCost, 0)),
                green: true,
              },
            ]
          : [
              { label: "Total products", value: sortedProducts.length },
              { label: "Total accounts", value: totalQty },
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
      {received && (
        <div className="rounded-lg border border-lime-200 bg-lime-50 p-3.5 text-sm text-lime-900">
          {received} unit{received === "1" ? "" : "s"} received into stock
          {balance ? ` — ${balance} now on hand` : ""}, so they have left the
          procurement list.
        </div>
      )}
      {error === "inventory-invalid-quantity" && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3.5 text-sm text-amber-900">
          Enter the quantity received as a whole number of one or more.
        </div>
      )}
      {(error === "inventory-product-required" ||
        error === "inventory-product-not-found") && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3.5 text-sm text-amber-900">
          That product could not be found. It may have been deleted.
        </div>
      )}

      {activeTab === "procurement" ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3.5 text-sm text-amber-900">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p>
              Products appear here when customer accounts for that product
              are at least {procurement.thresholdPercent}% paid and still
              awaiting delivery, and{" "}
              <Link
                href="/inventory"
                className="font-medium underline underline-offset-2"
              >
                inventory
              </Link>{" "}
              does not already cover them. Receive the stock and the product
              leaves this list.
            </p>
            <Link
              href="/api/procurement/export"
              className="inline-flex items-center justify-center gap-2 rounded-md border border-amber-300 bg-white px-3 py-2 font-medium text-amber-950 hover:bg-amber-100"
            >
              <FileSpreadsheet className="size-4" />
              Export Excel
            </Link>
          </div>
        </div>
      ) : null}

      {/* Search */}
      <form className="grid max-w-3xl gap-3 sm:grid-cols-[minmax(0,1fr)_220px_auto]">
        {activeTab === "procurement" ? (
          <input type="hidden" name="tab" value="procurement" />
        ) : null}
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
          <input
            name="q"
            defaultValue={query}
            placeholder="Search by name or category"
            className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-green-600 focus:ring-2 focus:ring-green-600/20"
          />
        </div>
        <select
          name="sort"
          defaultValue={
            activeTab === "procurement"
              ? selectedProcurementSort
              : selectedProductSort
          }
          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-green-600 focus:ring-2 focus:ring-green-600/20"
        >
          {activeTab === "procurement" ? (
            <>
              <option value="product-az">Product A-Z</option>
              <option value="quantity-high">Most units</option>
              <option value="cost-high">Highest total cost</option>
              <option value="paid-high">Highest paid %</option>
              <option value="average-paid-high">Highest avg. paid</option>
            </>
          ) : (
            <>
              <option value="name-az">Name A-Z</option>
              <option value="name-za">Name Z-A</option>
              <option value="category-az">Category A-Z</option>
              <option value="daily-high">Highest daily</option>
              <option value="price-high">Highest layaway total</option>
              <option value="profit-high">Highest expected profit</option>
              <option value="quantity-high">Most accounts</option>
            </>
          )}
        </select>
        <button
          type="submit"
          className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Filter
        </button>
      </form>

      {activeTab === "procurement" ? (
        <>
          {/* Mobile Card View for Procurement */}
          <div className="grid gap-3 md:hidden">
            {procurementItems.map((item) => (
              <div
                key={item.productId}
                className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-base font-semibold text-gray-950">
                      {item.productName}
                    </h2>
                    <p className="text-sm text-gray-600">
                      <ProductCategoryBadge category={item.category} />
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-semibold text-green-700">
                      {formatMoney(item.totalCost)}
                    </p>
                    <p className="text-xs text-gray-600">{item.quantity} units</p>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-gray-400">Unit Cost</p>
                    <p className="font-medium text-gray-800">{formatMoney(item.unitCost)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Transport</p>
                    <p className="font-medium text-gray-800">{formatMoney(item.transportCost)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Landed Unit</p>
                    <p className="font-medium text-gray-800">{formatMoney(item.landedUnitCost)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Avg. Paid</p>
                    <p className="font-medium text-gray-800">{percent(item.averageProgress)}</p>
                  </div>
                </div>

                <div className="mt-4">
                  <Link
                    href={`/products/procurement/${item.productId}`}
                    className="inline-flex h-9 items-center justify-center rounded-md border border-gray-200 px-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    View Details
                  </Link>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Table View for Procurement */}
          <div className="hidden overflow-hidden rounded-xl border border-gray-200 bg-white md:block">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px] text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-3 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-gray-400">Product</th>
                  <th className="px-3 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-gray-400">Category</th>
                  <th className="px-3 py-2.5 text-right text-[11px] font-medium uppercase tracking-wider text-gray-400">To buy</th>
                  <th className="px-3 py-2.5 text-right text-[11px] font-medium uppercase tracking-wider text-gray-400">In stock</th>
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
                    <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums font-semibold text-gray-950">
                      {item.quantity}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums text-gray-700">
                      {item.stockOnHand}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums text-gray-700">
                      {formatMoney(item.unitCost)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums text-gray-700">
                      {formatMoney(item.transportCost)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums text-gray-700">
                      {formatMoney(item.landedUnitCost)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums font-semibold text-green-700">
                      {formatMoney(item.totalCost)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums text-gray-700">
                      {percent(item.averageProgress)}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-end gap-0.5">
                        <InventoryReceiveForm
                          productId={item.productId}
                          productName={item.productName}
                          stockOnHand={item.stockOnHand}
                          suggestedQuantity={item.quantity}
                          returnTo="/products?tab=procurement"
                        />
                        <Link
                          href={`/products/procurement/${item.productId}`}
                          aria-label={`View ${item.productName}`}
                          title="View"
                          className="group/view flex size-8 items-center justify-center rounded-md text-gray-400 transition-all duration-150 hover:bg-blue-50 hover:text-blue-600"
                        >
                          <Eye className="size-4 transition-transform duration-200 group-hover/view:scale-125 group-hover/view:-rotate-6" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              {procurementItems.length > 0 ? (
                <tfoot>
                  <tr className="border-t bg-gray-50 font-semibold text-gray-950">
                    <td className="px-3 py-3" colSpan={2}>Total</td>
                    <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums">
                      {procurementItems.reduce((sum, item) => sum + item.quantity, 0)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums">
                      {procurementItems.reduce((sum, item) => sum + item.stockOnHand, 0)}
                    </td>
                    <td className="px-3 py-3" colSpan={3}></td>
                    <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums text-green-700">
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

          {procurementItems.length === 0 && (
            <div className="rounded-lg border border-gray-200 bg-white p-8 text-center md:hidden">
              <p className="text-sm font-medium text-gray-700">No products are ready for procurement</p>
              <p className="text-xs text-gray-400">Products will appear here when accounts cross the payment threshold.</p>
            </div>
          )}
        </>
      ) : (
        <>
          {/* Mobile Card View for Products */}
          <div className="grid gap-3 md:hidden">
            {sortedProducts.map((product) => {
              const unitProfit =
                product.layawayPrice -
                product.costPrice -
                product.transportCost;
              const expectedProfit = unitProfit * product._count.accounts;

              return (
                <div
                  key={product.id}
                  className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <ProductImagePreview
                          src={product.imageUrl}
                          alt={product.name}
                          className="size-10"
                          previewTitle={product.name}
                        />
                        <div className="min-w-0">
                          <h2 className="truncate text-base font-semibold text-gray-950">
                            {product.name}
                          </h2>
                          <p className="text-sm text-gray-600">
                            <ProductCategoryBadge category={product.category} />
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-semibold text-green-700">
                        {formatMoney(expectedProfit)}
                      </p>
                      <p className="text-xs text-gray-600">{product._count.accounts} accounts</p>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-gray-400">Daily</p>
                      <p className="font-medium text-gray-800">{formatMoney(product.dailyAmount)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Layaway Total</p>
                      <p className="font-medium text-gray-800">{formatMoney(product.layawayPrice)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Qty on Sale</p>
                      <p className="font-medium text-gray-800">{product._count.accounts}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Unit Profit</p>
                      <p className="font-medium text-gray-800">{formatMoney(unitProfit)}</p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <Link
                      href={`/products/${product.id}`}
                      className="inline-flex h-9 items-center justify-center rounded-md border border-gray-200 px-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      View
                    </Link>
                    <Link
                      href={`/products/${product.id}/edit`}
                      className="inline-flex h-9 items-center justify-center rounded-md border border-gray-200 px-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Edit
                    </Link>
                    <ConfirmDeleteForm
                      action={deleteProduct}
                      id={product.id}
                      title={`Delete ${product.name}?`}
                      hasLinkedHistory={product._count.accounts > 0}
                      description="This permanently deletes the product, every related account, and all payment records. This cannot be undone."
                      triggerClassName="inline-flex h-9 items-center justify-center rounded-md border border-red-200 px-3 text-sm font-medium text-red-700 hover:bg-red-50"
                    >
                      Delete
                    </ConfirmDeleteForm>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop Table View for Products */}
          <div className="hidden overflow-hidden rounded-xl border border-gray-200 bg-white md:block">
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
              {sortedProducts.map((product) => {
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
                    <td className="px-3 py-3 text-left font-medium text-gray-900">
                      <div className="flex min-w-0 items-center gap-3">
                        <ProductImagePreview
                          src={product.imageUrl}
                          alt={product.name}
                          className="size-10"
                          previewTitle={product.name}
                        />
                        <span className="truncate">{product.name}</span>
                      </div>
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
