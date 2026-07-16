import { AccountStatus, DeliveryStatus } from "@prisma/client";
import { getSettings } from "@/lib/settings";
import { prisma } from "@/lib/prisma";
import { ensureStaffInventorySchema } from "@/lib/staff-inventory-schema";

const procurementStatuses = [
  AccountStatus.ACTIVE,
  AccountStatus.COMPLETED,
  AccountStatus.OVERDUE,
  AccountStatus.DORMANT,
  AccountStatus.PROBATION,
];

export type ProcurementListItem = {
  productId: string;
  productName: string;
  category: string;
  quantity: number;
  unitCost: number;
  transportCost: number;
  landedUnitCost: number;
  totalCost: number;
  layawayPrice: number;
  averageProgress: number;
  highestProgress: number;
};

export type ProcurementAccountItem = {
  accountId: string;
  customerId: string;
  customerCode: string;
  customerName: string;
  staffCode: string;
  staffName: string;
  productId: string;
  productName: string;
  category: string;
  unitCost: number;
  transportCost: number;
  landedUnitCost: number;
  layawayPrice: number;
  targetAmount: number;
  totalPaid: number;
  balance: number;
  progress: number;
};

export async function getProcurementAccounts(productId?: string) {
  await ensureStaffInventorySchema();

  const settings = await getSettings();
  const configuredThreshold = Number(
    settings.procurementThresholdPercent ?? 70
  );
  const thresholdPercent = Number.isFinite(configuredThreshold)
    ? Math.min(Math.max(configuredThreshold, 0), 100)
    : 70;
  const threshold = thresholdPercent / 100;

  const accounts = await prisma.customerAccount.findMany({
    where: {
      ...(productId ? { productId } : {}),
      deliveryStatus: DeliveryStatus.PENDING,
      status: {
        in: procurementStatuses,
      },
    },
    select: {
      id: true,
      targetAmount: true,
      totalPaid: true,
      balance: true,
      customer: {
        select: {
          id: true,
          customerId: true,
          fullName: true,
          staff: {
            select: {
              code: true,
              fullName: true,
            },
          },
        },
      },
      product: {
        select: {
          id: true,
          name: true,
          category: true,
          costPrice: true,
          transportCost: true,
          layawayPrice: true,
        },
      },
    },
  });

  const items: ProcurementAccountItem[] = [];

  for (const account of accounts) {
    const progress =
      account.targetAmount > 0 ? account.totalPaid / account.targetAmount : 0;

    if (progress < threshold) {
      continue;
    }

    const landedUnitCost =
      account.product.costPrice + account.product.transportCost;

    items.push({
      accountId: account.id,
      customerId: account.customer.id,
      customerCode: account.customer.customerId,
      customerName: account.customer.fullName,
      staffCode: account.customer.staff.code,
      staffName: account.customer.staff.fullName,
      productId: account.product.id,
      productName: account.product.name,
      category: account.product.category,
      unitCost: account.product.costPrice,
      transportCost: account.product.transportCost,
      landedUnitCost,
      layawayPrice: account.product.layawayPrice,
      targetAmount: account.targetAmount,
      totalPaid: account.totalPaid,
      balance: account.balance,
      progress,
    });
  }

  return {
    thresholdPercent,
    items: items.sort(
      (a, b) =>
        a.productName.localeCompare(b.productName) ||
        a.customerName.localeCompare(b.customerName)
    ),
  };
}

export async function getProcurementList() {
  const procurement = await getProcurementAccounts();
  const grouped = new Map<string, ProcurementListItem & { progressTotal: number }>();

  for (const account of procurement.items) {
    const existing = grouped.get(account.productId);

    if (existing) {
      existing.quantity += 1;
      existing.totalCost += account.landedUnitCost;
      existing.progressTotal += account.progress;
      existing.averageProgress = existing.progressTotal / existing.quantity;
      existing.highestProgress = Math.max(existing.highestProgress, account.progress);
      continue;
    }

    grouped.set(account.productId, {
      productId: account.productId,
      productName: account.productName,
      category: account.category,
      quantity: 1,
      unitCost: account.unitCost,
      transportCost: account.transportCost,
      landedUnitCost: account.landedUnitCost,
      totalCost: account.landedUnitCost,
      layawayPrice: account.layawayPrice,
      averageProgress: account.progress,
      highestProgress: account.progress,
      progressTotal: account.progress,
    });
  }

  const items = Array.from(grouped.values()).map((groupedItem) => ({
    productId: groupedItem.productId,
    productName: groupedItem.productName,
    category: groupedItem.category,
    quantity: groupedItem.quantity,
    unitCost: groupedItem.unitCost,
    transportCost: groupedItem.transportCost,
    landedUnitCost: groupedItem.landedUnitCost,
    totalCost: groupedItem.totalCost,
    layawayPrice: groupedItem.layawayPrice,
    averageProgress: groupedItem.averageProgress,
    highestProgress: groupedItem.highestProgress,
  })).sort(
      (a, b) =>
        b.quantity - a.quantity ||
        b.highestProgress - a.highestProgress ||
        a.productName.localeCompare(b.productName)
    );

  return {
    thresholdPercent: procurement.thresholdPercent,
    items,
    totalQuantity: items.reduce((total, item) => total + item.quantity, 0),
    totalCost: items.reduce((total, item) => total + item.totalCost, 0),
  };
}
