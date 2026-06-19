"use client";

import { useEffect } from "react";
import Link from "next/link";
import { CircleAlertIcon, HouseIcon, RefreshCwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-lg rounded-lg border bg-white p-6 text-center shadow-lg">
        <span className="mx-auto inline-flex size-12 items-center justify-center rounded-md bg-amber-100 text-amber-800">
          <CircleAlertIcon className="size-6" />
        </span>
        <h1 className="mt-4 text-2xl font-bold text-gray-950">
          GLV could not load this page
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          The database or another required service may be temporarily unavailable.
          No changes were made.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Button type="button" onClick={reset}>
            <RefreshCwIcon className="size-4" />
            Try Again
          </Button>
          <Button asChild variant="outline">
            <Link href="/dashboard">
              <HouseIcon className="size-4" />
              Dashboard
            </Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
