/* eslint-disable @next/next/no-img-element */
import { PackageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type ProductImageProps = {
  src?: string | null;
  alt: string;
  className?: string;
  iconClassName?: string;
};

export function ProductImage({
  src,
  alt,
  className,
  iconClassName,
}: ProductImageProps) {
  return (
    <span
      className={cn(
        "inline-flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-md border border-gray-200 bg-gray-50 text-gray-400",
        className
      )}
    >
      {src ? (
        <img
          src={src}
          alt={alt}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      ) : (
        <PackageIcon className={cn("size-5", iconClassName)} aria-hidden="true" />
      )}
    </span>
  );
}
