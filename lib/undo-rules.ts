/**
 * Pure rules for the retraction window. Kept free of database and server-only
 * imports so the window arithmetic is unit testable
 * (`scripts/undo.test.ts`). `lib/undo.ts` applies them to real records.
 */

/** How long an administrator has to retract a reversible action. */
export const UNDO_WINDOW_HOURS = 3;

export const UNDO_WINDOW_MS = UNDO_WINDOW_HOURS * 60 * 60 * 1000;

/** Every action type that can be retracted. */
export const REVERSIBLE_ACTIONS = [
  "REACTIVATE_DORMANT_ACCOUNT",
  "DELETE_PAYMENT",
  "DELETE_STAFF_DEPOSIT",
  "DELETE_STAFF_SALARY",
  "REFUND_CUSTOMER_CREDIT",
] as const;

export type ReversibleActionType = (typeof REVERSIBLE_ACTIONS)[number];

export function isReversibleActionType(
  value: string
): value is ReversibleActionType {
  return (REVERSIBLE_ACTIONS as readonly string[]).includes(value);
}

export function undoExpiresAt(performedAt: Date) {
  return new Date(performedAt.getTime() + UNDO_WINDOW_MS);
}

export function undoTimeRemainingMs(expiresAt: Date, now = new Date()) {
  return Math.max(expiresAt.getTime() - now.getTime(), 0);
}

/**
 * An action can still be retracted while it is unreversed and inside its
 * window. The boundary is exclusive: at exactly `expiresAt` the window is gone.
 */
export function isUndoable(
  action: { expiresAt: Date; reversedAt: Date | null },
  now = new Date()
) {
  return action.reversedAt === null && now < action.expiresAt;
}

/** "2h 41m left", "9m left", "under a minute left". */
export function formatUndoCountdown(remainingMs: number) {
  if (remainingMs <= 0) return "expired";

  const totalMinutes = Math.floor(remainingMs / 60_000);
  if (totalMinutes < 1) return "under a minute left";

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) return `${minutes}m left`;
  return `${hours}h ${minutes}m left`;
}

/** Why a retraction was refused, in words an operator can act on. */
export const UNDO_REFUSALS = {
  "not-found": "That action is no longer on record.",
  expired: `The ${UNDO_WINDOW_HOURS}-hour window for retracting this action has passed.`,
  "already-reversed": "This action was already retracted.",
  "state-changed":
    "The record changed after this action, so retracting it now would undo that newer work. Correct the record directly instead.",
  "unknown-action": "This action cannot be retracted automatically.",
  failed: "The retraction could not be completed. Nothing was changed.",
} as const;

export type UndoRefusal = keyof typeof UNDO_REFUSALS;
