"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { verifyAdminDeleteConfirmation } from "@/lib/admin-delete";
import { isFutureDate } from "@/lib/date-rules";
import { prisma } from "@/lib/prisma";
import { isAdminRole } from "@/lib/roles";
import { dispatchDueSms, queueWeeklyCustomerSummarySms } from "@/lib/sms-notifications";
import {
  claimIdempotencyKey,
  completeIdempotencyKey,
  readIdempotencyKey,
} from "@/lib/idempotency";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id || !isAdminRole(session.user.role)) {
    throw new Error("Unauthorized");
  }
  return { id: session.user.id };
}

function clean(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

function weekQuery(formData: FormData) {
  const week = clean(formData.get("week"));
  return /^\d{4}-\d{2}-\d{2}$/.test(week) ? `week=${week}&` : "";
}

function weekQueryForDate(date: Date) {
  const start = new Date(date);
  const day = start.getDay();
  start.setDate(start.getDate() + (day === 0 ? -6 : 1 - day));
  const week = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;
  return `week=${week}&`;
}

export async function recordStaffDeposit(formData: FormData): Promise<void> {
  const user = await requireAdmin();
  const week = weekQuery(formData);
  const staffId = clean(formData.get("staffId"));
  const amount = Number(clean(formData.get("amount")));
  const dateValue = clean(formData.get("depositDate"));
  const depositDate = new Date(`${dateValue}T00:00:00`);
  const channel = clean(formData.get("channel"));
  const reference = clean(formData.get("reference"));
  const notes = clean(formData.get("notes"));
  const idempotencyKey = readIdempotencyKey(formData);
  const errorHref = (error: string) =>
    `/reports?${week}depositError=${error}#staff-deposits`;

  if (!staffId) redirect(errorHref("missing-staff"));
  if (!Number.isFinite(amount) || amount <= 0) {
    redirect(errorHref("invalid-amount"));
  }
  if (!dateValue || Number.isNaN(depositDate.getTime())) {
    redirect(errorHref("invalid-date"));
  }
  if (isFutureDate(depositDate)) redirect(errorHref("future-date"));
  if (!idempotencyKey) redirect(errorHref("expired-form"));

  const staff = await prisma.staff.findUnique({
    where: { id: staffId },
    select: { id: true, code: true, fullName: true },
  });
  if (!staff) redirect(errorHref("missing-staff"));

  await prisma.$transaction(async (tx) => {
    const claim = await claimIdempotencyKey({
      tx,
      userId: user.id,
      operation: "RECORD_STAFF_DEPOSIT",
      key: idempotencyKey!,
    });
    if (!claim.claimed) {
      return;
    }

    const deposit = await tx.staffDeposit.create({
      data: {
        staffId: staff.id,
        amount,
        depositDate,
        channel: channel || null,
        reference: reference || null,
        notes: notes || null,
        recordedBy: user.id,
      },
    });
    await tx.auditLog.create({
      data: {
        userId: user.id,
        action: "RECORD_STAFF_DEPOSIT",
        entity: "StaffDeposit",
        entityId: deposit.id,
        newValue: JSON.stringify({
          depositId: deposit.id,
          staffId: staff.id,
          amount,
          depositDate,
          channel: channel || null,
          reference: reference || null,
          notes: notes || null,
        }),
      },
    });
    await completeIdempotencyKey(tx, claim.id, deposit.id);
    await queueWeeklyCustomerSummarySms(tx, staff.id, deposit.depositDate);
  });

  after(() => dispatchDueSms().catch(() => console.error("Weekly customer SMS dispatch failed.")));

  revalidatePath("/reports");
  redirect(
    `/reports?${weekQueryForDate(depositDate)}depositRecorded=1#staff-deposits`
  );
}

export async function deleteStaffDeposit(formData: FormData): Promise<void> {
  const user = await requireAdmin();
  const week = weekQuery(formData);
  const id = clean(formData.get("id"));
  const deposit = await prisma.staffDeposit.findUnique({
    where: { id },
    include: { staff: true },
  });
  if (!deposit) {
    redirect(`/reports?${week}depositError=not-found#staff-deposits`);
  }

  await verifyAdminDeleteConfirmation({
    formData,
    adminUserId: user.id,
    redirectPath: "/reports",
  });

  await prisma.$transaction(async (tx) => {
    await tx.auditLog.create({
      data: {
        userId: user.id,
        action: "DELETE_STAFF_DEPOSIT",
        entity: "StaffDeposit",
        entityId: deposit.id,
        oldValue: JSON.stringify(deposit),
      },
    });
    await tx.staffDeposit.delete({ where: { id: deposit.id } });
  });

  revalidatePath("/reports");
  redirect(`/reports?${week}depositDeleted=1#staff-deposits`);
}
