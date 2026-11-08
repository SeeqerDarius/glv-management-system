import assert from "node:assert/strict";
import test from "node:test";
import {
  resetSessionTimeoutOnSignIn,
  sessionHasTimedOut,
} from "../lib/session-timeout-rules";

test("zero disables GLV inactivity expiration", () => {
  assert.equal(sessionHasTimedOut(1_000, 0, 10_000_000), false);
});

test("a positive timeout expires at its configured idle limit", () => {
  assert.equal(sessionHasTimedOut(1_000, 60, 4_600_000), true);
  assert.equal(sessionHasTimedOut(1_000, 60, 4_599_999), false);
});

test("successful sign-in clears the expired marker and restarts the clock", () => {
  const token = { glvSessionExpired: true, glvSessionStartedAt: 1 };
  resetSessionTimeoutOnSignIn(token, 2_000);
  assert.equal(token.glvSessionExpired, undefined);
  assert.equal(token.glvSessionStartedAt, 2_000);
});
