import {
  AccountStatus,
  CreditStatus,
  DeliveryStatus,
  type Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { recalculateAccountAfterPaymentChange } from "@/lib/payment-recording";
import {
  isUndoable,
  undoExpiresAt,
  type ReversibleActionType,
  type UndoRefusal,
} from "@/lib/undo-rules";

/**
 * The retraction engine. An action records what it changed; a matching handler
 * puts it back.
 *
 * Every handler runs in one transaction and starts by checking that the record
 * still looks the way the action left it. Without that check a retraction would
 * silently overwrite whatever happened in between — a payment recorded after a
 * reactivation, a credit spent after a refund — which is worse than not
 * offering undo at all.
 */

type Tx = Prisma.TransactionClient;

type HandlerResult = { ok: true } | { ok: false; refusal: UndoRefusal };

const STATE_CHANGED: HandlerResult = { ok: false, refusal: "state-changed" };
const REVERSED: HandlerResult = { ok: true };

/** Money can arrive as a float, so compare in pesewas rather than exactly. */
function sameMoney(a: number, b: number) {
  return Math.round(a * 100) === Math.round(b * 100);
}

function asDate(value: string | null | undefined) {
  return value ? new Date(value) : null;
}

type ReactivationPayload = {
  before: {
    status: AccountStatus;
    totalPaid: number;
    balance: number;
    deliveryStatus: DeliveryStatus;
    deliveredAt: string | null;
    deliveredBy: string | null;
    deliveredWithBalance: boolean;
    balanceAtDelivery: number | null;
    deliveryNote: string | null;
    reactivatedAt: string | null;
  };
  after: { status: AccountStatus; totalPaid: number; balance: number };
  voidedCredits: Array<{
    id: string;
    status: CreditStatus;
    remainingAmount: number;
    resolvedBy: string | null;
    resolvedAt: string | null;
  }>;
};

async function reverseReactivation(tx: Tx, payload: ReactivationPayload, accountId: string) {
  const account = await tx.customerAccount.findUnique({ where: { id: accountId } });
  if (!account) return STATE_CHANGED;

  // A payment, a delivery or another lifecycle move since the reactivation all
  // show up here, and any of them makes restoring the old figures destructive.
  if (
    account.status !== payload.after.status ||
    !sameMoney(account.totalPaid, payload.after.totalPaid) ||
    !sameMoney(account.balance, payload.after.balance)
  ) {
    return STATE_CHANGED;
  }

  await tx.customerAccount.update({
    where: { id: accountId },
    data: {
      status: payload.before.status,
      totalPaid: payload.before.totalPaid,
      balance: payload.before.balance,
      deliveryStatus: payload.before.deliveryStatus,
      deliveredAt: asDate(payload.before.deliveredAt),
      deliveredBy: payload.before.deliveredBy,
      deliveredWithBalance: payload.before.deliveredWithBalance,
      balanceAtDelivery: payload.before.balanceAtDelivery,
      deliveryNote: payload.before.deliveryNote,
      reactivatedAt: asDate(payload.before.reactivatedAt),
    },
  });

  // The closure refund the reactivation voided goes back to the customer.
  for (const credit of payload.voidedCredits) {
    const current = await tx.customerCredit.findUnique({ where: { id: credit.id } });
    if (!current || current.status !== CreditStatus.VOID) continue;

    await tx.customerCredit.update({
      where: { id: credit.id },
      data: {
        status: credit.status,
        remainingAmount: credit.remainingAmount,
        resolvedBy: credit.resolvedBy,
        resolvedAt: asDate(credit.resolvedAt),
      },
    });
  }

  return REVERSED;
}

type DeletedPaymentPayload = {
  payment: {
    id: string;
    receiptNo: string;
    accountId: string;
    amount: number;
    paymentDate: string;
    method: string;
    notes: string | null;
    receivedBy: string;
    createdAt: string;
  };
};

async function reverseDeletedPayment(tx: Tx, payload: DeletedPaymentPayload) {
  const { payment } = payload;

  const existing = await tx.payment.findFirst({
    where: { OR: [{ id: payment.id }, { receiptNo: payment.receiptNo }] },
    select: { id: true },
  });
  if (existing) return STATE_CHANGED;

  const account = await tx.customerAccount.findUnique({
    where: { id: payment.accountId },
    select: { id: true, targetAmount: true, status: true },
  });
  if (!account) return STATE_CHANGED;

  await tx.payment.create({
    data: {
      id: payment.id,
      receiptNo: payment.receiptNo,
      accountId: payment.accountId,
      amount: payment.amount,
      paymentDate: new Date(payment.paymentDate),
      method: payment.method,
      notes: payment.notes,
      receivedBy: payment.receivedBy,
      createdAt: new Date(payment.createdAt),
    },
  });

  await recalculateAccountAfterPaymentChange(tx, account);
  return REVERSED;
}

type DeletedDepositPayload = {
  deposit: {
    id: string;
    staffId: string;
    amount: number;
    depositDate: string;
    channel: string | null;
    reference: string | null;
    notes: string | null;
    recordedBy: string;
    createdAt: string;
  };
};

async function reverseDeletedDeposit(tx: Tx, payload: DeletedDepositPayload) {
  const { deposit } = payload;

  const existing = await tx.staffDeposit.findUnique({
    where: { id: deposit.id },
    select: { id: true },
  });
  if (existing) return STATE_CHANGED;

  const staff = await tx.staff.findUnique({
    where: { id: deposit.staffId },
    select: { id: true },
  });
  if (!staff) return STATE_CHANGED;

  await tx.staffDeposit.create({
    data: {
      id: deposit.id,
      staffId: deposit.staffId,
      amount: deposit.amount,
      depositDate: new Date(deposit.depositDate),
      channel: deposit.channel,
      reference: deposit.reference,
      notes: deposit.notes,
      recordedBy: deposit.recordedBy,
      createdAt: new Date(deposit.createdAt),
    },
  });

  return REVERSED;
}

type DeletedSalaryPayload = {
  salary: {
    id: string;
    staffId: string;
    amount: number;
    paymentDate: string;
    salaryMonth: string;
    notes: string | null;
    paidBy: string;
    createdAt: string;
  };
};

async function reverseDeletedSalary(tx: Tx, payload: DeletedSalaryPayload) {
  const { salary } = payload;

  const existing = await tx.staffSalaryPayment.findUnique({
    where: { id: salary.id },
    select: { id: true },
  });
  if (existing) return STATE_CHANGED;

  const staff = await tx.staff.findUnique({
    where: { id: salary.staffId },
    select: { id: true },
  });
  if (!staff) return STATE_CHANGED;

  await tx.staffSalaryPayment.create({
    data: {
      id: salary.id,
      staffId: salary.staffId,
      amount: salary.amount,
      paymentDate: new Date(salary.paymentDate),
      salaryMonth: new Date(salary.salaryMonth),
      notes: salary.notes,
      paidBy: salary.paidBy,
      createdAt: new Date(salary.createdAt),
    },
  });

  return REVERSED;
}

type RefundedCreditPayload = {
  before: {
    status: CreditStatus;
    remainingAmount: number;
    resolvedBy: string | null;
    resolvedAt: string | null;
  };
};

async function reverseCreditRefund(tx: Tx, payload: RefundedCreditPayload, creditId: string) {
  const credit = await tx.customerCredit.findUnique({ where: { id: creditId } });
  if (!credit) return STATE_CHANGED;

  // Only a credit still sitting in the state the refund left it can go back.
  if (credit.status !== CreditStatus.REFUNDED || !sameMoney(credit.remainingAmount, 0)) {
    return STATE_CHANGED;
  }

  await tx.customerCredit.update({
    where: { id: creditId },
    data: {
      status: payload.before.status,
      remainingAmount: payload.before.remainingAmount,
      resolvedBy: payload.before.resolvedBy,
      resolvedAt: asDate(payload.before.resolvedAt),
    },
  });

  return REVERSED;
}

async function runHandler(
  tx: Tx,
  action: { action: string; entityId: string; payload: string }
): Promise<HandlerResult> {
  const payload = JSON.parse(action.payload);

  switch (action.action as ReversibleActionType) {
    case "REACTIVATE_DORMANT_ACCOUNT":
      return reverseReactivation(tx, payload as ReactivationPayload, action.entityId);
    case "DELETE_PAYMENT":
      return reverseDeletedPayment(tx, payload as DeletedPaymentPayload);
    case "DELETE_STAFF_DEPOSIT":
      return reverseDeletedDeposit(tx, payload as DeletedDepositPayload);
    case "DELETE_STAFF_SALARY":
      return reverseDeletedSalary(tx, payload as DeletedSalaryPayload);
    case "REFUND_CUSTOMER_CREDIT":
      return reverseCreditRefund(tx, payload as RefundedCreditPayload, action.entityId);
    default:
      return { ok: false, refusal: "unknown-action" };
  }
}

/**
 * Records an action as retractable. Call inside the same transaction as the
 * action itself, so an action is never left without its undo record, and an
 * undo record never survives an action that rolled back.
 */
export async function recordReversibleAction(
  tx: Tx,
  input: {
    action: ReversibleActionType;
    entity: string;
    entityId: string;
    summary: string;
    payload: unknown;
    performedBy: string;
    performedAt?: Date;
  }
) {
  const performedAt = input.performedAt ?? new Date();

  return tx.reversibleAction.create({
    data: {
      action: input.action,
      entity: input.entity,
      entityId: input.entityId,
      summary: input.summary,
      payload: JSON.stringify(input.payload),
      performedBy: input.performedBy,
      performedAt,
      expiresAt: undoExpiresAt(performedAt),
    },
  });
}

export type UndoableAction = {
  id: string;
  action: string;
  entity: string;
  entityId: string;
  summary: string;
  performedAt: Date;
  expiresAt: Date;
  performedByName: string;
};

/**
 * Actions still inside their window. `scope` narrows to one record's history
 * (an account page) or one set of entity types (the payments page).
 */
export async function listUndoableActions(
  scope: { entity?: string; entityId?: string; entities?: string[] } = {},
  now = new Date()
): Promise<UndoableAction[]> {
  const actions = await prisma.reversibleAction.findMany({
    where: {
      reversedAt: null,
      expiresAt: { gt: now },
      ...(scope.entityId ? { entityId: scope.entityId } : {}),
      ...(scope.entity ? { entity: scope.entity } : {}),
      ...(scope.entities ? { entity: { in: scope.entities } } : {}),
    },
    orderBy: { performedAt: "desc" },
    take: 25,
  });

  if (actions.length === 0) return [];

  const users = await prisma.user.findMany({
    where: { id: { in: [...new Set(actions.map((a) => a.performedBy))] } },
    select: { id: true, name: true },
  });
  const nameById = new Map(users.map((user) => [user.id, user.name]));

  return actions.map((action) => ({
    id: action.id,
    action: action.action,
    entity: action.entity,
    entityId: action.entityId,
    summary: action.summary,
    performedAt: action.performedAt,
    expiresAt: action.expiresAt,
    performedByName: nameById.get(action.performedBy) ?? "System",
  }));
}

/**
 * Retracts an action. Claims the record inside the transaction with a
 * conditional update, so two administrators pressing Undo together cannot both
 * run the handler.
 */
export async function reverseAction(
  actionId: string,
  userId: string,
  now = new Date()
): Promise<{ ok: true; action: string; entity: string; entityId: string } | { ok: false; refusal: UndoRefusal }> {
  const action = await prisma.reversibleAction.findUnique({ where: { id: actionId } });

  if (!action) return { ok: false, refusal: "not-found" };
  if (action.reversedAt) return { ok: false, refusal: "already-reversed" };
  if (!isUndoable(action, now)) return { ok: false, refusal: "expired" };

  try {
    return await prisma.$transaction(async (tx) => {
      const claimed = await tx.reversibleAction.updateMany({
        where: { id: action.id, reversedAt: null, expiresAt: { gt: now } },
        data: { reversedAt: now, reversedBy: userId },
      });

      if (claimed.count === 0) {
        return { ok: false as const, refusal: "already-reversed" as const };
      }

      const result = await runHandler(tx, action);

      if (!result.ok) {
        // Releases the claim: nothing was restored, so the window stays open.
        throw new UndoRefusedError(result.refusal);
      }

      await tx.auditLog.create({
        data: {
          userId,
          action: `UNDO_${action.action}`,
          entity: action.entity,
          entityId: action.entityId,
          oldValue: JSON.stringify({
            reversibleActionId: action.id,
            performedBy: action.performedBy,
            performedAt: action.performedAt,
          }),
          newValue: JSON.stringify({ reversedAt: now, reversedBy: userId }),
        },
      });

      return {
        ok: true as const,
        action: action.action,
        entity: action.entity,
        entityId: action.entityId,
      };
    });
  } catch (error) {
    if (error instanceof UndoRefusedError) {
      return { ok: false, refusal: error.refusal };
    }

    console.error("UNDO_ACTION_ERROR", error);
    return { ok: false, refusal: "failed" };
  }
}

class UndoRefusedError extends Error {
  constructor(readonly refusal: UndoRefusal) {
    super(refusal);
    this.name = "UndoRefusedError";
  }
}
