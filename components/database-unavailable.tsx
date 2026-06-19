import Link from "next/link";
import { DatabaseZapIcon, RefreshCwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export function DatabaseUnavailable({
  retryHref,
  title = "Business data is temporarily unavailable",
}: {
  retryHref: string;
  title?: string;
}) {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-md bg-amber-100 text-amber-800">
          <DatabaseZapIcon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold text-amber-950">{title}</h2>
          <p className="mt-1 text-sm text-amber-900">
            GLV could not connect to the database. No data was changed. Check the
            Supabase project and try again.
          </p>
          <Button asChild variant="outline" className="mt-4 bg-white">
            <Link href={retryHref}>
              <RefreshCwIcon className="size-4" />
              Try Again
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
