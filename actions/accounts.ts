"use server";

import {
  AccountStatus,
  DeliveryStatus,
  UserPermission,
  UserRole,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission, isAdminRole } from "@/lib/roles";
import { verifyAdminDeleteConfirmation } from "@/lib/admin-delete";

export type AccountFormState = {
  errors?: {
    customerId?: string;
    productId?: string;
    startDate?: string;
    form?: string;
  };
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

async function requireAdmin() {
  const user = await requireUser();

  if (!isAdminRole(user.role)) {
    throw new Error("Unauthorized");
  }

  return user;
}

function cleanInput(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

function safeReturnTo(value: string, fallback: string) {
  return value.startsWith("/") && !value.startsWith("//") ? value : fallback;
}

function parseMoney(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

async function verifyAdminPassword(adminUserId: string, password: string) {
  if (!password) {
    return false;
  }

  const adminUser = await prisma.user.findUnique({
    where: {
      id: adminUserId,
    },
    select: {
      password: true,
    },
  });

  return adminUser
    ? bcrypt.compare(password, adminUser.password)
    : Promise.resolve(false);
}

function parseStartDate(value: string) {
  if (!value) return null;

  const parsedDate = new Date(`${value}T00:00:00`);

  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return parsedDate;
}

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export async function createAccount(
  _state: AccountFormState,
  formData: FormData
): Promise<AccountFormState> {
  const user = await requireUser();
  const customerId = cleanInput(formData.get("customerId"));
  const productId = cleanInput(formData.get("productId"));
  const startDateValue = cleanInput(formData.get("startDate"));
  const startDate = parseStartDate(startDateValue);
  const errors: AccountFormState["errors"] = {};

  if (!customerId) errors.customerId = "Please select a customer.";
  if (!productId) errors.productId = "Please select a product.";
  if (!startDate) errors.startDate = "Please choose a valid start date.";

  if (Object.keys(errors).length > 0) {
    return {
      errors,
    };
  }

  if (!startDate) {
    return {
      errors: {
        startDate: "Please choose a valid start date.",
      },
    };
  }

  const customer = await prisma.customer.findUnique({
    where: {
      id: customerId,
    },
    select: {
      id: true,
      staffId: true,
    },
  });
  const product = await prisma.product.findUnique({
    where: {
      id: productId,
    },
  });

  if (!customer) {
    return {
      errors: {
        customerId: "Selected customer could not be found.",
      },
    };
  }

  if (
    user.role === UserRole.STAFF &&
    customer.staffId !== user.staffId &&
    !hasPermission(
      user.role,
      user.permissions,
      UserPermission.MANAGE_ACCOUNTS
    )
  ) {
    return {
      errors: {
        customerId: "This customer is not assigned to your staff profile.",
      },
    };
  }

  if (!product) {
    return {
      errors: {
        productId: "Selected product could not be found.",
      },
    };
  }

  if (!product.active) {
    return {
      errors: {
        productId: "Inactive products cannot be used for new accounts.",
      },
    };
  }

  const targetAmount = product.layawayPrice;
  const dailyAmount = product.dailyAmount;
  const expectedEndDate = addDays(startDate, product.duration);
  let accountId: string;

  try {
    accountId = await prisma.$transaction(async (tx) => {
      const account = await tx.customerAccount.create({
        data: {
          customerId: customer.id,
          productId: product.id,
          targetAmount,
          dailyAmount,
          startDate,
          expectedEndDate,
          totalPaid: 0,
          balance: targetAmount,
          status: AccountStatus.ACTIVE,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: "CREATE_ACCOUNT",
          entity: "CustomerAccount",
          entityId: account.id,
          newValue: JSON.stringify({
            accountId: account.id,
            customerId: customer.id,
            productId: product.id,
          }),
        },
      });

      return account.id;
    });
  } catch (error) {
    console.error("CREATE_ACCOUNT_ERROR", error);
    return {
      errors: {
        form: "Unable to create account. Please check the details and try again.",
      },
    };
  }

  revalidatePath("/accounts");
  revalidatePath("/customers");
  revalidatePath(`/customers/${customer.id}`);
  revalidatePath("/products");
  revalidatePath(`/products/${productId}`);
  redirect(`/accounts/${accountId}`);
}

export async function deleteAccount(formData: FormData): Promise<void> {
  const user = await requireAdmin();
  const id = cleanInput(formData.get("id"));
  const requestedReturnTo = cleanInput(formData.get("returnTo"));
  const returnTo = safeReturnTo(requestedReturnTo, `/accounts/${id}`);
  const successRedirect = requestedReturnTo ? returnTo : "/accounts";

  const account = await prisma.customerAccount.findUnique({
    where: {
      id,
    },
    include: {
      customer: true,
      product: true,
      payments: {
        orderBy: {
          paymentDate: "desc",
        },
      },
    },
  });

  if (!account) {
    redirect("/accounts?error=account-not-found");
  }

  await verifyAdminDeleteConfirmation({
    formData,
    adminUserId: user.id,
    redirectPath: returnTo,
    requiresStrongConfirmation: account.payments.length > 0,
  });

  try {
    await prisma.$transaction(async (tx) => {
      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: "DELETE_ACCOUNT",
          entity: "CustomerAccount",
          entityId: account.id,
          oldValue: JSON.stringify(account),
        },
      });

      await tx.payment.deleteMany({
        where: {
          accountId: account.id,
        },
      });

      await tx.customerAccount.delete({
        where: {
          id: account.id,
        },
      });
    });
  } catch {
    redirect(`${returnTo}?error=account-delete-blocked`);
  }

  revalidatePath("/accounts");
  revalidatePath(`/customers/${account.customerId}`);
  redirect(`${successRedirect}?deleted=account`);
}

export async function updateAccountPrice(formData: FormData): Promise<void> {
  const user = await requireAdmin();
  const id = cleanInput(formData.get("id"));
  const returnTo = safeReturnTo(cleanInput(formData.get("returnTo")), `/accounts/${id}`);
  const nextTargetAmount = parseMoney(cleanInput(formData.get("targetAmount")));
  const adminPassword = cleanInput(formData.get("adminPassword"));

  if (!nextTargetAmount || nextTargetAmount <= 0) {
    redirect(`${returnTo}?error=invalid-account-price`);
  }

  const passwordValid = await verifyAdminPassword(user.id, adminPassword);

  if (!adminPassword) {
    redirect(`${returnTo}?error=admin-password-required`);
  }

  if (!passwordValid) {
    redirect(`${returnTo}?error=invalid-admin-password`);
  }

  const account = await prisma.customerAccount.findUnique({
    where: {
      id,
    },
    select: {
      id: true,
      customerId: true,
      targetAmount: true,
      totalPaid: true,
      balance: true,
      status: true,
      product: {
        select: {
          id: true,
          layawayPrice: true,
        },
      },
    },
  });

  if (!account) {
    redirect("/accounts?error=account-not-found");
  }

  const nextBalance = Math.max(nextTargetAmount - account.totalPaid, 0);
  const nextStatus =
    nextBalance <= 0
      ? AccountStatus.COMPLETED
      : account.status === AccountStatus.COMPLETED
        ? AccountStatus.ACTIVE
        : account.status;

  await prisma.$transaction(async (tx) => {
    await tx.customerAccount.update({
      where: {
        id: account.id,
      },
      data: {
        targetAmount: nextTargetAmount,
        balance: nextBalance,
        status: nextStatus,
      },
    });

    await tx.auditLog.create({
      data: {
        userId: user.id,
        action: "UPDATE_ACCOUNT_PRICE",
        entity: "CustomerAccount",
        entityId: account.id,
        oldValue: JSON.stringify({
          targetAmount: account.targetAmount,
          balance: account.balance,
          status: account.status,
          productId: account.product.id,
          productLayawayPrice: account.product.layawayPrice,
        }),
        newValue: JSON.stringify({
          targetAmount: nextTargetAmount,
          balance: nextBalance,
          status: nextStatus,
          productId: account.product.id,
          productLayawayPrice: account.product.layawayPrice,
        }),
      },
    });
  });

  revalidatePath("/accounts");
  revalidatePath(`/accounts/${account.id}`);
  revalidatePath(`/customers/${account.customerId}`);
  redirect(`${returnTo}?updated=account-price`);
}

export async function updateAccountDeliveryStatus(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = cleanInput(formData.get("id"));
  const nextStatusValue = cleanInput(formData.get("deliveryStatus"));
  const nextStatus =
    nextStatusValue === DeliveryStatus.DELIVERED
      ? DeliveryStatus.DELIVERED
      : DeliveryStatus.PENDING;

  const account = await prisma.customerAccount.findUnique({
    where: {
      id,
    },
    select: {
      id: true,
      customerId: true,
      status: true,
      balance: true,
      deliveryStatus: true,
      deliveredAt: true,
      deliveredBy: true,
      customer: {
        select: {
          staffId: true,
        },
      },
    },
  });

  if (!account) {
    redirect("/accounts?error=account-not-found");
  }

  const canManageAccount =
    isAdminRole(user.role) ||
    hasPermission(user.role, user.permissions, UserPermission.MANAGE_ACCOUNTS) ||
    (user.role === UserRole.STAFF && account.customer.staffId === user.staffId);

  if (!canManageAccount) {
    throw new Error("Unauthorized");
  }

  if (account.status !== AccountStatus.COMPLETED || account.balance > 0) {
    redirect(`/accounts/${account.id}?error=delivery-not-completed`);
  }

  const deliveredAt =
    nextStatus === DeliveryStatus.DELIVERED ? new Date() : null;

  await prisma.$transaction(async (tx) => {
    await tx.customerAccount.update({
      where: {
        id: account.id,
      },
      data:
        nextStatus === DeliveryStatus.DELIVERED
          ? {
              deliveryStatus: DeliveryStatus.DELIVERED,
              deliveredAt,
              deliveredBy: user.id,
            }
          : {
              deliveryStatus: DeliveryStatus.PENDING,
              deliveredAt: null,
              deliveredBy: null,
            },
    });

    await tx.auditLog.create({
      data: {
        userId: user.id,
        action: "UPDATE_ACCOUNT_DELIVERY_STATUS",
        entity: "CustomerAccount",
        entityId: account.id,
        oldValue: JSON.stringify({
          deliveryStatus: account.deliveryStatus,
          deliveredAt: account.deliveredAt,
          deliveredBy: account.deliveredBy,
        }),
        newValue: JSON.stringify({
          deliveryStatus: nextStatus,
          deliveredAt: deliveredAt?.toISOString() ?? null,
          deliveredBy: nextStatus === DeliveryStatus.DELIVERED ? user.id : null,
        }),
      },
    });
  });

  revalidatePath("/accounts");
  revalidatePath(`/accounts/${account.id}`);
  revalidatePath(`/customers/${account.customerId}`);
}
