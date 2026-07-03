import { AccountStatus, type Prisma } from "@prisma/client";

export function parseAccountStartDate(value: string) {
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

type AccountProduct = {
  id: string;
  layawayPrice: number;
  dailyAmount: number;
  duration: number;
};

export async function createCustomerAccountForProduct({
  tx,
  userId,
  customerId,
  product,
  startDate,
}: {
  tx: Prisma.TransactionClient;
  userId: string;
  customerId: string;
  product: AccountProduct;
  startDate: Date;
}) {
  const targetAmount = product.layawayPrice;
  const dailyAmount = product.dailyAmount;
  const expectedEndDate = addDays(startDate, product.duration);

  const account = await tx.customerAccount.create({
    data: {
      customerId,
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
      userId,
      action: "CREATE_ACCOUNT",
      entity: "CustomerAccount",
      entityId: account.id,
      newValue: JSON.stringify({
        accountId: account.id,
        customerId,
        productId: product.id,
      }),
    },
  });

  return account;
}
