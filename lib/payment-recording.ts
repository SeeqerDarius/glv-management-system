import { AccountStatus, type Prisma } from "@prisma/client";
import { getStatusAfterBalanceChange } from "@/lib/account-lifecycle-rules";
import { queueAccountSms } from "@/lib/sms-notifications";

async function generateReceiptNo(
  tx: Prisma.TransactionClient,
  receiptPrefixValue: string
) {
  const year = new Date().getFullYear().toString().slice(-2);
  const receiptPrefix = receiptPrefixValue.replace(/\/+$/, "");
  const prefix = `${receiptPrefix}/${year}/`;

  // Two payments recorded at the same moment used to read the same highest
  // number and both take max + 1; the unique receipt number then failed the
  // second ("Unable to record payment"). This lock makes every payment with
  // this prefix wait for the one ahead of it until its transaction commits.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${prefix}))`;

  // The highest numeric suffix, worked out in the database rather than by
  // loading every receipt of the year into memory.
  const [{ highest }] = await tx.$queryRaw<Array<{ highest: string | null }>>`
    SELECT MAX(SUBSTRING("receiptNo" FROM char_length(${prefix}) + 1)::numeric)::text AS highest
    FROM "Payment"
    WHERE starts_with("receiptNo", ${prefix})
      AND SUBSTRING("receiptNo" FROM char_length(${prefix}) + 1) ~ '^[0-9]+$'
  `;
  const maxNumber = highest ? Number(highest) : 0;

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
  receiptPrefix,
}: {
  tx: Prisma.TransactionClient;
  userId: string;
  account: PaymentAccount;
  amount: number;
  paymentDate: Date;
  method: string;
  notes?: string | null;
  receiptPrefix: string;
}) {
  const receiptNo = await generateReceiptNo(tx, receiptPrefix);
  const nextTotalPaid = account.totalPaid + amount;
  const rawBalance = account.balance - amount;
  const creditAmount = rawBalance < 0 ? Math.abs(rawBalance) : 0;
  const nextBalance = rawBalance <= 0 ? 0 : rawBalance;
  const nextStatus =
    rawBalance <= 0
      ? AccountStatus.COMPLETED
      : account.status === AccountStatus.DORMANT ||
          account.status === AccountStatus.PROBATION
        ? AccountStatus.ACTIVE
        : account.status;

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

  const createdCredit =
    creditAmount > 0
      ? await tx.customerCredit.create({
          data: {
            customerId: account.customer.id,
            accountId: account.id,
            paymentId: createdPayment.id,
            amount: creditAmount,
            remainingAmount: creditAmount,
            notes: `Overpayment from receipt ${createdPayment.receiptNo}`,
            createdBy: userId,
          },
        })
      : null;

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
        creditId: createdCredit?.id ?? null,
        creditAmount,
      }),
    },
  });

  await queueAccountSms(tx, account.id, "PROGRESS_70");
  if (nextStatus === AccountStatus.COMPLETED) {
    await queueAccountSms(tx, account.id, "READY_FOR_COLLECTION");
  }
  return createdPayment;
}

/**
 * Re-derives an account's paid total, balance and status from the payments
 * that currently exist. Shared by payment edits, payment deletion and the undo
 * engine, all of which change the payment set underneath an account.
 */
export async function recalculateAccountAfterPaymentChange(
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
  // Deleting a payment on an archived plan reopens it for collection; it used
  // to stay archived with money owing, where no payment could be recorded.
  const nextStatus = getStatusAfterBalanceChange(account.status, nextBalance);

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

  await queueAccountSms(tx, account.id, "PROGRESS_70");
  if (nextStatus === AccountStatus.COMPLETED) {
    await queueAccountSms(tx, account.id, "READY_FOR_COLLECTION");
  }
  return {
    nextTotalPaid,
    nextBalance,
    nextStatus,
  };
}
