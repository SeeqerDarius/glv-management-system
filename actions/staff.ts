"use server";

import { UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { isAdminRole } from "@/lib/roles";
import { verifyAdminDeleteConfirmation } from "@/lib/admin-delete";

export type StaffFormState = {
  errors?: {
    fullName?: string;
    email?: string;
    code?: string;
    form?: string;
  };
  credentials?: {
    fullName: string;
    email: string;
    code: string;
    temporaryPassword: string;
  };
};

const codeOverrides: Record<string, string> = {
  perpetual: "PEP",
  rebecca: "BEX",
  philomena: "PHIL",
  victoria: "VIC",
};

async function requireAdmin() {
  const session = await auth();

  if (!isAdminRole(session?.user?.role) || !session?.user?.id) {
    throw new Error("Unauthorized");
  }

  return {
    id: session.user.id,
  };
}

function cleanInput(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

function baseStaffCode(fullName: string) {
  const firstName = fullName.trim().split(/\s+/)[0]?.toLowerCase() ?? "";
  const override = codeOverrides[firstName];

  if (override) return override;

  return firstName.replace(/[^a-z]/g, "").slice(0, 3).toUpperCase();
}

function generateTemporaryPassword() {
  return `GLV-${randomBytes(6).toString("base64url")}9!`;
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
  const baseCode = baseStaffCode(fullName);

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
  const user = await requireAdmin();

  const fullName = cleanInput(formData.get("fullName"));
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

  const [staffWithEmail, userWithEmail, staffWithCode] = await Promise.all([
    prisma.staff.findUnique({
      where: {
        email,
      },
      select: {
        id: true,
      },
    }),
    prisma.user.findUnique({
      where: {
        email,
      },
      select: {
        id: true,
      },
    }),
    prisma.staff.findUnique({
      where: {
        code,
      },
      select: {
        id: true,
      },
    }),
  ]);

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

  const temporaryPassword = generateTemporaryPassword();
  const hashedPassword = await bcrypt.hash(temporaryPassword, 10);

  try {
    await prisma.$transaction(async (tx) => {
      const createdStaff = await tx.staff.create({
        data: {
          fullName,
          email,
          code,
          phone: phone || null,
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
  const user = await requireAdmin();

  const id = cleanInput(formData.get("id"));
  const fullName = cleanInput(formData.get("fullName"));
  const email = cleanInput(formData.get("email")).toLowerCase();
  const phone = cleanInput(formData.get("phone"));
  const submittedCode = cleanInput(formData.get("code")).toUpperCase();
  const code = submittedCode || (await generateStaffCode(fullName, id));
  const active = formData.get("active") === "on";

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
      fullName,
      email,
      code,
      phone: phone || null,
      active,
    },
  });

  await prisma.user.updateMany({
    where: {
      staffId: staff.id,
    },
    data: {
      name: staff.fullName,
      email: staff.email,
    },
  });

  await logStaffAudit({
    userId: user.id,
    action: "UPDATE_STAFF",
    staffId: staff.id,
    oldValue: existingStaff,
    newValue: staff,
  });

  revalidatePath("/staff");
  redirect("/staff");
}

export async function deactivateStaff(formData: FormData): Promise<void> {
  const user = await requireAdmin();

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

export async function deleteStaff(formData: FormData): Promise<void> {
  const user = await requireAdmin();
  const id = cleanInput(formData.get("id"));

  await verifyAdminDeleteConfirmation({
    formData,
    adminUserId: user.id,
    redirectPath: "/staff",
  });

  const staff = await prisma.staff.findUnique({
    where: {
      id,
    },
    include: {
      user: true,
      _count: {
        select: {
          customers: true,
        },
      },
    },
  });

  if (!staff) {
    redirect("/staff?error=staff-not-found");
  }

  if (staff._count.customers > 0) {
    redirect("/staff?error=staff-has-history");
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
