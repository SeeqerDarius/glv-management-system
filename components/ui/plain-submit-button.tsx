"use client";

import { useFormStatus } from "react-dom";
import type { ComponentProps } from "react";
import { Loader2Icon } from "lucide-react";
import { cn } from "@/lib/utils";

type PlainSubmitButtonProps = Omit<ComponentProps<"button">, "type"> & {
  /** Text shown next to the spinner while pending. Omit for icon-only buttons. */
  pendingLabel?: string;
  /** True when `children` is just an icon, so pending swaps it for a spinner instead of adding a label. */
  iconOnly?: boolean;
};

/**
 * Drop-in replacement for a raw `<button type="submit">` that reads the
 * enclosing `<form>`'s pending state via useFormStatus. Use this instead of
 * SubmitButton when the button is styled with bespoke Tailwind classes
 * rather than the shadcn Button component.
 */
export function PlainSubmitButton({
  children,
  className,
  pendingLabel,
  iconOnly = false,
  disabled,
  ...props
}: PlainSubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending || disabled}
      aria-busy={pending}
      className={cn(className, "disabled:cursor-not-allowed disabled:opacity-60")}
      {...props}
    >
      {pending ? (
        iconOnly ? (
          <Loader2Icon className="size-4 animate-spin" />
        ) : (
          <span className="inline-flex items-center gap-2">
            <Loader2Icon className="size-4 animate-spin" />
            {pendingLabel ?? children}
          </span>
        )
      ) : (
        children
      )}
    </button>
  );
}
