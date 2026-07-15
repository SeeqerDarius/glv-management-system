"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { ProductImage } from "@/components/product-image";
import { cn } from "@/lib/utils";

type ProductImagePreviewProps = {
  src?: string | null;
  alt: string;
  className?: string;
  iconClassName?: string;
  imageClassName?: string;
  previewTitle?: string;
};

export function ProductImagePreview({
  src,
  alt,
  className,
  iconClassName,
  imageClassName,
  previewTitle,
}: ProductImagePreviewProps) {
  const [open, setOpen] = useState(false);

  if (!src) {
    return (
      <ProductImage
        src={src}
        alt={alt}
        className={className}
        iconClassName={iconClassName}
        imageClassName={imageClassName}
      />
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group/image-preview inline-flex shrink-0 rounded-md text-left outline-none focus-visible:ring-3 focus-visible:ring-lime-500/40"
        aria-label={`Preview ${alt}`}
        title="Preview picture"
      >
        <ProductImage
          src={src}
          alt={alt}
          className={cn(
            "transition duration-150 group-hover/image-preview:brightness-95",
            className
          )}
          iconClassName={iconClassName}
          imageClassName={imageClassName}
        />
      </button>

      {open ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/75 p-4">
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label="Close picture preview"
            onClick={() => setOpen(false)}
          />
          <div className="relative z-10 flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl">
            <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
              <p className="min-w-0 truncate text-sm font-semibold text-gray-950">
                {previewTitle ?? alt}
              </p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex size-9 shrink-0 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                aria-label="Close picture preview"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="flex min-h-0 flex-1 items-center justify-center bg-gray-950 p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt={alt}
                className="max-h-[78vh] max-w-full object-contain"
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
