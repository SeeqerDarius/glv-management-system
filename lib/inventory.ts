import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Why a product's stock on hand changed. Every movement carries one, so the
 * ledger reads as a story rather than a column of numbers.
 */
export const INVENTORY_REASONS = {
  OPENING: "OPENING",
  RECEIVED: "RECEIVED",
  DELIVERED: "DELIVERED",
  RETURNED: "RETURNED",
  CORRECTION: "CORRECTION",
} as const;

export type InventoryReason =
  (typeof INVENTORY_REASONS)[keyof typeof INVENTORY_REASONS];

export const INVENTORY_REASON_LABELS: Record<string, string> = {
  OPENING: "Opening stock",
  RECEIVED: "Stock received",
  DELIVERED: "Delivered to customer",
  RETURNED: "Delivery reversed",
  CORRECTION: "Count corrected",
};

export function inventoryReasonLabel(reason: string) {
  return INVENTORY_REASON_LABELS[reason] ?? reason;
}

type TransactionClient = Prisma.TransactionClient;

type RecordMovementInput = {
  productId: string;
  /** Signed change. Positive when stock arrives, negative when it leaves. */
  delta: number;
  reason: InventoryReason;
  createdBy: string;
  note?: string | null;
  accountId?: string | null;
  /**
   * Stock cannot go below zero on purpose. Delivery passes `false` so that
   * handing over a unit we forgot to log still records, rather than blocking
   * the customer at the counter.
   */
  clampAtZero?: boolean;
};

/**
 * Applies a stock change and writes the matching ledger row inside the caller's
 * transaction, so the balance and its explanation can never drift apart.
 *
 * Returns the balance before and after, and whether the move was clamped —
 * callers use that to tell the operator "this went out untracked".
 */
export async function recordInventoryMovement(
  tx: TransactionClient,
  {
    productId,
    delta,
    reason,
    createdBy,
    note,
    accountId,
    clampAtZero = true,
  }: RecordMovementInput
) {
  const product = await tx.product.findUnique({
    where: { id: productId },
    select: { id: true, stockOnHand: true },
  });

  if (!product) {
    throw new Error("Product not found");
  }

  const raw = product.stockOnHand + delta;
  const balanceAfter = Math.max(raw, 0);
  const clamped = raw < 0;
  const appliedDelta = balanceAfter - product.stockOnHand;

  if (clamped && clampAtZero) {
    throw new Error("Stock on hand cannot go below zero");
  }

  if (appliedDelta === 0 && reason !== INVENTORY_REASONS.CORRECTION) {
    return {
      balanceBefore: product.stockOnHand,
      balanceAfter,
      appliedDelta,
      clamped,
    };
  }

  await tx.product.update({
    where: { id: productId },
    data: { stockOnHand: balanceAfter },
  });

  await tx.inventoryMovement.create({
    data: {
      productId,
      delta: appliedDelta,
      reason,
      balanceAfter,
      note: note?.trim() ? note.trim().slice(0, 500) : null,
      accountId: accountId ?? null,
      createdBy,
    },
  });

  return {
    balanceBefore: product.stockOnHand,
    balanceAfter,
    appliedDelta,
    clamped,
  };
}

export type InventoryProductRow = {
  productId: string;
  name: string;
  category: string;
  imageUrl: string | null;
  active: boolean;
  stockOnHand: number;
  /** Units customers have paid far enough to be owed, still awaiting delivery. */
  unitsOwed: number;
  /** What still has to be bought: units owed beyond what is on the shelf. */
  shortfall: number;
  landedUnitCost: number;
  layawayPrice: number;
  lastMovementAt: Date | null;
};

/**
 * Stock on hand for every product, alongside the demand it is covering.
 *
 * `unitsOwed` comes from the procurement engine so the inventory page and the
 * procurement list can never disagree about how many units are due.
 */
export async function getInventory(options?: { includeInactive?: boolean }) {
  const { getProcurementDemand } = await import("@/lib/procurement");
  const [products, demand, lastMovements] = await Promise.all([
    prisma.product.findMany({
      where: options?.includeInactive ? {} : { active: true },
      select: {
        id: true,
        name: true,
        category: true,
        imageUrl: true,
        active: true,
        stockOnHand: true,
        costPrice: true,
        transportCost: true,
        layawayPrice: true,
      },
      orderBy: { name: "asc" },
    }),
    getProcurementDemand(),
    prisma.inventoryMovement.groupBy({
      by: ["productId"],
      _max: { createdAt: true },
    }),
  ]);

  const lastMovementByProduct = new Map(
    lastMovements.map((row) => [row.productId, row._max.createdAt])
  );

  const rows: InventoryProductRow[] = products.map((product) => {
    const unitsOwed = demand.unitsByProduct.get(product.id) ?? 0;

    return {
      productId: product.id,
      name: product.name,
      category: product.category,
      imageUrl: product.imageUrl,
      active: product.active,
      stockOnHand: product.stockOnHand,
      unitsOwed,
      shortfall: Math.max(unitsOwed - product.stockOnHand, 0),
      landedUnitCost: product.costPrice + product.transportCost,
      layawayPrice: product.layawayPrice,
      lastMovementAt: lastMovementByProduct.get(product.id) ?? null,
    };
  });

  return {
    thresholdPercent: demand.thresholdPercent,
    rows,
    totalUnits: rows.reduce((total, row) => total + row.stockOnHand, 0),
    totalValue: rows.reduce(
      (total, row) => total + row.stockOnHand * row.landedUnitCost,
      0
    ),
    productsInStock: rows.filter((row) => row.stockOnHand > 0).length,
    productsShort: rows.filter((row) => row.shortfall > 0).length,
  };
}

export type InventoryMovementRow = {
  id: string;
  productId: string;
  productName: string;
  delta: number;
  reason: string;
  balanceAfter: number;
  note: string | null;
  accountId: string | null;
  createdByName: string;
  createdAt: Date;
};

/**
 * The movement ledger, newest first. Names are resolved here rather than by a
 * database relation because `createdBy` also holds the literal `system`, used
 * for the opening balances carried over when inventory was introduced.
 */
export async function getInventoryMovements(options?: {
  productId?: string;
  take?: number;
}) {
  const movements = await prisma.inventoryMovement.findMany({
    where: options?.productId ? { productId: options.productId } : {},
    orderBy: { createdAt: "desc" },
    take: options?.take ?? 100,
    select: {
      id: true,
      productId: true,
      delta: true,
      reason: true,
      balanceAfter: true,
      note: true,
      accountId: true,
      createdBy: true,
      createdAt: true,
      product: { select: { name: true } },
    },
  });

  const userIds = Array.from(
    new Set(movements.map((movement) => movement.createdBy))
  ).filter((id) => id !== "system");

  const users = userIds.length
    ? await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true, email: true },
      })
    : [];

  const nameById = new Map(
    users.map((user) => [user.id, user.name || user.email || "Unknown user"])
  );

  return movements.map<InventoryMovementRow>((movement) => ({
    id: movement.id,
    productId: movement.productId,
    productName: movement.product.name,
    delta: movement.delta,
    reason: movement.reason,
    balanceAfter: movement.balanceAfter,
    note: movement.note,
    accountId: movement.accountId,
    createdByName:
      movement.createdBy === "system"
        ? "System"
        : nameById.get(movement.createdBy) ?? "Unknown user",
    createdAt: movement.createdAt,
  }));
}
