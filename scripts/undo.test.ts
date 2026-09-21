import assert from "node:assert/strict";
import { test } from "node:test";
import {
  formatUndoCountdown,
  isReversibleActionType,
  isUndoable,
  REVERSIBLE_ACTIONS,
  UNDO_REFUSALS,
  UNDO_WINDOW_HOURS,
  UNDO_WINDOW_MS,
  undoExpiresAt,
  undoTimeRemainingMs,
} from "../lib/undo-rules";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const PERFORMED_AT = new Date("2026-09-21T09:00:00.000Z");

test("the retraction window is three hours from the action", () => {
  assert.equal(UNDO_WINDOW_HOURS, 3);
  assert.equal(UNDO_WINDOW_MS, 3 * HOUR);
  assert.deepEqual(
    undoExpiresAt(PERFORMED_AT),
    new Date("2026-09-21T12:00:00.000Z")
  );
});

test("an action stays undoable until the window closes, then never again", () => {
  const expiresAt = undoExpiresAt(PERFORMED_AT);
  const action = { expiresAt, reversedAt: null };

  assert.equal(isUndoable(action, PERFORMED_AT), true);
  assert.equal(isUndoable(action, new Date(+PERFORMED_AT + 2 * HOUR)), true);
  assert.equal(
    isUndoable(action, new Date(+expiresAt - 1)),
    true,
    "one millisecond before expiry is still inside the window"
  );
  // The boundary is exclusive, so the window cannot be used at the instant it ends.
  assert.equal(isUndoable(action, expiresAt), false);
  assert.equal(isUndoable(action, new Date(+expiresAt + 1)), false);
});

test("an action already retracted cannot be retracted again", () => {
  const expiresAt = undoExpiresAt(PERFORMED_AT);
  const reversed = { expiresAt, reversedAt: new Date(+PERFORMED_AT + MINUTE) };

  assert.equal(isUndoable(reversed, new Date(+PERFORMED_AT + 2 * HOUR)), false);
});

test("time remaining counts down and never goes negative", () => {
  const expiresAt = undoExpiresAt(PERFORMED_AT);

  assert.equal(undoTimeRemainingMs(expiresAt, PERFORMED_AT), 3 * HOUR);
  assert.equal(
    undoTimeRemainingMs(expiresAt, new Date(+PERFORMED_AT + 19 * MINUTE)),
    3 * HOUR - 19 * MINUTE
  );
  assert.equal(undoTimeRemainingMs(expiresAt, expiresAt), 0);
  assert.equal(
    undoTimeRemainingMs(expiresAt, new Date(+expiresAt + HOUR)),
    0,
    "a long-expired action reads as zero, not a negative countdown"
  );
});

test("the countdown reads the way an operator would say it", () => {
  assert.equal(formatUndoCountdown(3 * HOUR), "3h 0m left");
  assert.equal(formatUndoCountdown(2 * HOUR + 41 * MINUTE), "2h 41m left");
  assert.equal(formatUndoCountdown(9 * MINUTE), "9m left");
  assert.equal(formatUndoCountdown(59 * MINUTE + 59_000), "59m left");
  assert.equal(formatUndoCountdown(30_000), "under a minute left");
  assert.equal(formatUndoCountdown(0), "expired");
  assert.equal(formatUndoCountdown(-5_000), "expired");
});

test("every reversible action type is recognised and has a handler name", () => {
  assert.deepEqual(REVERSIBLE_ACTIONS, [
    "REACTIVATE_DORMANT_ACCOUNT",
    "DELETE_PAYMENT",
    "DELETE_STAFF_DEPOSIT",
    "DELETE_STAFF_SALARY",
    "REFUND_CUSTOMER_CREDIT",
  ]);

  for (const action of REVERSIBLE_ACTIONS) {
    assert.equal(isReversibleActionType(action), true);
  }
  // A stored row naming something else must not be treated as reversible.
  assert.equal(isReversibleActionType("DELETE_CUSTOMER"), false);
  assert.equal(isReversibleActionType(""), false);
});

test("every refusal has a message that tells the operator what to do", () => {
  for (const [code, message] of Object.entries(UNDO_REFUSALS)) {
    assert.ok(message.length > 0, `${code} has no message`);
    assert.ok(/[.!]$/.test(message), `${code} message is not a sentence`);
  }
  assert.match(UNDO_REFUSALS.expired, /3-hour/);
  assert.match(UNDO_REFUSALS["state-changed"], /Correct the record directly/);
});
