import { AccountStatus, type Prisma } from "@prisma/client";
import { consumeStaffInventory } from "@/lib/staff-inventory";

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

function assertFiniteAccountValue(name: string, value: number) {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`Invalid account ${name}.`);
  }
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
  inventoryStaffId,
}: {
  tx: Prisma.TransactionClient;
  userId: string;
  customerId: string;
  product: AccountProduct;
  startDate: Date;
  inventoryStaffId: string;
}) {
  const targetAmount = product.layawayPrice;
  const dailyAmount = product.dailyAmount;
  const expectedEndDate = addDays(startDate, product.duration);

  assertFiniteAccountValue("target amount", targetAmount);
  assertFiniteAccountValue("daily amount", dailyAmount);

  if (
    !Number.isInteger(product.duration) ||
    product.duration <= 0 ||
    Number.isNaN(startDate.getTime()) ||
    Number.isNaN(expectedEndDate.getTime())
  ) {
    throw new Error("Invalid account schedule.");
  }

  const account = await tx.customerAccount.create({
    data: {
      customerId,
      productId: product.id,
      inventoryStaffId,
      targetAmount,
      dailyAmount,
      startDate,
      expectedEndDate,
      totalPaid: 0,
      balance: targetAmount,
      status: AccountStatus.ACTIVE,
    },
  });

  await consumeStaffInventory({
    tx,
    userId,
    staffId: inventoryStaffId,
    productId: product.id,
    accountId: account.id,
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
        inventoryStaffId,
      }),
    },
  });

  return account;
}
