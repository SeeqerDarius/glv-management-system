"use server";

import {
  AccountStatus,
  CreditSource,
  CreditStatus,
  DeliveryStatus,
  UserPermission,
  UserRole,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { auth } from "@/lib/auth";
import {
  getDormantReactivationAmounts,
  isDormantReactivationEligible,
} from "@/lib/account-lifecycle";
import {
  createCustomerAccountForProduct,
  parseAccountStartDate,
} from "@/lib/customer-account-creation";
import {
  parsePaymentDate,
  recordPaymentForAccount,
} from "@/lib/payment-recording";
import { prisma } from "@/lib/prisma";
import { hasPermission, isAdminRole } from "@/lib/roles";
import { verifyAdminDeleteConfirmation } from "@/lib/admin-delete";
import { isFutureDate } from "@/lib/date-rules";
import {
  consumeStaffInventory,
  restoreStaffInventory,
} from "@/lib/staff-inventory";

export type AccountFormState = {
  errors?: {
    customerId?: string;
    productId?: string;
    startDate?: string;
    amount?: string;
    paymentDate?: string;
    method?: string;
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

export async function createAccount(
  _state: AccountFormState,
  formData: FormData
): Promise<AccountFormState> {
  const user = await requireUser();
  const customerId = cleanInput(formData.get("customerId"));
  const productId = cleanInput(formData.get("productId"));
  const startDateValue = cleanInput(formData.get("startDate"));
  const startDate = parseAccountStartDate(startDateValue);
  const firstPaymentAmountValue = cleanInput(formData.get("amount"));
  const firstPaymentAmount = Number(firstPaymentAmountValue);
  const firstPaymentDateValue = cleanInput(formData.get("paymentDate"));
  const firstPaymentDate = parsePaymentDate(firstPaymentDateValue);
  const firstPaymentMethod = cleanInput(formData.get("method"));
  const firstPaymentNotes = cleanInput(formData.get("notes"));
  const wantsFirstPayment = Boolean(
    firstPaymentAmountValue || firstPaymentDateValue
  );
  const errors: AccountFormState["errors"] = {};

  if (!customerId) errors.customerId = "Please select a customer.";
  if (!productId) errors.productId = "Please select a product.";
  if (!startDate) errors.startDate = "Please choose a valid start date.";
  if (startDate && isFutureDate(startDate)) {
    errors.startDate = "Start date cannot be in the future.";
  }
  if (wantsFirstPayment && (!Number.isFinite(firstPaymentAmount) || firstPaymentAmount <= 0)) {
    errors.amount = "Payment amount must be greater than zero.";
  }
  if (wantsFirstPayment && !firstPaymentDate) {
    errors.paymentDate = "Please choose a valid payment date.";
  }
  if (wantsFirstPayment && firstPaymentDate && isFutureDate(firstPaymentDate)) {
    errors.paymentDate = "Payment date cannot be in the future.";
  }
  if (wantsFirstPayment && !firstPaymentMethod) {
    errors.method = "Please select a payment method.";
  }

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

  let accountId: string;

  try {
    accountId = await prisma.$transaction(async (tx) => {
      const account = await createCustomerAccountForProduct({
        tx,
        userId: user.id,
        customerId: customer.id,
        product,
        startDate,
        inventoryStaffId: customer.staffId,
      });

      if (wantsFirstPayment && firstPaymentDate) {
        await recordPaymentForAccount({
          tx,
          userId: user.id,
          account: {
            ...account,
            customer: {
              id: customer.id,
            },
            product: {
              id: product.id,
            },
          },
          amount: firstPaymentAmount,
          paymentDate: firstPaymentDate,
          method: firstPaymentMethod,
          notes: firstPaymentNotes,
        });
      }

      return account.id;
    });
  } catch (error) {
    console.error("CREATE_ACCOUNT_ERROR", error);
    if (error instanceof Error && error.name === "StaffInventoryError") {
      return {
        errors: {
          productId: error.message,
        },
      };
    }

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

      if (account.inventoryStaffId) {
        await restoreStaffInventory({
          tx,
          userId: user.id,
          staffId: account.inventoryStaffId,
          productId: account.productId,
          accountId: account.id,
        });
      }

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

export async function updateAccountProduct(formData: FormData): Promise<void> {
  const user = await requireAdmin();
  const id = cleanInput(formData.get("id"));
  const productId = cleanInput(formData.get("productId"));
  const returnTo = safeReturnTo(cleanInput(formData.get("returnTo")), `/accounts/${id}`);
  const adminPassword = cleanInput(formData.get("adminPassword"));

  if (!productId) {
    redirect(`${returnTo}?error=invalid-account-product`);
  }

  if (!adminPassword) {
    redirect(`${returnTo}?error=admin-password-required`);
  }

  const passwordValid = await verifyAdminPassword(user.id, adminPassword);

  if (!passwordValid) {
    redirect(`${returnTo}?error=invalid-admin-password`);
  }

  const [account, product] = await Promise.all([
    prisma.customerAccount.findUnique({
      where: {
        id,
      },
      include: {
        product: true,
        customer: {
          select: {
            staffId: true,
          },
        },
      },
    }),
    prisma.product.findUnique({
      where: {
        id: productId,
      },
    }),
  ]);

  if (!account) {
    redirect("/accounts?error=account-not-found");
  }

  if (!product || !product.active) {
    redirect(`${returnTo}?error=invalid-account-product`);
  }

  if (product.id === account.productId) {
    redirect(`${returnTo}?updated=account-product`);
  }

  const expectedEndDate = new Date(account.startDate);
  expectedEndDate.setDate(expectedEndDate.getDate() + product.duration);

  const nextTargetAmount = product.layawayPrice;
  const nextDailyAmount = product.dailyAmount;
  const nextBalance = Math.max(nextTargetAmount - account.totalPaid, 0);
  const creditAmount = Math.max(account.totalPaid - nextTargetAmount, 0);
  const nextStatus =
    nextBalance <= 0
      ? AccountStatus.COMPLETED
      : account.status === AccountStatus.COMPLETED
        ? AccountStatus.ACTIVE
        : account.status;

  try {
    await prisma.$transaction(async (tx) => {
      const inventoryStaffId = account.inventoryStaffId ?? account.customer.staffId;
      if (account.inventoryStaffId) {
        await restoreStaffInventory({
          tx,
          userId: user.id,
          staffId: account.inventoryStaffId,
          productId: account.productId,
          accountId: account.id,
        });
      }

      await tx.customerAccount.update({
        where: {
          id: account.id,
        },
        data: {
          productId: product.id,
          inventoryStaffId,
          targetAmount: nextTargetAmount,
          dailyAmount: nextDailyAmount,
          expectedEndDate,
          balance: nextBalance,
          status: nextStatus,
          deliveryStatus: DeliveryStatus.PENDING,
          deliveredAt: null,
          deliveredBy: null,
        },
      });

      await consumeStaffInventory({
        tx,
        userId: user.id,
        staffId: inventoryStaffId,
        productId: product.id,
        accountId: account.id,
      });

      const existingCredits = await tx.customerCredit.aggregate({
        where: {
          accountId: account.id,
          status: {
            not: CreditStatus.VOID,
          },
        },
        _sum: {
          amount: true,
        },
      });
      const existingCreditAmount = existingCredits._sum.amount ?? 0;
      const additionalCreditAmount = Math.max(
        creditAmount - existingCreditAmount,
        0
      );

      const createdCredit =
        additionalCreditAmount > 0
          ? await tx.customerCredit.create({
              data: {
                customerId: account.customerId,
                accountId: account.id,
                amount: additionalCreditAmount,
                remainingAmount: additionalCreditAmount,
                status: CreditStatus.OPEN,
                source: CreditSource.MANUAL_ADJUSTMENT,
                notes: `Credit from product correction: ${account.product.name} to ${product.name}`,
                createdBy: user.id,
              },
            })
          : null;

      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: "UPDATE_ACCOUNT_PRODUCT",
          entity: "CustomerAccount",
          entityId: account.id,
          oldValue: JSON.stringify({
            productId: account.productId,
            productName: account.product.name,
            inventoryStaffId: account.inventoryStaffId,
            targetAmount: account.targetAmount,
            dailyAmount: account.dailyAmount,
            expectedEndDate: account.expectedEndDate,
            balance: account.balance,
            status: account.status,
            deliveryStatus: account.deliveryStatus,
            deliveredAt: account.deliveredAt,
            deliveredBy: account.deliveredBy,
          }),
          newValue: JSON.stringify({
            productId: product.id,
            productName: product.name,
            inventoryStaffId,
            targetAmount: nextTargetAmount,
            dailyAmount: nextDailyAmount,
            expectedEndDate,
            balance: nextBalance,
            status: nextStatus,
            deliveryStatus: DeliveryStatus.PENDING,
            deliveredAt: null,
            deliveredBy: null,
            retainedTotalPaid: account.totalPaid,
            creditAmount,
            additionalCreditId: createdCredit?.id ?? null,
            additionalCreditAmount,
          }),
        },
      });
    });
  } catch (error) {
    console.error("UPDATE_ACCOUNT_PRODUCT_ERROR", error);
    if (error instanceof Error && error.name === "StaffInventoryError") {
      redirect(`${returnTo}?error=staff-inventory-empty`);
    }

    redirect(`${returnTo}?error=invalid-account-product`);
  }

  revalidatePath("/accounts");
  revalidatePath(`/accounts/${account.id}`);
  revalidatePath(`/customers/${account.customerId}`);
  revalidatePath(`/products/${account.productId}`);
  revalidatePath(`/products/${product.id}`);
  redirect(`${returnTo}?updated=account-product`);
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
      productId: true,
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
  revalidatePath("/products");
  revalidatePath(`/products/${account.productId}`);
}

export async function reactivateDormantAccount(formData: FormData): Promise<void> {
  const user = await requireAdmin();
  const id = cleanInput(formData.get("id"));
  const returnTo = safeReturnTo(cleanInput(formData.get("returnTo")), `/accounts/${id}`);
  const adminPassword = cleanInput(formData.get("adminPassword"));

  if (!adminPassword) {
    redirect(`${returnTo}?error=admin-password-required`);
  }

  const passwordValid = await verifyAdminPassword(user.id, adminPassword);

  if (!passwordValid) {
    redirect(`${returnTo}?error=invalid-admin-password`);
  }

  const account = await prisma.customerAccount.findUnique({
    where: {
      id,
    },
    include: {
      payments: {
        orderBy: {
          paymentDate: "desc",
        },
        take: 1,
        select: {
          paymentDate: true,
        },
      },
      credits: {
        where: {
          source: CreditSource.ACCOUNT_CLOSURE_REFUND,
          status: CreditStatus.OPEN,
        },
        select: {
          id: true,
          amount: true,
          remainingAmount: true,
        },
      },
    },
  });

  if (!account) {
    redirect("/accounts?error=account-not-found");
  }

  if (!isDormantReactivationEligible(account)) {
    redirect(`${returnTo}?error=reactivation-not-eligible`);
  }

  const { serviceFee, nextTotalPaid, serviceFeeRate } =
    getDormantReactivationAmounts(account.totalPaid);
  const nextBalance = Math.max(account.targetAmount - nextTotalPaid, 0);
  const nextStatus =
    nextBalance <= 0 ? AccountStatus.COMPLETED : AccountStatus.ACTIVE;

  await prisma.$transaction(async (tx) => {
    await tx.customerAccount.update({
      where: {
        id: account.id,
      },
      data: {
        totalPaid: nextTotalPaid,
        balance: nextBalance,
        status: nextStatus,
        deliveryStatus:
          nextStatus === AccountStatus.COMPLETED
            ? account.deliveryStatus
            : DeliveryStatus.PENDING,
        deliveredAt:
          nextStatus === AccountStatus.COMPLETED ? account.deliveredAt : null,
        deliveredBy:
          nextStatus === AccountStatus.COMPLETED ? account.deliveredBy : null,
      },
    });

    if (account.credits.length > 0) {
      await tx.customerCredit.updateMany({
        where: {
          id: {
            in: account.credits.map((credit) => credit.id),
          },
        },
        data: {
          status: CreditStatus.VOID,
          remainingAmount: 0,
          resolvedBy: user.id,
          resolvedAt: new Date(),
        },
      });
    }

    await tx.auditLog.create({
      data: {
        userId: user.id,
        action: "REACTIVATE_DORMANT_ACCOUNT",
        entity: "CustomerAccount",
        entityId: account.id,
        oldValue: JSON.stringify({
          status: account.status,
          totalPaid: account.totalPaid,
          balance: account.balance,
          deliveryStatus: account.deliveryStatus,
          deliveredAt: account.deliveredAt,
          closureCreditIds: account.credits.map((credit) => credit.id),
        }),
        newValue: JSON.stringify({
          status: nextStatus,
          totalPaid: nextTotalPaid,
          balance: nextBalance,
          serviceFee,
          serviceFeeRate,
          voidedClosureCreditIds: account.credits.map((credit) => credit.id),
        }),
      },
    });
  });

  revalidatePath("/accounts");
  revalidatePath(`/accounts/${account.id}`);
  revalidatePath(`/customers/${account.customerId}`);
  revalidatePath("/dashboard");
  revalidatePath("/reports");
  revalidatePath("/activity");
  redirect(`${returnTo}?updated=account-reactivated`);
}
