import { AccountStatus, type Prisma } from "@prisma/client";
import { getSettings } from "@/lib/settings";

async function generateReceiptNo(tx: Prisma.TransactionClient) {
  const year = new Date().getFullYear().toString().slice(-2);
  const settings = await getSettings();
  const receiptPrefix = settings.receiptPrefix.replace(/\/+$/, "");
  const prefix = `${receiptPrefix}/${year}/`;
  const payments = await tx.payment.findMany({
    where: {
      receiptNo: {
        startsWith: prefix,
      },
    },
    select: {
      receiptNo: true,
    },
  });

  const maxNumber = payments.reduce((max, payment) => {
    const value = Number(payment.receiptNo.replace(prefix, ""));
    return Number.isFinite(value) && value > max ? value : max;
  }, 0);

  return `${prefix}${String(maxNumber + 1).padStart(6, "0")}`;
}

type PaymentAccount = {
  id: string;
  targetAmount: number;
  totalPaid: number;
  balance: number;
  status: AccountStatus;
  customer: {
    id: string;
  };
  product: {
    id: string;
  };
};

export function parsePaymentDate(value: string) {
  if (!value) return null;

  const parsedDate = new Date(`${value}T00:00:00`);

  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return parsedDate;
}

export async function recordPaymentForAccount({
  tx,
  userId,
  account,
  amount,
  paymentDate,
  method,
  notes,
}: {
  tx: Prisma.TransactionClient;
  userId: string;
  account: PaymentAccount;
  amount: number;
  paymentDate: Date;
  method: string;
  notes?: string | null;
}) {
  const receiptNo = await generateReceiptNo(tx);
  const nextTotalPaid = account.totalPaid + amount;
  const rawBalance = account.balance - amount;
  const nextBalance = rawBalance <= 0 ? 0 : rawBalance;
  const nextStatus =
    rawBalance <= 0 ? AccountStatus.COMPLETED : account.status;

  const createdPayment = await tx.payment.create({
    data: {
      receiptNo,
      accountId: account.id,
      amount,
      paymentDate,
      method,
      notes: notes || null,
      receivedBy: userId,
    },
  });

  const updatedAccount = await tx.customerAccount.update({
    where: {
      id: account.id,
    },
    data: {
      totalPaid: nextTotalPaid,
      balance: nextBalance,
      status: nextStatus,
    },
  });

  await tx.auditLog.create({
    data: {
      userId,
      action: "RECORD_PAYMENT",
      entity: "Payment",
      entityId: createdPayment.id,
      newValue: JSON.stringify({
        paymentId: createdPayment.id,
        receiptNo: createdPayment.receiptNo,
        accountId: account.id,
        customerId: account.customer.id,
        productId: account.product.id,
        amount,
        previousBalance: account.balance,
        newBalance: updatedAccount.balance,
      }),
    },
  });

  return createdPayment;
}
