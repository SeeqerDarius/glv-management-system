import { DeliveryStatus } from "@prisma/client";
import { Truck } from "lucide-react";

type DeliveryStatusIconProps = {
  status: DeliveryStatus;
  /** True when the product was handed over before the plan was fully paid. */
  withBalance?: boolean;
};

export function DeliveryStatusIcon({
  status,
  withBalance = false,
}: DeliveryStatusIconProps) {
  const delivered = status === DeliveryStatus.DELIVERED;
  const onCredit = delivered && withBalance;
  const label = onCredit
    ? "Delivered with balance still owing"
    : delivered
      ? "Delivered"
      : "Pending delivery";

  return (
    <span
      aria-label={label}
      title={label}
      className={`inline-flex size-8 items-center justify-center rounded-full border ${
        onCredit
          ? "border-blue-200 bg-blue-50 text-blue-700"
          : delivered
            ? "border-green-200 bg-green-50 text-green-700"
            : "border-amber-200 bg-amber-50 text-amber-700"
      }`}
    >
      {delivered ? (
        <Truck className="size-4" />
      ) : (
        <span className="relative flex size-4 items-end justify-center">
          <span className="absolute bottom-0 size-2.5 animate-bounce rounded-full bg-amber-500" />
          <span className="absolute bottom-0 h-px w-4 rounded-full bg-amber-300" />
        </span>
      )}
    </span>
  );
}
