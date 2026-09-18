import Link from "next/link";
import type { InventoryMovementRow } from "@/lib/inventory";
import { inventoryReasonLabel } from "@/lib/inventory";

function formatMoment(value: Date) {
  return value.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * The stock ledger. Shared by the inventory tab and a single product's page, so
 * a movement reads the same wherever it is seen.
 */
export function InventoryMovementsTable({
  movements,
  hideProduct = false,
}: {
  movements: InventoryMovementRow[];
  hideProduct?: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="px-3 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-gray-400">
                When
              </th>
              {hideProduct ? null : (
                <th className="px-3 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-gray-400">
                  Product
                </th>
              )}
              <th className="px-3 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-gray-400">
                Reason
              </th>
              <th className="px-3 py-2.5 text-right text-[11px] font-medium uppercase tracking-wider text-gray-400">
                Change
              </th>
              <th className="px-3 py-2.5 text-right text-[11px] font-medium uppercase tracking-wider text-gray-400">
                Balance
              </th>
              <th className="px-3 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-gray-400">
                By
              </th>
              <th className="px-3 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-gray-400">
                Note
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {movements.map((movement) => (
              <tr
                key={movement.id}
                className="transition-colors hover:bg-gray-50/70"
              >
                <td className="whitespace-nowrap px-3 py-3 text-gray-600">
                  {formatMoment(movement.createdAt)}
                </td>
                {hideProduct ? null : (
                  <td className="px-3 py-3 font-medium text-gray-900">
                    {movement.productName}
                  </td>
                )}
                <td className="px-3 py-3 text-gray-700">
                  {inventoryReasonLabel(movement.reason)}
                </td>
                <td
                  className={`px-3 py-3 text-right tabular-nums font-semibold ${
                    movement.delta < 0 ? "text-red-700" : "text-green-700"
                  }`}
                >
                  {movement.delta > 0 ? `+${movement.delta}` : movement.delta}
                </td>
                <td className="px-3 py-3 text-right tabular-nums text-gray-950">
                  {movement.balanceAfter}
                </td>
                <td className="px-3 py-3 text-gray-700">
                  {movement.createdByName}
                </td>
                <td className="px-3 py-3 text-gray-600">
                  {movement.accountId ? (
                    <Link
                      href={`/accounts/${movement.accountId}`}
                      className="font-medium text-green-700 hover:underline"
                    >
                      {movement.note ?? "View account"}
                    </Link>
                  ) : (
                    movement.note ?? "—"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {movements.length === 0 ? (
          <div className="flex flex-col items-center gap-1 py-14 text-center">
            <p className="text-sm font-medium text-gray-700">
              No stock movements yet
            </p>
            <p className="text-xs text-gray-400">
              Receiving stock, delivering a product or correcting a count all
              show up here.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
