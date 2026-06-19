"use client";

import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

type ConfirmDeleteFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  id: string;
  children: ReactNode;
  title: string;
  description?: string;
  requireAdminPassword?: boolean;
  buttonVariant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  buttonSize?:
    | "default"
    | "xs"
    | "sm"
    | "lg"
    | "icon"
    | "icon-xs"
    | "icon-sm"
    | "icon-lg";
};

export function ConfirmDeleteForm({
  action,
  id,
  children,
  title,
  description = "This action may remove important business records. Are you sure you want to continue?",
  requireAdminPassword = true,
  buttonVariant = "destructive",
  buttonSize = "sm",
}: ConfirmDeleteFormProps) {
  const [open, setOpen] = useState(false);
  const [confirmationText, setConfirmationText] = useState("");
  const canSubmit = confirmationText === "DELETE";

  return (
    <>
      <Button
        type="button"
        variant={buttonVariant}
        size={buttonSize}
        onClick={() => setOpen(true)}
      >
        {children}
      </Button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg border bg-white p-5 shadow-xl">
            <h2 className="text-lg font-semibold text-gray-950">{title}</h2>
            <p className="mt-2 text-sm text-red-700">{description}</p>
            <p className="mt-3 text-sm text-gray-700">
              Type <span className="font-semibold">DELETE</span> to continue.
            </p>

            <form action={action} className="mt-4 space-y-4">
              <input type="hidden" name="id" value={id} />
              <input
                name="confirmationText"
                value={confirmationText}
                onChange={(event) => setConfirmationText(event.target.value)}
                className="w-full rounded border p-3"
                autoComplete="off"
                placeholder="DELETE"
              />

              {requireAdminPassword ? (
                <label className="block space-y-1">
                  <span className="text-sm font-medium text-gray-700">
                    Admin password
                  </span>
                  <input
                    name="adminPassword"
                    type="password"
                    className="w-full rounded border p-3"
                    autoComplete="current-password"
                    required
                  />
                </label>
              ) : null}

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setOpen(false);
                    setConfirmationText("");
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="destructive" disabled={!canSubmit}>
                  Delete
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
