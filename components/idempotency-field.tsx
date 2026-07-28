"use client";

import { useState } from "react";

export function useIdempotencyKey() {
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  return idempotencyKey;
}

export function IdempotencyField({ value }: { value: string }) {
  return (
    <input
      type="hidden"
      name="idempotencyKey"
      value={value}
      suppressHydrationWarning
    />
  );
}
