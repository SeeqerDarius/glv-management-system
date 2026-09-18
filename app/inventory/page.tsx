import Link from "next/link";
import { redirect } from "next/navigation";
import { UserPermission } from "@prisma/client";
import {
  BoxesIcon,
  Eye,
  HistoryIcon,
  SearchIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { InventoryCountForm } from "@/components/inventory-count-form";
import { InventoryMovementsTable } from "@/components/inventory-movements-table";
import { InventoryReceiveForm } from "@/components/inventory-receive-form";
import { ProductImagePreview } from "@/components/product-image-preview";
import { TabsNav } from "@/components/ui/tabs-nav";
import { formatMoney } from "@/lib/accounts";
import { auth } from "@/lib/auth";
import { getInventory, getInventoryMovements } from "@/lib/inventory";
import { ProductCategoryBadge } from "@/lib/product-categories";
import { hasPermission, isAdminRole } from "@/lib/roles";

type InventoryPageProps = {
  searchParams: Promise<{
    q?: string;
    tab?: string;
    sort?: string;
    error?: string;
    received?: string;
    corrected?: string;
    balance?: string;
  }>;
};

const sortOptions = [
  "name-az",
  "stock-high",
  "stock-low",
  "short-high",
  "value-high",
] as const;
type InventorySort = (typeof sortOptions)[number];

function isInventorySort(value: string): value is InventorySort {
  return sortOptions.includes(value as InventorySort);
}

export default async function InventoryPage({
  searchParams,
}: InventoryPageProps) {
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

  const { q, tab, sort, error, received, corrected, balance } =
    await searchParams;
  const query = q?.trim() ?? "";
  const activeTab = tab === "movements" ? "movements" : "stock";
  const sortParam = sort ?? "";
  const selectedSort: InventorySort = isInventorySort(sortParam)
    ? sortParam
    : "name-az";

  const [inventory, movements] = await Promise.all([
    getInventory({ includeInactive: true }),
    activeTab === "movements"
      ? getInventoryMovements({ take: 200 })
      : Promise.resolve([]),
  ]);

  const needle = query.toLowerCase();
  const rows = inventory.rows
    .filter(
      (row) =>
        !needle ||
        row.name.toLowerCase().includes(needle) ||
        row.category.toLowerCase().includes(needle)
    )
    .sort((a, b) => {
      switch (selectedSort) {
        case "stock-high":
          return b.stockOnHand - a.stockOnHand || a.name.localeCompare(b.name);
        case "stock-low":
          return a.stockOnHand - b.stockOnHand || a.name.localeCompare(b.name);
        case "short-high":
          return b.shortfall - a.shortfall || a.name.localeCompare(b.name);
        case "value-high":
          return (
            b.stockOnHand * b.landedUnitCost - a.stockOnHand * a.landedUnitCost
          );
        case "name-az":
        default:
          return a.name.localeCompare(b.name);
      }
    });

  const visibleMovements = needle
    ? movements.filter((movement) =>
        movement.productName.toLowerCase().includes(needle)
      )
    : movements;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-950">Inventory</h1>
          <p className="mt-1 text-sm text-gray-500">
            What is on the shelf right now, and every movement that put it
            there.
          </p>
        </div>
      </div>

      <TabsNav
        label="Inventory views"
        activeKey={activeTab}
        items={[
          {
            key: "stock",
            label: "Stock On Hand",
            href: "/inventory",
            icon: BoxesIcon,
          },
          {
            key: "movements",
            label: "Movement History",
            href: "/inventory?tab=movements",
            icon: HistoryIcon,
          },
        ]}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Units in stock", value: inventory.totalUnits },
          { label: "Products stocked", value: inventory.productsInStock },
          {
            label: "Products to buy",
            value: inventory.productsShort,
            amber: inventory.productsShort > 0,
          },
          {
            label: "Stock value",
            value: formatMoney(inventory.totalValue),
            green: true,
          },
        ].map((stat) => (
          <div key={stat.label} className="rounded-lg bg-gray-50 px-4 py-3">
            <p className="text-[11px] uppercase tracking-widest text-gray-400">
              {stat.label}
            </p>
            <p
              className={`mt-1 text-xl font-semibold tabular-nums ${
                stat.green
                  ? "text-green-700"
                  : stat.amber
                    ? "text-amber-700"
                    : "text-gray-950"
              }`}
            >
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {received ? (
        <div className="rounded-lg border border-lime-200 bg-lime-50 p-3.5 text-sm text-lime-900">
          {received} unit{received === "1" ? "" : "s"} received into stock
          {balance ? ` — ${balance} now on hand` : ""}.
        </div>
      ) : null}
      {corrected ? (
        <div className="rounded-lg border border-lime-200 bg-lime-50 p-3.5 text-sm text-lime-900">
          Stock count corrected to {corrected}.
        </div>
      ) : null}
      {error === "inventory-invalid-quantity" ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3.5 text-sm text-amber-900">
          Enter the quantity received as a whole number of one or more.
        </div>
      ) : null}
      {error === "inventory-invalid-count" ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3.5 text-sm text-amber-900">
          Enter the counted quantity as a whole number of zero or more.
        </div>
      ) : null}
      {error === "inventory-reason-required" ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3.5 text-sm text-amber-900">
          Give a reason for the correction so the change can be traced later.
        </div>
      ) : null}
      {error === "inventory-no-change" ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3.5 text-sm text-amber-900">
          The counted quantity matches what the system already holds, so nothing
          was changed.
        </div>
      ) : null}
      {error === "inventory-product-not-found" ||
      error === "inventory-product-required" ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3.5 text-sm text-amber-900">
          That product could not be found. It may have been deleted.
        </div>
      ) : null}

      <div className="rounded-lg border border-blue-200 bg-blue-50 p-3.5 text-sm text-blue-900">
        A product only reaches the{" "}
        <Link
          href="/products?tab=procurement"
          className="font-medium underline underline-offset-2"
        >
          procurement list
        </Link>{" "}
        when the units its customers are owed — accounts at least{" "}
        {inventory.thresholdPercent}% paid and still awaiting delivery — run
        past what is in stock here. Receive stock and the product drops off that
        list.
      </div>

      <form className="grid max-w-3xl gap-3 sm:grid-cols-[minmax(0,1fr)_220px_auto]">
        {activeTab === "movements" ? (
          <input type="hidden" name="tab" value="movements" />
        ) : null}
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
          <input
            name="q"
            defaultValue={query}
            placeholder="Search by product or category"
            className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-green-600 focus:ring-2 focus:ring-green-600/20"
          />
        </div>
        {activeTab === "stock" ? (
          <select
            name="sort"
            defaultValue={selectedSort}
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-green-600 focus:ring-2 focus:ring-green-600/20"
          >
            <option value="name-az">Name A-Z</option>
            <option value="stock-high">Most in stock</option>
            <option value="stock-low">Least in stock</option>
            <option value="short-high">Biggest shortfall</option>
            <option value="value-high">Highest stock value</option>
          </select>
        ) : (
          <div />
        )}
        <button
          type="submit"
          className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Filter
        </button>
      </form>

      {activeTab === "stock" ? (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-3 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-gray-400">
                    Product
                  </th>
                  <th className="px-3 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-gray-400">
                    Category
                  </th>
                  <th className="px-3 py-2.5 text-right text-[11px] font-medium uppercase tracking-wider text-gray-400">
                    In stock
                  </th>
                  <th className="px-3 py-2.5 text-right text-[11px] font-medium uppercase tracking-wider text-gray-400">
                    Owed
                  </th>
                  <th className="px-3 py-2.5 text-right text-[11px] font-medium uppercase tracking-wider text-gray-400">
                    To buy
                  </th>
                  <th className="px-3 py-2.5 text-right text-[11px] font-medium uppercase tracking-wider text-gray-400">
                    Unit cost
                  </th>
                  <th className="px-3 py-2.5 text-right text-[11px] font-medium uppercase tracking-wider text-gray-400">
                    Stock value
                  </th>
                  <th className="px-3 py-2.5 text-right text-[11px] font-medium uppercase tracking-wider text-gray-400" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((row) => (
                  <tr
                    key={row.productId}
                    className="transition-colors hover:bg-gray-50/70"
                  >
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2.5">
                        <ProductImagePreview
                          src={row.imageUrl}
                          alt={row.name}
                          className="size-9 shrink-0 rounded-md bg-gray-50"
                          iconClassName="size-4"
                          previewTitle={row.name}
                        />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-gray-900">
                            {row.name}
                          </p>
                          {!row.active ? (
                            <span className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
                              Inactive
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <ProductCategoryBadge category={row.category} />
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums font-semibold text-gray-950">
                      {row.stockOnHand}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-gray-700">
                      {row.unitsOwed}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {row.shortfall > 0 ? (
                        <span className="inline-flex items-center gap-1 font-semibold text-amber-700">
                          <TriangleAlertIcon className="size-3.5" />
                          {row.shortfall}
                        </span>
                      ) : (
                        <span className="text-gray-400">0</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-gray-700">
                      {formatMoney(row.landedUnitCost)}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums font-semibold text-green-700">
                      {formatMoney(row.stockOnHand * row.landedUnitCost)}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <InventoryReceiveForm
                          productId={row.productId}
                          productName={row.name}
                          stockOnHand={row.stockOnHand}
                          suggestedQuantity={row.shortfall}
                          returnTo="/inventory"
                        />
                        <InventoryCountForm
                          productId={row.productId}
                          productName={row.name}
                          stockOnHand={row.stockOnHand}
                          returnTo="/inventory"
                        />
                        <Link
                          href={`/inventory/${row.productId}`}
                          aria-label={`View stock history for ${row.name}`}
                          title="Movement history"
                          className="group/view flex size-8 items-center justify-center rounded-md text-gray-400 transition-all duration-150 hover:bg-blue-50 hover:text-blue-600"
                        >
                          <Eye className="size-4 transition-transform duration-200 group-hover/view:scale-125 group-hover/view:-rotate-6" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              {rows.length > 0 ? (
                <tfoot>
                  <tr className="border-t bg-gray-50 font-semibold text-gray-950">
                    <td className="px-3 py-3" colSpan={2}>
                      Total
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {rows.reduce((sum, row) => sum + row.stockOnHand, 0)}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {rows.reduce((sum, row) => sum + row.unitsOwed, 0)}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-amber-700">
                      {rows.reduce((sum, row) => sum + row.shortfall, 0)}
                    </td>
                    <td className="px-3 py-3" />
                    <td className="px-3 py-3 text-right tabular-nums text-green-700">
                      {formatMoney(
                        rows.reduce(
                          (sum, row) => sum + row.stockOnHand * row.landedUnitCost,
                          0
                        )
                      )}
                    </td>
                    <td className="px-3 py-3" />
                  </tr>
                </tfoot>
              ) : null}
            </table>

            {rows.length === 0 ? (
              <div className="flex flex-col items-center gap-1 py-14 text-center">
                <p className="text-sm font-medium text-gray-700">
                  No products match this search
                </p>
                <p className="text-xs text-gray-400">
                  Clear the search to see every product and its stock.
                </p>
              </div>
            ) : null}
          </div>
        </div>
      ) : (
        <InventoryMovementsTable movements={visibleMovements} />
      )}
    </div>
  );
}
