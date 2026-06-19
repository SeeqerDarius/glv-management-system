"use server";

import { AccountStatus, UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdminRole } from "@/lib/roles";
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

async function logAccountAudit({
  userId,
  accountId,
  customerId,
  productId,
}: {
  userId: string;
  accountId: string;
  customerId: string;
  productId: string;
}) {
  await prisma.auditLog.create({
    data: {
      userId,
      action: "CREATE_ACCOUNT",
      entity: "CustomerAccount",
      entityId: accountId,
      newValue: JSON.stringify({
        accountId,
        customerId,
        productId,
      }),
    },
  });
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

  try {
    const [customer, product] = await Promise.all([
      prisma.customer.findUnique({
        where: {
          id: customerId,
        },
        select: {
          id: true,
          staffId: true,
        },
      }),
      prisma.product.findUnique({
        where: {
          id: productId,
        },
      }),
    ]);

    if (!customer) {
      return {
        errors: {
          customerId: "Selected customer could not be found.",
        },
      };
    }

    if (user.role === UserRole.STAFF && customer.staffId !== user.staffId) {
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

    if (!startDate) {
      return {
        errors: {
          startDate: "Please choose a valid start date.",
        },
      };
    }

    const targetAmount = product.layawayPrice;
    const dailyAmount = product.dailyAmount;
    const expectedEndDate = addDays(startDate, product.duration);

    const account = await prisma.customerAccount.create({
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

    await logAccountAudit({
      userId: user.id,
      accountId: account.id,
      customerId: customer.id,
      productId: product.id,
    });

    revalidatePath("/accounts");
    revalidatePath(`/customers/${customer.id}`);
    redirect(`/accounts/${account.id}`);
  } catch {
    return {
      errors: {
        form: "Unable to create account. Please check the details and try again.",
      },
    };
  }
}

export async function deleteAccount(formData: FormData): Promise<void> {
  const user = await requireAdmin();
  const id = cleanInput(formData.get("id"));

  await verifyAdminDeleteConfirmation({
    formData,
    adminUserId: user.id,
    redirectPath: `/accounts/${id}`,
  });

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
    redirect(`/accounts/${id}?error=account-delete-blocked`);
  }

  revalidatePath("/accounts");
  revalidatePath(`/customers/${account.customerId}`);
  redirect("/accounts?deleted=account");
}
