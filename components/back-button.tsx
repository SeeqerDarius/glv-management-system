"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

export function BackButton({
  fallbackHref,
  label = "Go back",
  className,
  children,
}: {
  fallbackHref: string;
  label?: string;
  className?: string;
  children?: ReactNode;
}) {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => {
        if (window.history.length > 1) {
          router.back();
        } else {
          router.replace(fallbackHref);
        }
      }}
      aria-label={label}
      title="Back"
      className={className}
    >
      {children ?? <ArrowLeft className="size-4" />}
    </button>
  );
}
