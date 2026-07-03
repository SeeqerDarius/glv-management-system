"use server";

import { AccountStatus, UserPermission, UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import {
  parsePaymentDate,
  recordPaymentForAccount,
} from "@/lib/payment-recording";
import { prisma } from "@/lib/prisma";
import { verifyAdminDeleteConfirmation } from "@/lib/admin-delete";
import { hasPermission, isAdminRole } from "@/lib/roles";

export type PaymentFormState = {
  errors?: {
    accountId?: string;
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
    account.status === AccountStatus.SUSPENDED
  ) {
    return {
      errors: {
        accountId:
          "Payments cannot be recorded for a cancelled or suspended account.",
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

      const remainingPayments = await tx.payment.aggregate({
        where: {
          accountId: payment.accountId,
        },
        _sum: {
          amount: true,
        },
      });
      const nextTotalPaid = remainingPayments._sum.amount ?? 0;
      const nextBalance = Math.max(
        payment.account.targetAmount - nextTotalPaid,
        0
      );
      const nextStatus =
        nextBalance <= 0
          ? AccountStatus.COMPLETED
          : payment.account.status === AccountStatus.COMPLETED
            ? AccountStatus.ACTIVE
            : payment.account.status;

      await tx.customerAccount.update({
        where: {
          id: payment.accountId,
        },
        data: {
          totalPaid: nextTotalPaid,
          balance: nextBalance,
          status: nextStatus,
        },
      });
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
