import { AccountStatus } from "@prisma/client";
import { getSettings } from "@/lib/settings";
import { prisma } from "@/lib/prisma";

const procurementStatuses = [
  AccountStatus.ACTIVE,
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

export async function getProcurementList() {
  const settings = await getSettings();
  const thresholdPercent = Number(settings.procurementThresholdPercent ?? 85);
  const threshold = Math.min(Math.max(thresholdPercent, 0), 100) / 100;

  const accounts = await prisma.customerAccount.findMany({
    where: {
      balance: {
        gt: 0,
      },
      status: {
        in: procurementStatuses,
      },
    },
    select: {
      id: true,
      targetAmount: true,
      totalPaid: true,
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

  const grouped = new Map<string, ProcurementListItem & { progressTotal: number }>();

  for (const account of accounts) {
    const progress =
      account.targetAmount > 0 ? account.totalPaid / account.targetAmount : 0;

    if (progress < threshold || progress >= 1) {
      continue;
    }

    const product = account.product;
    const landedUnitCost = product.costPrice + product.transportCost;
    const existing = grouped.get(product.id);

    if (existing) {
      existing.quantity += 1;
      existing.totalCost += landedUnitCost;
      existing.progressTotal += progress;
      existing.averageProgress = existing.progressTotal / existing.quantity;
      existing.highestProgress = Math.max(existing.highestProgress, progress);
      continue;
    }

    grouped.set(product.id, {
      productId: product.id,
      productName: product.name,
      category: product.category,
      quantity: 1,
      unitCost: product.costPrice,
      transportCost: product.transportCost,
      landedUnitCost,
      totalCost: landedUnitCost,
      layawayPrice: product.layawayPrice,
      averageProgress: progress,
      highestProgress: progress,
      progressTotal: progress,
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
    thresholdPercent,
    items,
    totalQuantity: items.reduce((total, item) => total + item.quantity, 0),
    totalCost: items.reduce((total, item) => total + item.totalCost, 0),
  };
}
