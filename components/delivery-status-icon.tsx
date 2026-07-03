import { DeliveryStatus } from "@prisma/client";
import { Truck } from "lucide-react";

type DeliveryStatusIconProps = {
  status: DeliveryStatus;
};

export function DeliveryStatusIcon({ status }: DeliveryStatusIconProps) {
  const delivered = status === DeliveryStatus.DELIVERED;
  const label = delivered ? "Delivered" : "Pending delivery";

  return (
    <span
      aria-label={label}
      title={label}
      className={`inline-flex size-8 items-center justify-center rounded-full border ${
        delivered
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
