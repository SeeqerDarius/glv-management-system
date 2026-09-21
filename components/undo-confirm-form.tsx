"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";

/**
 * Retracting is itself a change to financial records, so it asks once before
 * running. It does not ask for the administrator password again: the action
 * being retracted already did, and putting a record back is the safer
 * direction.
 */
export function UndoConfirmForm({
  action,
  id,
  returnTo,
  label,
  summary,
  caveat,
}: {
  action: (formData: FormData) => void | Promise<void>;
  id: string;
  returnTo: string;
  label: string;
  summary: string;
  caveat?: string;
}) {
  const [open, setOpen] = useState(false);

  const dialog = (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg border bg-white p-5 shadow-xl">
        <h2 className="text-lg font-semibold text-gray-950">
          Retract this action?
        </h2>
        <p className="mt-2 text-sm text-gray-700">{summary}</p>
        <p className="mt-3 text-sm text-gray-700">
          GLV will put the affected records back as they were before the{" "}
          {label.toLowerCase()}. If anything has changed since, the retraction
          is refused rather than overwriting the newer work.
        </p>
        {caveat ? <p className="mt-3 text-sm text-amber-800">{caveat}</p> : null}

        <form action={action} className="mt-4">
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="returnTo" value={returnTo} />
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <SubmitButton pendingLabel="Retracting">
              Retract action
            </SubmitButton>
          </div>
        </form>
      </div>
    </div>
  );

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="shrink-0"
        onClick={() => setOpen(true)}
      >
        <Undo2 className="size-4" />
        Undo
      </Button>
      {/*
        A parent of this panel carries a transform, which makes `position:
        fixed` resolve against that box rather than the viewport and drops the
        dialog far down the page. Portalling to the body escapes that
        containing block. The dialog only exists after a click, so it is never
        part of the server render and cannot mismatch on hydration.
      */}
      {open && typeof document !== "undefined"
        ? createPortal(dialog, document.body)
        : null}
    </>
  );
}
