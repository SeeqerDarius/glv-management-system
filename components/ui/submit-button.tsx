"use client";

import { useFormStatus } from "react-dom";
import type { ComponentProps } from "react";
import { Button } from "@/components/ui/button";
import { GlvLoading } from "@/components/glv-loading";

type SubmitButtonProps = Omit<ComponentProps<typeof Button>, "type"> & {
  pendingLabel?: string;
};

/**
 * Drop-in replacement for `<Button type="submit">` that reads the enclosing
 * `<form>`'s pending state via useFormStatus, so it works even when the form
 * lives in a Server Component and has no local pending state of its own.
 */
export function SubmitButton({
  children,
  pendingLabel = "Saving",
  disabled,
  ...props
}: SubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending || disabled} {...props}>
      {pending ? <GlvLoading compact label={pendingLabel} /> : children}
    </Button>
  );
}
