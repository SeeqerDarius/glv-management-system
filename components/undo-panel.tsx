import { Undo2 } from "lucide-react";
import { undoAction } from "@/actions/undo";
import { UndoConfirmForm } from "@/components/undo-confirm-form";
import {
  formatUndoCountdown,
  undoTimeRemainingMs,
  UNDO_REFUSALS,
  UNDO_WINDOW_HOURS,
  type UndoRefusal,
} from "@/lib/undo-rules";
import type { UndoableAction } from "@/lib/undo";

const ACTION_LABELS: Record<string, string> = {
  REACTIVATE_DORMANT_ACCOUNT: "Account reactivated",
  DELETE_PAYMENT: "Payment deleted",
  DELETE_STAFF_DEPOSIT: "Staff deposit deleted",
  DELETE_STAFF_SALARY: "Salary payment deleted",
  REFUND_CUSTOMER_CREDIT: "Credit refunded",
};

/** Consequences a retraction cannot reach, so the operator is not surprised. */
const ACTION_CAVEATS: Record<string, string> = {
  REACTIVATE_DORMANT_ACCOUNT:
    "The reactivation calculation already sent to the customer is not withdrawn.",
};

function timeOfDay(value: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

export function UndoNotice({
  undone,
  undoError,
}: {
  undone?: string;
  undoError?: string;
}) {
  if (undone) {
    return (
      <p className="rounded-md border border-lime-200 bg-lime-50 p-3 text-sm text-lime-900">
        {ACTION_LABELS[undone] ?? "Action"} retracted. The records it changed
        have been put back.
      </p>
    );
  }

  if (undoError) {
    return (
      <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
        {UNDO_REFUSALS[undoError as UndoRefusal] ?? UNDO_REFUSALS.failed}
      </p>
    );
  }

  return null;
}

/**
 * Lists actions still inside their retraction window. Rendered on the pages
 * where the actions happen, so an administrator who has just made a mistake
 * sees the way back without going looking for it.
 */
export function UndoPanel({
  actions,
  returnTo,
  title = "Recently done — still reversible",
  emptyMessage,
  now = new Date(),
}: {
  actions: UndoableAction[];
  returnTo: string;
  title?: string;
  emptyMessage?: string;
  now?: Date;
}) {
  if (actions.length === 0) {
    if (!emptyMessage) return null;

    return (
      <section className="rounded-lg border bg-white p-4">
        <h2 className="text-sm font-semibold text-gray-950">{title}</h2>
        <p className="mt-1 text-sm text-gray-500">{emptyMessage}</p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-amber-200 bg-amber-50/60 p-4">
      <div className="mb-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-950">
          <Undo2 className="size-4" />
          {title}
        </h2>
        <p className="text-xs text-gray-600">
          An administrator can retract each of these for {UNDO_WINDOW_HOURS}{" "}
          hours. After that the record stands and must be corrected directly.
        </p>
      </div>

      <ul className="space-y-2">
        {actions.map((action) => {
          const remaining = undoTimeRemainingMs(action.expiresAt, now);
          const caveat = ACTION_CAVEATS[action.action];

          return (
            <li
              key={action.id}
              className="flex flex-col gap-3 rounded-md border bg-white p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-950">
                  {ACTION_LABELS[action.action] ?? action.action}
                </p>
                <p className="mt-0.5 text-sm text-gray-700">{action.summary}</p>
                <p className="mt-1 text-xs text-gray-500">
                  {action.performedByName} at {timeOfDay(action.performedAt)} ·{" "}
                  <span className="font-medium text-amber-800">
                    {formatUndoCountdown(remaining)}
                  </span>
                </p>
                {caveat ? (
                  <p className="mt-1 text-xs text-gray-500">{caveat}</p>
                ) : null}
              </div>

              <UndoConfirmForm
                action={undoAction}
                id={action.id}
                returnTo={returnTo}
                label={ACTION_LABELS[action.action] ?? action.action}
                summary={action.summary}
                caveat={caveat}
              />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
