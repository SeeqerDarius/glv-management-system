"use server";

import { UserPermission, UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission, isAdminRole } from "@/lib/roles";
import { verifyAdminDeleteConfirmation } from "@/lib/admin-delete";

export type CustomerFormState = {
  errors?: { fullName?: string; phone?: string; form?: string };
  duplicateWarning?: string;
};

async function requireUser() {
  const session = await auth();

  if (!session?.user?.id || !session.user.role) {
    throw new Error("Unauthorized");
  }

  return {
    id: session.user.id,
    role: session.user.role,
    permissions: session.user.permissions ?? [],
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

export async function createCustomer(
  _state: CustomerFormState,
  formData: FormData
): Promise<CustomerFormState> {
  const user = await requireUser();
  const fullName = cleanInput(formData.get("fullName"));
  const phone = cleanInput(formData.get("phone"));

  if (!fullName || !phone) {
    return {
      errors: {
        fullName: fullName ? undefined : "Customer name is required.",
        phone: phone ? undefined : "Phone number is required.",
      },
    };
  }

  const possibleDuplicate = await prisma.customer.findFirst({
    where: {
      OR: [
        { phone },
        { fullName: { equals: fullName, mode: "insensitive" } },
        { fullName: { contains: fullName, mode: "insensitive" } },
      ],
    },
    select: { fullName: true, customerId: true },
  });

  if (possibleDuplicate && formData.get("confirmDuplicate") !== "true") {
    return {
      duplicateWarning: `${possibleDuplicate.fullName} (${possibleDuplicate.customerId}) already exists. Do you still want to add this customer?`,
    };
  }

  const staffId = await resolveStaffId(formData, user.role, user.staffId);
  const customerId = await generateCustomerId(staffId);

  const customer = await prisma.customer.create({
    data: {
      customerId,
      fullName,
      phone,
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

  const existingCustomer = await prisma.customer.findUnique({
    where: {
      id,
    },
  });

  if (!existingCustomer) {
    redirect("/customers?error=customer-not-found");
  }

  const canManageAllCustomers = hasPermission(
    user.role,
    user.permissions,
    UserPermission.MANAGE_CUSTOMERS
  );

  if (
    user.role === UserRole.STAFF &&
    existingCustomer.staffId !== user.staffId &&
    !canManageAllCustomers
  ) {
    throw new Error("Unauthorized");
  }

  const staffId = isAdminRole(user.role)
    ? await resolveStaffId(formData, user.role, user.staffId)
    : existingCustomer.staffId;

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

export async function bulkReassignCustomers(formData: FormData): Promise<void> {
  const user = await requireUser();

  if (!isAdminRole(user.role)) {
    throw new Error("Unauthorized");
  }

  const customerIds = Array.from(
    new Set(formData.getAll("customerIds").map(cleanInput).filter(Boolean))
  );
  const newStaffId = cleanInput(formData.get("staffId"));
  const returnTo = cleanInput(formData.get("returnTo")) || "/customers";

  if (customerIds.length === 0) {
    redirect(`${returnTo}?error=no-selection`);
  }

  const [newStaff, customers] = await Promise.all([
    prisma.staff.findFirst({
      where: {
        id: newStaffId,
        active: true,
      },
    }),
    prisma.customer.findMany({
      where: {
        id: {
          in: customerIds,
        },
      },
      select: {
        id: true,
        customerId: true,
        fullName: true,
        staffId: true,
      },
    }),
  ]);

  if (!newStaff) {
    redirect(`${returnTo}?error=invalid-staff`);
  }

  if (customers.length === 0) {
    redirect(`${returnTo}?error=no-selection`);
  }

  await prisma.$transaction(async (tx) => {
    await tx.customer.updateMany({
      where: {
        id: {
          in: customers.map((customer) => customer.id),
        },
      },
      data: {
        staffId: newStaff.id,
      },
    });

    await tx.auditLog.create({
      data: {
        userId: user.id,
        action: "BULK_REASSIGN_CUSTOMERS",
        entity: "Customer",
        entityId: `bulk:${customers.length}`,
        oldValue: JSON.stringify(
          customers.map((customer) => ({
            customerId: customer.id,
            oldStaffId: customer.staffId,
          }))
        ),
        newValue: JSON.stringify({
          customerIds: customers.map((customer) => customer.id),
          newStaffId: newStaff.id,
          adminUserId: user.id,
        }),
      },
    });
  });

  revalidatePath("/customers");
  revalidatePath("/accounts");
  redirect(`${returnTo}?delegated=${customers.length}`);
}

export async function deleteCustomer(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = cleanInput(formData.get("id"));

  if (!isAdminRole(user.role)) {
    throw new Error("Unauthorized");
  }

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

  await verifyAdminDeleteConfirmation({
    formData,
    adminUserId: user.id,
    redirectPath: "/customers",
    requiresStrongConfirmation: customer.accounts.length > 0,
  });

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
