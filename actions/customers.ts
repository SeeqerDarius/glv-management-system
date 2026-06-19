"use server";

import { UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdminRole } from "@/lib/roles";
import { verifyAdminDeleteConfirmation } from "@/lib/admin-delete";

async function requireUser() {
  const session = await auth();

  if (!session?.user?.id || !session.user.role) {
    throw new Error("Unauthorized");
  }

  return {
    id: session.user.id,
    role: session.user.role,
    staffId: session.user.staffId,
  };
}

async function logCustomerAudit({
  userId,
  action,
  customerId,
  oldValue,
  newValue,
}: {
  userId: string;
  action: string;
  customerId: string;
  oldValue?: unknown;
  newValue?: unknown;
}) {
  await prisma.auditLog.create({
    data: {
      userId,
      action,
      entity: "Customer",
      entityId: customerId,
      oldValue: oldValue ? JSON.stringify(oldValue) : null,
      newValue: newValue ? JSON.stringify(newValue) : null,
    },
  });
}

function cleanInput(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

async function resolveStaffId(formData: FormData, role: UserRole, staffId?: string | null) {
  if (role === UserRole.STAFF) {
    if (!staffId) {
      throw new Error("Staff user is not linked to a staff profile.");
    }

    return staffId;
  }

  const selectedStaffId = cleanInput(formData.get("staffId"));

  if (!selectedStaffId) {
    throw new Error("Please assign a staff member.");
  }

  return selectedStaffId;
}

export async function generateCustomerId(staffId: string) {
  const staff = await prisma.staff.findUnique({
    where: {
      id: staffId,
    },
    select: {
      code: true,
    },
  });

  if (!staff) {
    throw new Error("Staff member not found.");
  }

  const year = new Date().getFullYear().toString().slice(-2);
  const prefix = `GLV/${staff.code}/${year}/`;

  const existingCustomers = await prisma.customer.findMany({
    where: {
      staffId,
      customerId: {
        startsWith: prefix,
      },
    },
    select: {
      customerId: true,
    },
  });

  const maxNumber = existingCustomers.reduce((max, customer) => {
    const value = Number(customer.customerId.replace(prefix, ""));
    return Number.isFinite(value) && value > max ? value : max;
  }, 0);

  return `${prefix}${String(maxNumber + 1).padStart(3, "0")}`;
}

export async function createCustomer(formData: FormData): Promise<void> {
  const user = await requireUser();
  const staffId = await resolveStaffId(formData, user.role, user.staffId);
  const customerId = await generateCustomerId(staffId);

  const customer = await prisma.customer.create({
    data: {
      customerId,
      fullName: cleanInput(formData.get("fullName")),
      phone: cleanInput(formData.get("phone")),
      address: cleanInput(formData.get("address")) || null,
      nationalId: cleanInput(formData.get("nationalId")) || null,
      staffId,
    },
  });

  await logCustomerAudit({
    userId: user.id,
    action: "CREATE_CUSTOMER",
    customerId: customer.id,
    newValue: customer,
  });

  revalidatePath("/customers");
  redirect(`/customers/${customer.id}`);
}

export async function updateCustomer(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = cleanInput(formData.get("id"));
  const staffId = await resolveStaffId(formData, user.role, user.staffId);

  if (user.role === UserRole.STAFF) {
    const customer = await prisma.customer.findFirst({
      where: {
        id,
        staffId,
      },
      select: {
        id: true,
      },
    });

    if (!customer) {
      throw new Error("Unauthorized");
    }
  }

  const existingCustomer = await prisma.customer.findUnique({
    where: {
      id,
    },
  });

  if (!existingCustomer) {
    redirect("/customers?error=customer-not-found");
  }

  if (existingCustomer.staffId !== staffId) {
    if (!isAdminRole(user.role)) {
      throw new Error("Unauthorized");
    }

    const adminPassword = cleanInput(formData.get("adminPassword"));

    if (!adminPassword) {
      redirect(`/customers/${id}/edit?error=admin-password-required`);
    }

    const adminUser = await prisma.user.findUnique({
      where: {
        id: user.id,
      },
      select: {
        password: true,
      },
    });

    const passwordValid = adminUser
      ? await bcrypt.compare(adminPassword, adminUser.password)
      : false;

    if (!passwordValid) {
      redirect(`/customers/${id}/edit?error=invalid-admin-password`);
    }
  }

  const customer = await prisma.customer.update({
    where: {
      id,
    },
    data: {
      fullName: cleanInput(formData.get("fullName")),
      phone: cleanInput(formData.get("phone")),
      address: cleanInput(formData.get("address")) || null,
      nationalId: cleanInput(formData.get("nationalId")) || null,
      staffId,
    },
  });

  await logCustomerAudit({
    userId: user.id,
    action: "UPDATE_CUSTOMER",
    customerId: customer.id,
    oldValue: existingCustomer,
    newValue: customer,
  });

  if (existingCustomer.staffId !== staffId) {
    await logCustomerAudit({
      userId: user.id,
      action: "REASSIGN_CUSTOMER_STAFF",
      customerId: customer.id,
      oldValue: {
        oldStaffId: existingCustomer.staffId,
        customerId: customer.id,
        adminUserId: user.id,
      },
      newValue: {
        oldStaffId: existingCustomer.staffId,
        newStaffId: staffId,
        customerId: customer.id,
        adminUserId: user.id,
      },
    });
  }

  revalidatePath("/customers");
  revalidatePath(`/customers/${id}`);
  redirect(`/customers/${id}`);
}

export async function deleteCustomer(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = cleanInput(formData.get("id"));

  if (!isAdminRole(user.role)) {
    throw new Error("Unauthorized");
  }

  await verifyAdminDeleteConfirmation({
    formData,
    adminUserId: user.id,
    redirectPath: "/customers",
  });

  const customer = await prisma.customer.findUnique({
    where: {
      id,
    },
    include: {
      accounts: {
        include: {
          payments: true,
        },
      },
    },
  });

  if (!customer) {
    redirect("/customers?error=customer-not-found");
  }

  try {
    await prisma.$transaction(async (tx) => {
      const accountIds = customer.accounts.map((account) => account.id);

      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: "DELETE_CUSTOMER",
          entity: "Customer",
          entityId: customer.id,
          oldValue: JSON.stringify(customer),
        },
      });

      if (accountIds.length > 0) {
        await tx.payment.deleteMany({
          where: {
            accountId: {
              in: accountIds,
            },
          },
        });

        await tx.customerAccount.deleteMany({
          where: {
            id: {
              in: accountIds,
            },
          },
        });
      }

      await tx.customer.delete({
        where: {
          id: customer.id,
        },
      });
    });
  } catch {
    redirect("/customers?error=customer-delete-blocked");
  }

  revalidatePath("/customers");
  redirect("/customers?deleted=customer");
}
