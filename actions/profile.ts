"use server";

import { ProfileChangeStatus } from "@prisma/client";
import { del, put } from "@vercel/blob";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdminRole, isSuperAdminRole } from "@/lib/roles";

export type ProfileFormState = {
  error?: string;
};

export type ProfilePasswordState = {
  error?: string;
};

const maxProfileImageSize = 5 * 1024 * 1024;
const allowedProfileImageTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

function clean(value: FormDataEntryValue | null) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function lowerEmail(value: FormDataEntryValue | null) {
  return clean(value).toLowerCase();
}

function passwordError(error: string): ProfilePasswordState {
  return { error };
}

function getProfileImageFile(formData: FormData) {
  const image = formData.get("profileImage");
  return image instanceof File && image.size > 0 ? image : null;
}

function hasBlobStorageConfig() {
  return Boolean(
    process.env.BLOB_READ_WRITE_TOKEN ||
      (process.env.BLOB_STORE_ID &&
        (process.env.VERCEL || process.env.VERCEL_OIDC_TOKEN))
  );
}

function safeProfileBlobName(userId: string, file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
  return `profile-requests/${userId}-${Date.now()}.${extension}`;
}

async function uploadPendingProfileImage({
  userId,
  formData,
}: {
  userId: string;
  formData: FormData;
}) {
  const image = getProfileImageFile(formData);

  if (!image) return { imageUrl: null };

  if (!allowedProfileImageTypes.has(image.type)) {
    return { error: "Use a JPG, PNG, WebP, or GIF profile picture." };
  }

  if (image.size > maxProfileImageSize) {
    return { error: "Profile picture must be 5MB or smaller." };
  }

  if (!hasBlobStorageConfig()) {
    return {
      error:
        "Profile picture storage is not configured. Connect Vercel Blob to this project, then try again.",
    };
  }

  const blob = await put(safeProfileBlobName(userId, image), image, {
    access: "public",
    addRandomSuffix: true,
  }).catch(() => null);

  if (!blob) {
    return { error: "Unable to upload profile picture. Please try again." };
  }

  return { imageUrl: blob.url };
}

export async function updateMyProfile(
  _state: ProfileFormState,
  formData: FormData
): Promise<ProfileFormState> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  const userId = session.user.id;
  const fullName = clean(formData.get("fullName"));
  const phone = clean(formData.get("phone"));
  const submittedPosition = clean(formData.get("position"));
  const requestedEmail = lowerEmail(formData.get("email"));

  if (!fullName) {
    return { error: "Full name is required." };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { staff: true },
  });

  if (!user) {
    return { error: "Profile was not found." };
  }

  const canUpdatePosition = isAdminRole(session.user.role);
  const position = canUpdatePosition
    ? submittedPosition
    : (user.staff?.position ?? "");

  const emailChanged = requestedEmail && requestedEmail !== user.email.toLowerCase();
  if (emailChanged) {
    const duplicate = await prisma.user.findFirst({
      where: {
        email: { equals: requestedEmail, mode: "insensitive" },
        NOT: { id: userId },
      },
      select: { id: true },
    });

    if (duplicate) {
      return { error: "That email address is already in use." };
    }
  }

  const imageResult = await uploadPendingProfileImage({ userId, formData });
  if (imageResult.error) {
    return { error: imageResult.error };
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { name: fullName },
    });

    if (user.staffId) {
      await tx.staff.update({
        where: { id: user.staffId },
        data: {
          fullName,
          phone: phone || null,
          ...(canUpdatePosition ? { position: position || null } : {}),
        },
      });
    }

    if (emailChanged || imageResult.imageUrl) {
      const request = await tx.profileChangeRequest.create({
        data: {
          userId,
          requestedEmail: emailChanged ? requestedEmail : null,
          requestedProfileImageUrl: imageResult.imageUrl,
        },
      });

      await tx.auditLog.create({
        data: {
          userId,
          action: "REQUEST_PROFILE_CHANGE",
          entity: "ProfileChangeRequest",
          entityId: request.id,
          newValue: JSON.stringify({
            requestedEmail: request.requestedEmail,
            requestedProfileImageUrl: Boolean(request.requestedProfileImageUrl),
          }),
        },
      });
    }

    await tx.auditLog.create({
      data: {
        userId,
        action: "UPDATE_PROFILE_DETAILS",
        entity: "User",
        entityId: userId,
        oldValue: JSON.stringify({
          name: user.name,
          phone: user.staff?.phone ?? null,
          position: user.staff?.position ?? null,
        }),
        newValue: JSON.stringify({ fullName, phone, position }),
      },
    });
  });

  revalidatePath("/profile");
  revalidatePath("/staff");
  revalidatePath("/", "layout");
  redirect("/profile?saved=1");
}

export async function updateMyPassword(
  _state: ProfilePasswordState,
  formData: FormData
): Promise<ProfilePasswordState> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!currentPassword || !newPassword || !confirmPassword) {
    return passwordError("missing-fields");
  }

  if (newPassword !== confirmPassword) {
    return passwordError("password-mismatch");
  }

  if (newPassword.length < 8) {
    return passwordError("password-too-short");
  }

  if (newPassword === currentPassword) {
    return passwordError("password-unchanged");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      password: true,
      mustChangePassword: true,
    },
  });

  if (!user) {
    return passwordError("profile-not-found");
  }

  const validPassword = await bcrypt.compare(currentPassword, user.password);

  if (!validPassword) {
    return passwordError("invalid-current-password");
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        mustChangePassword: false,
      },
    });

    await tx.auditLog.create({
      data: {
        userId: user.id,
        action: "CHANGE_OWN_PASSWORD",
        entity: "User",
        entityId: user.id,
        oldValue: JSON.stringify({
          mustChangePassword: user.mustChangePassword,
        }),
        newValue: JSON.stringify({
          mustChangePassword: false,
        }),
      },
    });
  });

  revalidatePath("/profile");
  revalidatePath("/", "layout");
  redirect("/profile?passwordChanged=1");
}

async function requireSuperAdmin() {
  const session = await auth();
  if (!session?.user?.id || !isSuperAdminRole(session.user.role)) {
    throw new Error("Unauthorized");
  }

  return { id: session.user.id };
}

export async function approveProfileChange(formData: FormData): Promise<void> {
  const reviewer = await requireSuperAdmin();
  const id = clean(formData.get("id"));

  const request = await prisma.profileChangeRequest.findUnique({
    where: { id },
    include: { user: { include: { staff: true } } },
  });

  if (!request || request.status !== ProfileChangeStatus.PENDING) {
    redirect("/profile/approvals?error=request-not-found");
  }

  if (request.requestedEmail) {
    const duplicate = await prisma.user.findFirst({
      where: {
        email: { equals: request.requestedEmail, mode: "insensitive" },
        NOT: { id: request.userId },
      },
      select: { id: true },
    });

    if (duplicate) {
      redirect("/profile/approvals?error=email-in-use");
    }
  }

  await prisma.$transaction(async (tx) => {
    const userData: { email?: string; profileImageUrl?: string } = {};
    const staffData: { email?: string } = {};

    if (request.requestedEmail) {
      userData.email = request.requestedEmail;
      staffData.email = request.requestedEmail;
    }

    if (request.requestedProfileImageUrl) {
      userData.profileImageUrl = request.requestedProfileImageUrl;
    }

    if (Object.keys(userData).length > 0) {
      await tx.user.update({
        where: { id: request.userId },
        data: userData,
      });
    }

    if (request.user.staffId && staffData.email) {
      await tx.staff.update({
        where: { id: request.user.staffId },
        data: staffData,
      });
    }

    const updated = await tx.profileChangeRequest.update({
      where: { id },
      data: {
        status: ProfileChangeStatus.APPROVED,
        reviewedBy: reviewer.id,
        reviewedAt: new Date(),
      },
    });

    await tx.auditLog.create({
      data: {
        userId: reviewer.id,
        action: "APPROVE_PROFILE_CHANGE",
        entity: "ProfileChangeRequest",
        entityId: updated.id,
        newValue: JSON.stringify({
          userId: request.userId,
          emailApproved: Boolean(request.requestedEmail),
          imageApproved: Boolean(request.requestedProfileImageUrl),
        }),
      },
    });
  });

  revalidatePath("/profile");
  revalidatePath("/profile/approvals");
  revalidatePath("/staff");
  revalidatePath("/", "layout");
  redirect("/profile/approvals?reviewed=approved");
}

export async function rejectProfileChange(formData: FormData): Promise<void> {
  const reviewer = await requireSuperAdmin();
  const id = clean(formData.get("id"));
  const rejectionReason = clean(formData.get("rejectionReason"));

  const request = await prisma.profileChangeRequest.findUnique({
    where: { id },
  });

  if (!request || request.status !== ProfileChangeStatus.PENDING) {
    redirect("/profile/approvals?error=request-not-found");
  }

  await prisma.$transaction(async (tx) => {
    const updated = await tx.profileChangeRequest.update({
      where: { id },
      data: {
        status: ProfileChangeStatus.REJECTED,
        reviewedBy: reviewer.id,
        reviewedAt: new Date(),
        rejectionReason: rejectionReason || null,
      },
    });

    await tx.auditLog.create({
      data: {
        userId: reviewer.id,
        action: "REJECT_PROFILE_CHANGE",
        entity: "ProfileChangeRequest",
        entityId: updated.id,
        oldValue: JSON.stringify({
          userId: request.userId,
          emailRejected: Boolean(request.requestedEmail),
          imageRejected: Boolean(request.requestedProfileImageUrl),
        }),
        newValue: JSON.stringify({ rejectionReason: rejectionReason || null }),
      },
    });
  });

  if (request.requestedProfileImageUrl) {
    await del(request.requestedProfileImageUrl).catch(() => undefined);
  }

  revalidatePath("/profile");
  revalidatePath("/profile/approvals");
  redirect("/profile/approvals?reviewed=rejected");
}
