import { AccountStatus, DeliveryStatus } from "@prisma/client";
import { getSettings } from "@/lib/settings";
import { prisma } from "@/lib/prisma";

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
  /** Units still to be bought: demand beyond what is already in stock. */
  quantity: number;
  /** Units customers are owed, before stock is taken off. */
  unitsOwed: number;
  stockOnHand: number;
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
  /**
   * True when this unit is already sitting in the store room — stock covers it,
   * so it is waiting to be handed over rather than waiting to be bought.
   */
  coveredByStock: boolean;
};

async function getThresholdPercent() {
  const settings = await getSettings();
  const configuredThreshold = Number(
    settings.procurementThresholdPercent ?? 70
  );

  return Number.isFinite(configuredThreshold)
    ? Math.min(Math.max(configuredThreshold, 0), 100)
    : 70;
}

/**
 * Every account that has paid far enough to be owed its product and has not
 * received it yet. This is demand, not a shopping list: stock on hand has not
 * been taken off.
 */
export async function getProcurementAccounts(productId?: string) {
  const thresholdPercent = await getThresholdPercent();
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
          stockOnHand: true,
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
      coveredByStock: false,
    });
  }

  items.sort(
    (a, b) =>
      a.productName.localeCompare(b.productName) ||
      // Within a product, the customer closest to finishing is served first, so
      // that is who the stock on the shelf is reserved for.
      b.progress - a.progress ||
      a.customerName.localeCompare(b.customerName)
  );

  const stockByProduct = new Map<string, number>();

  for (const account of accounts) {
    stockByProduct.set(account.product.id, account.product.stockOnHand);
  }

  allocateStockToDemand(items, stockByProduct);

  return {
    thresholdPercent,
    items,
  };
}

/**
 * Marks the units that stock on hand already covers, in the order given.
 *
 * This is the rule the whole module turns on: a unit sitting in the store room
 * is waiting to be handed over, not waiting to be bought, so it must not make
 * the product ask to be bought again. Callers pass the items already sorted
 * with the customers nearest completion first, so the stock is reserved for
 * whoever is due it soonest.
 *
 * Mutates in place and returns the items, so it can be used either way.
 */
export function allocateStockToDemand<
  T extends { productId: string; coveredByStock: boolean },
>(items: T[], stockByProduct: Map<string, number>) {
  const remaining = new Map(stockByProduct);

  for (const item of items) {
    const available = remaining.get(item.productId) ?? 0;

    item.coveredByStock = available > 0;

    if (available > 0) {
      remaining.set(item.productId, available - 1);
    }
  }

  return items;
}

/**
 * Units owed per product, used by both the inventory page and the procurement
 * list so the two can never disagree about demand.
 */
export async function getProcurementDemand() {
  const procurement = await getProcurementAccounts();
  const unitsByProduct = new Map<string, number>();

  for (const item of procurement.items) {
    unitsByProduct.set(
      item.productId,
      (unitsByProduct.get(item.productId) ?? 0) + 1
    );
  }

  return {
    thresholdPercent: procurement.thresholdPercent,
    unitsByProduct,
  };
}

/**
 * The buying list: one row per product, showing only the units that still have
 * to be bought. A product whose stock on hand covers everything it owes does
 * not appear at all.
 */
export async function getProcurementList() {
  const procurement = await getProcurementAccounts();
  const grouped = new Map<
    string,
    ProcurementListItem & { progressTotal: number }
  >();

  for (const account of procurement.items) {
    const existing = grouped.get(account.productId);

    if (existing) {
      existing.unitsOwed += 1;
      existing.progressTotal += account.progress;
      existing.averageProgress = existing.progressTotal / existing.unitsOwed;
      existing.highestProgress = Math.max(
        existing.highestProgress,
        account.progress
      );

      if (!account.coveredByStock) {
        existing.quantity += 1;
        existing.totalCost += account.landedUnitCost;
      }

      continue;
    }

    const covered = account.coveredByStock;

    grouped.set(account.productId, {
      productId: account.productId,
      productName: account.productName,
      category: account.category,
      quantity: covered ? 0 : 1,
      unitsOwed: 1,
      stockOnHand: 0,
      unitCost: account.unitCost,
      transportCost: account.transportCost,
      landedUnitCost: account.landedUnitCost,
      totalCost: covered ? 0 : account.landedUnitCost,
      layawayPrice: account.layawayPrice,
      averageProgress: account.progress,
      highestProgress: account.progress,
      progressTotal: account.progress,
    });
  }

  const items = Array.from(grouped.values())
    // A product whose shelf already covers its customers is not something to
    // buy, so it leaves the list entirely.
    .filter((groupedItem) => groupedItem.quantity > 0)
    .map((groupedItem) => ({
      productId: groupedItem.productId,
      productName: groupedItem.productName,
      category: groupedItem.category,
      quantity: groupedItem.quantity,
      unitsOwed: groupedItem.unitsOwed,
      stockOnHand: groupedItem.unitsOwed - groupedItem.quantity,
      unitCost: groupedItem.unitCost,
      transportCost: groupedItem.transportCost,
      landedUnitCost: groupedItem.landedUnitCost,
      totalCost: groupedItem.totalCost,
      layawayPrice: groupedItem.layawayPrice,
      averageProgress: groupedItem.averageProgress,
      highestProgress: groupedItem.highestProgress,
    }))
    .sort(
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
