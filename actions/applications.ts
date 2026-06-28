"use server";

import { StaffApplicationStatus, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdminRole } from "@/lib/roles";
import { getSettings } from "@/lib/settings";
import { generateStaffCode } from "@/actions/staff";

export type SignupState = {
  error?: string;
  success?: string;
};

export type ApprovalState = {
  error?: string;
  credentials?: {
    fullName: string;
    email: string;
    code: string;
    temporaryPassword: string;
  };
};

function cleanInput(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

function generateTemporaryPassword(minLength = 8) {
  const password = `GLV-${randomBytes(6).toString("base64url")}9!`;
  if (password.length >= minLength) return password;

  return `${password}${randomBytes(Math.ceil((minLength - password.length) / 2)).toString("hex")}`;
}

async function requireApplicationReviewer() {
  const session = await auth();

  if (!isAdminRole(session?.user?.role) || !session?.user?.id) {
    throw new Error("Unauthorized");
  }

  return {
    id: session.user.id,
  };
}

export async function submitStaffApplication(
  _state: SignupState,
  formData: FormData
): Promise<SignupState> {
  const fullName = cleanInput(formData.get("fullName"));
  const email = cleanInput(formData.get("email")).toLowerCase();
  const phone = cleanInput(formData.get("phone"));

  if (!fullName || !email) {
    return {
      error: "Full name and email are required.",
    };
  }

  const existingApplication = await prisma.staffApplication.findUnique({
    where: {
      email,
    },
    select: {
      id: true,
    },
  });
  const existingStaff = await prisma.staff.findUnique({
    where: {
      email,
    },
    select: {
      id: true,
    },
  });
  const existingUser = await prisma.user.findUnique({
    where: {
      email,
    },
    select: {
      id: true,
    },
  });

  if (existingApplication || existingStaff || existingUser) {
    return {
      error: "An application or account already exists for this email.",
    };
  }

  await prisma.staffApplication.create({
    data: {
      fullName,
      email,
      phone: phone || null,
    },
  });

  return {
    success: "Application submitted. GLV will review it before access is granted.",
  };
}

export async function approveStaffApplication(
  _state: ApprovalState,
  formData: FormData
): Promise<ApprovalState> {
  const reviewer = await requireApplicationReviewer();
  const id = cleanInput(formData.get("id"));
  const application = await prisma.staffApplication.findUnique({
    where: {
      id,
    },
  });

  if (!application) {
    return {
      error: "Application could not be found.",
    };
  }

  if (application.status !== StaffApplicationStatus.PENDING) {
    return {
      error: "Only pending applications can be approved.",
    };
  }

  const code = await generateStaffCode(application.fullName);
  const settings = await getSettings();
  const temporaryPassword = generateTemporaryPassword(settings.passwordLength);
  const hashedPassword = await bcrypt.hash(temporaryPassword, 10);

  try {
    await prisma.$transaction(async (tx) => {
      const staff = await tx.staff.create({
        data: {
          fullName: application.fullName,
          email: application.email,
          phone: application.phone,
          code,
          monthlySalary: settings.defaultMonthlySalary,
        },
      });

      const user = await tx.user.create({
        data: {
          name: application.fullName,
          email: application.email,
          password: hashedPassword,
          role: UserRole.STAFF,
          mustChangePassword: true,
          staffId: staff.id,
        },
      });

      await tx.staffApplication.update({
        where: {
          id: application.id,
        },
        data: {
          status: StaffApplicationStatus.APPROVED,
          reviewedBy: reviewer.id,
          reviewedAt: new Date(),
        },
      });

      await tx.auditLog.create({
        data: {
          userId: reviewer.id,
          action: "APPROVE_STAFF_APPLICATION",
          entity: "StaffApplication",
          entityId: application.id,
          newValue: JSON.stringify({
            applicationId: application.id,
            staffId: staff.id,
            userId: user.id,
            email: application.email,
            code,
          }),
        },
      });
    });
  } catch {
    return {
      error: "Unable to approve application. Check for duplicate email or staff code.",
    };
  }

  revalidatePath("/staff");

  return {
    credentials: {
      fullName: application.fullName,
      email: application.email,
      code,
      temporaryPassword,
    },
  };
}

export async function rejectStaffApplication(formData: FormData): Promise<void> {
  const reviewer = await requireApplicationReviewer();
  const id = cleanInput(formData.get("id"));

  const application = await prisma.staffApplication.update({
    where: {
      id,
    },
    data: {
      status: StaffApplicationStatus.REJECTED,
      reviewedBy: reviewer.id,
      reviewedAt: new Date(),
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: reviewer.id,
      action: "REJECT_STAFF_APPLICATION",
      entity: "StaffApplication",
      entityId: application.id,
      newValue: JSON.stringify({
        applicationId: application.id,
        email: application.email,
      }),
    },
  });

  revalidatePath("/staff/applications");
}
