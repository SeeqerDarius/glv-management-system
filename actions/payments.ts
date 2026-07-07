"use server";

import {
  AccountStatus,
  CreditStatus,
  UserPermission,
  UserRole,
  type Prisma,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { auth } from "@/lib/auth";
import {
  parsePaymentDate,
  recordPaymentForAccount,
} from "@/lib/payment-recording";
import { prisma } from "@/lib/prisma";
import { verifyAdminDeleteConfirmation } from "@/lib/admin-delete";
import { hasPermission, isAdminRole } from "@/lib/roles";
import { getSettings } from "@/lib/settings";
import { isFutureDate } from "@/lib/date-rules";

export type PaymentFormState = {
  errors?: {
    accountId?: string;
    amount?: string;
    paymentDate?: string;
    method?: string;
    form?: string;
  };
};

export type PaymentEditFormState = PaymentFormState;

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

function canEditPaymentCreatedAt(createdAt: Date, windowHours: number, now = new Date()) {
  const elapsedMs = now.getTime() - createdAt.getTime();
  return elapsedMs >= 0 && elapsedMs <= windowHours * 60 * 60 * 1000;
}

async function recalculateAccountAfterPaymentChange(
  tx: Prisma.TransactionClient,
  account: {
    id: string;
    targetAmount: number;
    status: AccountStatus;
  }
) {
  const paymentTotals = await tx.payment.aggregate({
    where: {
      accountId: account.id,
    },
    _sum: {
      amount: true,
    },
  });
  const nextTotalPaid = paymentTotals._sum.amount ?? 0;
  const nextBalance = Math.max(account.targetAmount - nextTotalPaid, 0);
  const nextStatus =
    nextBalance <= 0
      ? AccountStatus.COMPLETED
      : account.status === AccountStatus.COMPLETED
        ? AccountStatus.ACTIVE
        : account.status;

  await tx.customerAccount.update({
    where: {
      id: account.id,
    },
    data: {
      totalPaid: nextTotalPaid,
      balance: nextBalance,
      status: nextStatus,
    },
  });

  return {
    nextTotalPaid,
    nextBalance,
    nextStatus,
  };
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

  return adminUser ? bcrypt.compare(password, adminUser.password) : false;
}

export async function recordPayment(
  _state: PaymentFormState,
  formData: FormData
): Promise<PaymentFormState> {
  const user = await requireUser();
  const accountId = cleanInput(formData.get("accountId"));
  const amount = Number(cleanInput(formData.get("amount")));
  const paymentDateValue = cleanInput(formData.get("paymentDate"));
  const paymentDate = parsePaymentDate(paymentDateValue);
  const method = cleanInput(formData.get("method"));
  const notes = cleanInput(formData.get("notes"));
  const errors: PaymentFormState["errors"] = {};

  if (!accountId) errors.accountId = "Please select an account.";
  if (!Number.isFinite(amount) || amount <= 0) {
    errors.amount = "Payment amount must be greater than zero.";
  }
  if (!paymentDate) errors.paymentDate = "Please choose a valid payment date.";
  if (paymentDate && isFutureDate(paymentDate)) {
    errors.paymentDate = "Payment date cannot be in the future.";
  }
  if (!method) errors.method = "Please select a payment method.";

  if (Object.keys(errors).length > 0) {
    return {
      errors,
    };
  }

  const account = await prisma.customerAccount.findUnique({
    where: {
      id: accountId,
    },
    include: {
      customer: {
        select: {
          id: true,
          staffId: true,
        },
      },
      product: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (!account) {
    return {
      errors: {
        accountId: "Selected account could not be found.",
      },
    };
  }

  if (user.role === UserRole.STAFF && account.customer.staffId !== user.staffId && !hasPermission(user.role, user.permissions, UserPermission.MANAGE_PAYMENTS)) {
    return {
      errors: {
        accountId: "This account does not belong to one of your customers.",
      },
    };
  }

  if (
    account.status === AccountStatus.CANCELLED ||
    account.status === AccountStatus.SUSPENDED ||
    account.status === AccountStatus.CLOSED ||
    account.status === AccountStatus.ARCHIVED
  ) {
    return {
      errors: {
        accountId:
          "Payments cannot be recorded for a cancelled, suspended, closed, or archived account.",
      },
    };
  }

  if (account.balance <= 0 || account.status === AccountStatus.COMPLETED) {
    return {
      errors: {
        accountId: "This account has already been completed.",
      },
    };
  }

  if (!paymentDate) {
    return {
      errors: {
        paymentDate: "Please choose a valid payment date.",
      },
    };
  }

  let createdPayment: {
    receiptNo: string;
  };

  try {
    createdPayment = await prisma.$transaction(async (tx) => {
      const createdPayment = await recordPaymentForAccount({
        tx,
        userId: user.id,
        account,
        amount,
        paymentDate,
        method,
        notes,
      });

      return createdPayment;
    });

  } catch {
    return {
      errors: {
        form: "Unable to record payment. Please check the details and try again.",
      },
    };
  }

  revalidatePath("/payments");
  revalidatePath("/accounts");
  revalidatePath(`/accounts/${account.id}`);
  revalidatePath(`/customers/${account.customer.id}`);
  redirect(`/accounts/${account.id}?payment=${createdPayment.receiptNo}`);
}

export async function updatePayment(
  _state: PaymentEditFormState,
  formData: FormData
): Promise<PaymentEditFormState> {
  const user = await requireUser();
  const id = cleanInput(formData.get("id"));
  const amount = Number(cleanInput(formData.get("amount")));
  const paymentDateValue = cleanInput(formData.get("paymentDate"));
  const paymentDate = parsePaymentDate(paymentDateValue);
  const method = cleanInput(formData.get("method"));
  const notes = cleanInput(formData.get("notes"));
  const errors: PaymentEditFormState["errors"] = {};

  if (!id) errors.form = "Payment record could not be found.";
  if (!Number.isFinite(amount) || amount <= 0) {
    errors.amount = "Payment amount must be greater than zero.";
  }
  if (!paymentDate) errors.paymentDate = "Please choose a valid payment date.";
  if (paymentDate && isFutureDate(paymentDate)) {
    errors.paymentDate = "Payment date cannot be in the future.";
  }
  if (!method) errors.method = "Please select a payment method.";

  if (Object.keys(errors).length > 0) {
    return {
      errors,
    };
  }
  if (!paymentDate) {
    return {
      errors: {
        paymentDate: "Please choose a valid payment date.",
      },
    };
  }

  const settings = await getSettings();
  const editWindowHours = Number(settings.paymentEditWindowHours ?? 3);
  const payment = await prisma.payment.findUnique({
    where: {
      id,
    },
    include: {
      credit: true,
      account: {
        include: {
          customer: true,
          product: true,
        },
      },
    },
  });

  if (!payment) {
    return {
      errors: {
        form: "Payment record could not be found.",
      },
    };
  }

  const canManageAll = hasPermission(
    user.role,
    user.permissions,
    UserPermission.MANAGE_PAYMENTS
  );

  if (
    user.role === UserRole.STAFF &&
    payment.account.customer.staffId !== user.staffId &&
    !canManageAll
  ) {
    return {
      errors: {
        form: "You cannot edit payments for another staff member's customer.",
      },
    };
  }

  if (!canEditPaymentCreatedAt(payment.createdAt, editWindowHours)) {
    return {
      errors: {
        form: `This payment can only be edited within ${editWindowHours} hour${editWindowHours === 1 ? "" : "s"} of recording.`,
      },
    };
  }

  const amountChanged = payment.amount !== amount;
  if (
    amountChanged &&
    payment.credit &&
    (payment.credit.status !== CreditStatus.OPEN ||
      payment.credit.remainingAmount !== payment.credit.amount)
  ) {
    return {
      errors: {
        form: "This payment has a resolved or partially used credit and cannot have its amount edited.",
      },
    };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const updatedPayment = await tx.payment.update({
        where: {
          id: payment.id,
        },
        data: {
          amount,
          paymentDate,
          method,
          notes: notes || null,
        },
      });

      const otherPaymentTotals = await tx.payment.aggregate({
        where: {
          accountId: payment.accountId,
          id: {
            not: payment.id,
          },
        },
        _sum: {
          amount: true,
        },
      });
      const otherPaid = otherPaymentTotals._sum.amount ?? 0;
      const balanceBeforeThisPayment = Math.max(
        payment.account.targetAmount - otherPaid,
        0
      );
      const creditAmount = Math.max(amount - balanceBeforeThisPayment, 0);

      if (amountChanged) {
        if (creditAmount > 0) {
          if (payment.credit) {
            await tx.customerCredit.update({
              where: {
                id: payment.credit.id,
              },
              data: {
                amount: creditAmount,
                remainingAmount: creditAmount,
                notes: `Overpayment from receipt ${payment.receiptNo}`,
              },
            });
          } else {
            await tx.customerCredit.create({
              data: {
                customerId: payment.account.customerId,
                accountId: payment.accountId,
                paymentId: payment.id,
                amount: creditAmount,
                remainingAmount: creditAmount,
                notes: `Overpayment from receipt ${payment.receiptNo}`,
                createdBy: user.id,
              },
            });
          }
        } else if (payment.credit) {
          await tx.customerCredit.delete({
            where: {
              id: payment.credit.id,
            },
          });
        }
      }

      const recalculated = await recalculateAccountAfterPaymentChange(
        tx,
        payment.account
      );

      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: "UPDATE_PAYMENT",
          entity: "Payment",
          entityId: payment.id,
          oldValue: JSON.stringify(payment),
          newValue: JSON.stringify({
            paymentId: updatedPayment.id,
            receiptNo: updatedPayment.receiptNo,
            accountId: payment.accountId,
            customerId: payment.account.customerId,
            productId: payment.account.productId,
            amount,
            paymentDate,
            method,
            notes: notes || null,
            newBalance: recalculated.nextBalance,
            creditAmount,
          }),
        },
      });
    });
  } catch (error) {
    console.error("UPDATE_PAYMENT_ERROR", error);
    return {
      errors: {
        form: "Unable to update payment. Please check the details and try again.",
      },
    };
  }

  revalidatePath("/payments");
  revalidatePath("/accounts");
  revalidatePath(`/accounts/${payment.accountId}`);
  revalidatePath(`/customers/${payment.account.customerId}`);
  redirect(`/accounts/${payment.accountId}?updated=payment`);
}

export async function deletePayment(formData: FormData): Promise<void> {
  const user = await requireAdmin();
  const id = cleanInput(formData.get("id"));

  await verifyAdminDeleteConfirmation({
    formData,
    adminUserId: user.id,
    redirectPath: "/payments",
  });

  const payment = await prisma.payment.findUnique({
    where: {
      id,
    },
    include: {
      account: {
        include: {
          customer: true,
          product: true,
        },
      },
    },
  });

  if (!payment) {
    redirect("/payments?error=payment-not-found");
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: "DELETE_PAYMENT",
          entity: "Payment",
          entityId: payment.id,
          oldValue: JSON.stringify(payment),
        },
      });

      await tx.payment.delete({
        where: {
          id: payment.id,
        },
      });

      await recalculateAccountAfterPaymentChange(tx, payment.account);
    });
  } catch {
    redirect("/payments?error=payment-delete-blocked");
  }

  revalidatePath("/payments");
  revalidatePath("/accounts");
  revalidatePath(`/accounts/${payment.accountId}`);
  revalidatePath(`/customers/${payment.account.customerId}`);
  redirect("/payments?deleted=payment");
}

export async function markCustomerCreditRefunded(
  formData: FormData
): Promise<void> {
  const user = await requireAdmin();
  const id = cleanInput(formData.get("id"));
  const returnTo = safeReturnTo(cleanInput(formData.get("returnTo")), "/payments");
  const adminPassword = cleanInput(formData.get("adminPassword"));

  if (!adminPassword) {
    redirect(`${returnTo}?error=admin-password-required`);
  }

  const passwordValid = await verifyAdminPassword(user.id, adminPassword);

  if (!passwordValid) {
    redirect(`${returnTo}?error=invalid-admin-password`);
  }

  const credit = await prisma.customerCredit.findUnique({
    where: {
      id,
    },
    include: {
      customer: true,
      account: true,
      payment: true,
    },
  });

  if (!credit) {
    redirect(`${returnTo}?error=credit-not-found`);
  }

  if (credit.status !== "OPEN" || credit.remainingAmount <= 0) {
    redirect(`${returnTo}?error=credit-not-open`);
  }

  await prisma.$transaction(async (tx) => {
    const updatedCredit = await tx.customerCredit.update({
      where: {
        id: credit.id,
      },
      data: {
        status: "REFUNDED",
        remainingAmount: 0,
        resolvedBy: user.id,
        resolvedAt: new Date(),
      },
    });

    await tx.auditLog.create({
      data: {
        userId: user.id,
        action: "REFUND_CUSTOMER_CREDIT",
        entity: "CustomerCredit",
        entityId: credit.id,
        oldValue: JSON.stringify(credit),
        newValue: JSON.stringify(updatedCredit),
      },
    });
  });

  revalidatePath("/payments");
  revalidatePath("/credits");
  revalidatePath("/dashboard");
  revalidatePath(`/customers/${credit.customerId}`);
  if (credit.accountId) {
    revalidatePath(`/accounts/${credit.accountId}`);
  }
  redirect(`${returnTo}?refunded=credit`);
}
