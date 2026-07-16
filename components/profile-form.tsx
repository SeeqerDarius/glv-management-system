"use client";

import { useActionState, useEffect, useState, type ChangeEvent } from "react";
import type { ProfileFormState } from "@/actions/profile";
import { Button } from "@/components/ui/button";
import { GlvLoading } from "@/components/glv-loading";

type ProfileFormProps = {
  action: (
    state: ProfileFormState,
    formData: FormData
  ) => Promise<ProfileFormState>;
  canEditPosition: boolean;
  user: {
    name: string;
    email: string;
    profileImageUrl?: string | null;
    staff?: {
      phone?: string | null;
      position?: string | null;
    } | null;
  };
};

const initialState: ProfileFormState = {};

export function ProfileForm({ action, canEditPosition, user }: ProfileFormProps) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setPreviewUrl(file ? URL.createObjectURL(file) : null);
  }

  return (
    <form
      action={formAction}
      encType="multipart/form-data"
      className="space-y-5 rounded-lg border bg-white p-5"
    >
      {state.error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {state.error}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-4 rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4">
        <div className="flex size-20 items-center justify-center overflow-hidden rounded-full border bg-white text-2xl font-bold text-green-900">
          {previewUrl || user.profileImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl ?? user.profileImageUrl ?? ""}
              alt={user.name}
              className="h-full w-full object-cover"
            />
          ) : (
            user.name.slice(0, 1).toUpperCase()
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-sm font-semibold text-gray-900">Profile Picture</p>
          <p className="text-xs leading-5 text-gray-500">
            Uploaded profile pictures are sent to Super Admin for approval before
            they appear on your account.
          </p>
          <input
            name="profileImage"
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            onChange={handleImageChange}
            className="block w-full rounded border bg-white p-2 text-sm"
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1.5">
          <span className="text-sm font-medium text-gray-700">Full Name</span>
          <input
            name="fullName"
            defaultValue={user.name}
            className="w-full rounded border p-3"
            required
          />
        </label>
        <label className="space-y-1.5">
          <span className="text-sm font-medium text-gray-700">Email Address</span>
          <input
            name="email"
            type="email"
            defaultValue={user.email}
            className="w-full rounded border p-3"
            required
          />
          <span className="block text-xs text-gray-500">
            Email changes require Super Admin approval.
          </span>
        </label>
        <label className="space-y-1.5">
          <span className="text-sm font-medium text-gray-700">Phone</span>
          <input
            name="phone"
            defaultValue={user.staff?.phone ?? ""}
            className="w-full rounded border p-3"
          />
        </label>
        {canEditPosition ? (
          <label className="space-y-1.5">
            <span className="text-sm font-medium text-gray-700">Position</span>
            <input
              name="position"
              defaultValue={user.staff?.position ?? ""}
              className="w-full rounded border p-3"
            />
          </label>
        ) : null}
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? <GlvLoading compact label="Saving" /> : "Save Profile"}
      </Button>
    </form>
  );
}
