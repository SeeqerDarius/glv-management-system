"use server";

import { redirect } from "next/navigation";
import { AccountStatus } from "@prisma/client";
import { auth } from "@/lib/auth";
import {
  getClosureRefundAmounts,
  getDormantReactivationAmounts,
  isDormantReactivationEligible,
} from "@/lib/account-lifecycle";
import { formatMoney } from "@/lib/accounts";
import { createAccountDocument } from "@/lib/customer-documents";
import { LEGAL_TEMPLATE_KEYS } from "@/lib/legal-templates";
import { prisma } from "@/lib/prisma";
import { isAdminRole } from "@/lib/roles";

function clean(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

export async function generateCustomerDocument(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id || !isAdminRole(session.user.role)) {
    throw new Error("Unauthorized");
  }
  const accountId = clean(formData.get("accountId"));
  const kind = clean(formData.get("kind"));
  const account = await prisma.customerAccount.findUnique({
    where: { id: accountId },
    include: {
      product: true,
      payments: {
        orderBy: { paymentDate: "desc" },
        take: 1,
        select: { paymentDate: true },
      },
    },
  });
  if (!account) redirect("/accounts");

  let templateKey: string;
  let type: string;
  let values: Record<string, string>;
  if (kind === "CANCELLATION") {
    if (
      account.status !== AccountStatus.CLOSED &&
      account.status !== AccountStatus.CANCELLED
    ) {
      redirect(`/accounts/${accountId}?error=document-not-eligible`);
    }
    const calculation = getClosureRefundAmounts(account.totalPaid);
    templateKey = LEGAL_TEMPLATE_KEYS.CANCELLATION;
    type = "CANCELLATION_CALCULATION";
    values = {
      deductionRate: `${Math.round(calculation.serviceFeeRate * 100)}%`,
      deductionAmount: formatMoney(calculation.serviceFee),
      refundAmount: formatMoney(calculation.refundAmount),
      refundMethod: clean(formData.get("refundMethod")) || "Customer credit / approved payment channel",
      processingTime: clean(formData.get("processingTime")) || "Subject to review and approval",
    };
  } else if (kind === "REACTIVATION") {
    if (!isDormantReactivationEligible(account)) {
      redirect(`/accounts/${accountId}?error=document-not-eligible`);
    }
    const calculation = getDormantReactivationAmounts(account.totalPaid);
    templateKey = LEGAL_TEMPLATE_KEYS.REACTIVATION;
    type = "REACTIVATION_CALCULATION";
    values = {
      previousAmountPaid: formatMoney(account.totalPaid),
      deductionRate: `${Math.round(calculation.serviceFeeRate * 100)}%`,
      reactivationCharge: formatMoney(calculation.serviceFee),
      amountRemainingAfterCharge: formatMoney(calculation.nextTotalPaid),
      newBalance: formatMoney(
        Math.max(account.targetAmount - calculation.nextTotalPaid, 0)
      ),
      expectedCompletionDate: account.expectedEndDate.toLocaleDateString("en-GB"),
    };
  } else {
    templateKey = LEGAL_TEMPLATE_KEYS.TERMS;
    type = "CUSTOMER_TERMS";
    values = {};
  }

  const document = await createAccountDocument({
    accountId,
    templateKey,
    type,
    createdBy: session.user.id,
    values,
    dedupeBase: `${type}:${accountId}:${Date.now()}`,
  });
  if (!document) redirect(`/accounts/${accountId}?error=document`);
  redirect(`/documents/${document.id}`);
}
