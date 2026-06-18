"use server";

import { UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

  revalidatePath("/customers");
  revalidatePath(`/customers/${id}`);
  redirect(`/customers/${id}`);
}
