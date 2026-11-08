export type SessionTimeoutToken = {
  glvSessionStartedAt?: number;
  glvSessionExpired?: boolean;
};

export function resetSessionTimeoutOnSignIn<T extends SessionTimeoutToken>(
  token: T,
  nowSeconds: number
) {
  delete token.glvSessionExpired;
  token.glvSessionStartedAt = nowSeconds;
  return token;
}

export function sessionHasTimedOut(
  startedAtSeconds: number | undefined,
  timeoutMinutes: number,
  nowMilliseconds: number
) {
  if (
    !Number.isFinite(startedAtSeconds) ||
    !Number.isFinite(timeoutMinutes) ||
    !startedAtSeconds ||
    timeoutMinutes <= 0
  ) {
    return false;
  }

  return nowMilliseconds - startedAtSeconds * 1000 >= timeoutMinutes * 60_000;
}
