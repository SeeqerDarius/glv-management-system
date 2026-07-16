"use client";

import { useEffect, useState, type ChangeEvent } from "react";
import { ProfileAvatar } from "@/components/profile-avatar";

type StaffProfileImageFieldProps = {
  currentImageUrl?: string | null;
  name?: string | null;
};

export function StaffProfileImageField({
  currentImageUrl,
  name,
}: StaffProfileImageFieldProps) {
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
    <div className="flex flex-wrap items-center gap-4 rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4">
      <ProfileAvatar
        name={name}
        src={previewUrl ?? currentImageUrl}
        className="size-20 text-2xl"
      />
      <label className="min-w-0 flex-1 space-y-2">
        <span className="block text-sm font-semibold text-gray-900">
          Profile Picture
        </span>
        <span className="block text-xs leading-5 text-gray-500">
          Upload a clear staff photo. It will appear beside the staff name in
          the staff section and profile areas.
        </span>
        <input
          name="profileImage"
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          onChange={handleImageChange}
          className="block w-full rounded border bg-white p-2 text-sm"
        />
      </label>
    </div>
  );
}
