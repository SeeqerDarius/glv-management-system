"use server";

import { UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { put } from "@vercel/blob";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { isAdminRole, isSuperAdminRole } from "@/lib/roles";
import { verifyAdminDeleteConfirmation } from "@/lib/admin-delete";
import { parsePermissions } from "@/lib/permissions";
import { getSettings } from "@/lib/settings";
import { getMonthStart } from "@/lib/salary-history";

export type StaffFormState = {
  errors?: {
    fullName?: string;
    email?: string;
    code?: string;
    profileImage?: string;
    form?: string;
  };
  credentials?: {
    fullName: string;
    email: string;
    code: string;
    temporaryPassword: string;
  };
};

export type StaffPasswordResetState = {
  error?: string;
  credentials?: {
    fullName: string;
    email: string;
    temporaryPassword: string;
  };
};

const codeOverrides: Record<string, string> = {
  perpetual: "PEP",
  rebecca: "BEX",
  philomena: "PHIL",
  victoria: "VIC",
};

const maxProfileImageSize = 5 * 1024 * 1024;
const allowedProfileImageTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

async function requireStaffManager() {
  const session = await auth();

  if (!session?.user?.id || !isSuperAdminRole(session.user.role)) {
    throw new Error("Unauthorized");
  }

  return {
    id: session.user.id,
    role: session.user.role,
    permissions: session.user.permissions ?? [],
  };
}

async function requireAdmin() {
  const session = await auth();

  if (!session?.user?.id || !isSuperAdminRole(session.user.role)) {
    throw new Error("Unauthorized");
  }

  return {
    id: session.user.id,
    role: session.user.role,
  };
}

function cleanInput(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

function hasBlobStorageConfig() {
  return Boolean(
    process.env.BLOB_READ_WRITE_TOKEN ||
      (process.env.BLOB_STORE_ID &&
        (process.env.VERCEL || process.env.VERCEL_OIDC_TOKEN))
  );
}

function getProfileImageFile(formData: FormData) {
  const image = formData.get("profileImage");
  return image instanceof File && image.size > 0 ? image : null;
}

function safeStaffProfileBlobName(staffKey: string, file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
  return `staff-profiles/${staffKey}-${Date.now()}.${extension}`;
}

async function uploadStaffProfileImage({
  staffKey,
  formData,
}: {
  staffKey: string;
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

  const blob = await put(safeStaffProfileBlobName(staffKey, image), image, {
    access: "public",
    addRandomSuffix: true,
  }).catch(() => null);

  if (!blob) {
    return { error: "Unable to upload profile picture. Please try again." };
  }

  return { imageUrl: blob.url };
}

function baseStaffCode(fullName: string, codeLength = 3) {
  const firstName = fullName.trim().split(/\s+/)[0]?.toLowerCase() ?? "";
  const override = codeOverrides[firstName];

  if (override) return override;

  return firstName
    .replace(/[^a-z]/g, "")
    .slice(0, codeLength)
    .toUpperCase();
}

function generateTemporaryPassword(minLength = 8) {
  const password = `GLV-${randomBytes(6).toString("base64url")}9!`;
  if (password.length >= minLength) return password;

  return `${password}${randomBytes(Math.ceil((minLength - password.length) / 2)).toString("hex")}`;
}

async function logStaffAudit({
  userId,
  action,
  staffId,
  oldValue,
  newValue,
}: {
  userId: string;
  action: string;
  staffId: string;
  oldValue?: unknown;
  newValue?: unknown;
}) {
  await prisma.auditLog.create({
    data: {
      userId,
      action,
      entity: "Staff",
      entityId: staffId,
      oldValue: oldValue ? JSON.stringify(oldValue) : null,
      newValue: newValue ? JSON.stringify(newValue) : null,
    },
  });
}

export async function generateStaffCode(fullName: string, currentStaffId?: string) {
  const settings = await getSettings();
  const baseCode = baseStaffCode(fullName, settings.staffCodeLength);

  if (!baseCode) {
    throw new Error("Staff name must contain letters.");
  }

  let code = baseCode;
  let suffix = 2;

  while (true) {
    const existing = await prisma.staff.findUnique({
      where: {
        code,
      },
      select: {
        id: true,
      },
    });

    if (!existing || existing.id === currentStaffId) {
      return code;
    }

    code = `${baseCode}${suffix}`;
    suffix += 1;
  }
}

export async function createStaff(
  _state: StaffFormState,
  formData: FormData
): Promise<StaffFormState> {
  const user = await requireStaffManager();

  const fullName = cleanInput(formData.get("fullName"));
  const position = cleanInput(formData.get("position"));
  const email = cleanInput(formData.get("email")).toLowerCase();
  const phone = cleanInput(formData.get("phone"));
  const submittedCode = cleanInput(formData.get("code")).toUpperCase();
  const errors: StaffFormState["errors"] = {};

  if (!fullName) errors.fullName = "Full name is required.";
  if (!email) errors.email = "Email is required.";

  if (Object.keys(errors).length > 0) {
    return {
      errors,
    };
  }

  const code = submittedCode || (await generateStaffCode(fullName));

  const staffWithEmail = await prisma.staff.findUnique({
    where: {
      email,
    },
    select: {
      id: true,
    },
  });
  const userWithEmail = await prisma.user.findUnique({
    where: {
      email,
    },
    select: {
      id: true,
    },
  });
  const staffWithCode = await prisma.staff.findUnique({
    where: {
      code,
    },
    select: {
      id: true,
    },
  });

  if (staffWithEmail || userWithEmail) {
    return {
      errors: {
        email: "A staff member or user with this email already exists.",
      },
    };
  }

  if (staffWithCode) {
    return {
      errors: {
        code: "This staff code is already in use.",
      },
    };
  }

  const settings = await getSettings();
  const temporaryPassword = generateTemporaryPassword(settings.passwordLength);
  const hashedPassword = await bcrypt.hash(temporaryPassword, 10);
  const imageResult = await uploadStaffProfileImage({
    staffKey: code.toLowerCase(),
    formData,
  });

  if (imageResult.error) {
    return {
      errors: {
        profileImage: imageResult.error,
      },
    };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const createdStaff = await tx.staff.create({
        data: {
          fullName,
          position: position || null,
          email,
          code,
          phone: phone || null,
          monthlySalary: settings.defaultMonthlySalary,
        },
      });

      await tx.staffSalaryHistory.create({
        data: {
          staffId: createdStaff.id,
          monthlySalary: settings.defaultMonthlySalary,
          effectiveMonth: getMonthStart(createdStaff.createdAt),
          createdBy: user.id,
        },
      });

      const createdUser = await tx.user.create({
        data: {
          name: fullName,
          email,
          password: hashedPassword,
          role: UserRole.STAFF,
          mustChangePassword: true,
          staffId: createdStaff.id,
          profileImageUrl: imageResult.imageUrl,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: "CREATE_STAFF",
          entity: "Staff",
          entityId: createdStaff.id,
          newValue: JSON.stringify({
            staffId: createdStaff.id,
            userId: createdUser.id,
            email,
            code,
            role: UserRole.STAFF,
            mustChangePassword: true,
          }),
        },
      });
    });
  } catch {
    return {
      errors: {
        form: "Unable to create staff login. Please check the details and try again.",
      },
    };
  }

  revalidatePath("/staff");
  revalidatePath("/profile");

  return {
    credentials: {
      fullName,
      email,
      code,
      temporaryPassword,
    },
  };
}

export async function updateStaff(formData: FormData): Promise<void> {
  const user = await requireStaffManager();

  const id = cleanInput(formData.get("id"));
  const fullName = cleanInput(formData.get("fullName"));
  const position = cleanInput(formData.get("position"));
  const email = cleanInput(formData.get("email")).toLowerCase();
  const phone = cleanInput(formData.get("phone"));
  const submittedCode = cleanInput(formData.get("code")).toUpperCase();
  const code = submittedCode || (await generateStaffCode(fullName, id));
  const active = formData.get("active") === "on";

  const existingStaff = await prisma.staff.findUnique({
    where: {
      id,
    },
    include: {
      user: true,
    },
  });

  if (!existingStaff) {
    redirect("/staff?error=staff-not-found");
  }

  const submittedMonthlySalary = Number(cleanInput(formData.get("monthlySalary")));
  const monthlySalary = isAdminRole(user.role)
    ? Number.isFinite(submittedMonthlySalary) && submittedMonthlySalary >= 0
      ? submittedMonthlySalary
      : existingStaff.monthlySalary
    : existingStaff.monthlySalary;

  const canGrantPrivileges = isAdminRole(user.role);
  const requestedPermissions = canGrantPrivileges
    ? parsePermissions(formData.getAll("permissions"))
    : existingStaff.user?.permissions ?? [];
  const imageResult = await uploadStaffProfileImage({
    staffKey: existingStaff.user?.id ?? existingStaff.id,
    formData,
  });

  if (imageResult.error) {
    redirect(`/staff/${id}/edit?error=profile-image`);
  }

  const staff = await prisma.$transaction(async (tx) => {
    const updatedStaff = await tx.staff.update({
      where: {
        id,
      },
      data: {
        fullName,
        position: position || null,
        email,
        code,
        phone: phone || null,
        active,
        monthlySalary,
      },
    });

    if (isAdminRole(user.role) && monthlySalary !== existingStaff.monthlySalary) {
      await tx.staffSalaryHistory.upsert({
        where: {
          staffId_effectiveMonth: {
            staffId: updatedStaff.id,
            effectiveMonth: getMonthStart(),
          },
        },
        update: {
          monthlySalary,
          createdBy: user.id,
        },
        create: {
          staffId: updatedStaff.id,
          monthlySalary,
          effectiveMonth: getMonthStart(),
          createdBy: user.id,
        },
      });
    }

    if (existingStaff.user) {
      await tx.user.update({
        where: {
          id: existingStaff.user.id,
        },
        data: {
          name: updatedStaff.fullName,
          email: updatedStaff.email,
          ...(imageResult.imageUrl
            ? {
                profileImageUrl: imageResult.imageUrl,
              }
            : {}),
          ...(canGrantPrivileges
            ? {
                permissions: requestedPermissions,
              }
            : {}),
        },
      });

      if (
        canGrantPrivileges &&
        JSON.stringify(existingStaff.user.permissions) !==
          JSON.stringify(requestedPermissions)
      ) {
        await tx.auditLog.create({
          data: {
            userId: user.id,
            action: "UPDATE_USER_PRIVILEGES",
            entity: "User",
            entityId: existingStaff.user.id,
            oldValue: JSON.stringify({
              permissions: existingStaff.user.permissions,
            }),
            newValue: JSON.stringify({
              permissions: requestedPermissions,
              staffId: updatedStaff.id,
            }),
          },
        });
      }
    }

    return updatedStaff;
  });

  await logStaffAudit({
    userId: user.id,
    action: "UPDATE_STAFF",
    staffId: staff.id,
    oldValue: existingStaff,
    newValue: staff,
  });

  revalidatePath("/staff");
  revalidatePath("/profile");
  revalidatePath(`/staff/${staff.id}`);
  revalidatePath("/", "layout");
  redirect("/staff");
}

export async function deactivateStaff(formData: FormData): Promise<void> {
  const user = await requireStaffManager();

  const id = cleanInput(formData.get("id"));
  const existingStaff = await prisma.staff.findUnique({
    where: {
      id,
    },
  });

  const staff = await prisma.staff.update({
    where: {
      id,
    },
    data: {
      active: false,
    },
  });

  await logStaffAudit({
    userId: user.id,
    action: "DEACTIVATE_STAFF",
    staffId: staff.id,
    oldValue: existingStaff,
    newValue: staff,
  });

  revalidatePath("/staff");
}

export async function resetStaffPassword(
  _state: StaffPasswordResetState,
  formData: FormData
): Promise<StaffPasswordResetState> {
  const user = await requireStaffManager();
  const id = cleanInput(formData.get("id"));
  const settings = await getSettings();
  const temporaryPassword = generateTemporaryPassword(settings.passwordLength);
  const hashedPassword = await bcrypt.hash(temporaryPassword, 10);

  const staff = await prisma.staff.findUnique({
    where: {
      id,
    },
    include: {
      user: true,
    },
  });

  if (!staff?.user) {
    return {
      error: "This staff member does not have a login account yet.",
    };
  }

  const staffUser = staff.user;

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: {
        id: staffUser.id,
      },
      data: {
        password: hashedPassword,
        mustChangePassword: true,
      },
    });

    await tx.auditLog.create({
      data: {
        userId: user.id,
        action: "RESET_STAFF_PASSWORD",
        entity: "User",
        entityId: staffUser.id,
        newValue: JSON.stringify({
          staffId: staff.id,
          email: staff.email,
          mustChangePassword: true,
        }),
      },
    });
  });

  return {
    credentials: {
      fullName: staff.fullName,
      email: staff.email,
      temporaryPassword,
    },
  };
}

export async function deleteStaff(formData: FormData): Promise<void> {
  const user = await requireAdmin();
  const id = cleanInput(formData.get("id"));

  const staff = await prisma.staff.findUnique({
    where: {
      id,
    },
    include: {
      user: true,
      _count: {
        select: {
          customers: true,
          salaryPayments: true,
        },
      },
    },
  });

  if (!staff) {
    redirect("/staff?error=staff-not-found");
  }

  await verifyAdminDeleteConfirmation({
    formData,
    adminUserId: user.id,
    redirectPath: "/staff",
    requiresStrongConfirmation:
      staff._count.customers > 0 || staff._count.salaryPayments > 0,
  });

  if (staff._count.customers > 0) {
    redirect("/staff?error=staff-has-history");
  }
  if (staff._count.salaryPayments > 0) {
    redirect("/staff?error=staff-has-payroll-history");
  }

  await prisma.$transaction(async (tx) => {
    await tx.auditLog.create({
      data: {
        userId: user.id,
        action: "DELETE_STAFF",
        entity: "Staff",
        entityId: staff.id,
        oldValue: JSON.stringify(staff),
      },
    });

    if (staff.user) {
      await tx.user.delete({
        where: {
          id: staff.user.id,
        },
      });
    }

    await tx.staff.delete({
      where: {
        id: staff.id,
      },
    });
  });

  revalidatePath("/staff");
  redirect("/staff?deleted=staff");
}
