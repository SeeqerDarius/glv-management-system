"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { verifyAdminDeleteConfirmation } from "@/lib/admin-delete";
import { prisma } from "@/lib/prisma";
import { isAdminRole } from "@/lib/roles";

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

export async function recordStaffSalary(formData: FormData): Promise<void> {
  const user = await requireAdmin();
  const staffId = clean(formData.get("staffId"));
  const amount = Number(clean(formData.get("amount")));
  const dateValue = clean(formData.get("paymentDate"));
  const paymentDate = new Date(`${dateValue}T00:00:00`);
  const notes = clean(formData.get("notes"));

  if (!staffId) redirect("/reports?salaryError=missing-staff#salary-tracking");
  if (!Number.isFinite(amount) || amount <= 0) {
    redirect("/reports?salaryError=invalid-amount#salary-tracking");
  }
  if (!dateValue || Number.isNaN(paymentDate.getTime())) {
    redirect("/reports?salaryError=invalid-date#salary-tracking");
  }

  const staff = await prisma.staff.findUnique({ where: { id: staffId } });
  if (!staff) redirect("/reports?salaryError=missing-staff#salary-tracking");

  await prisma.$transaction(async (tx) => {
    const payment = await tx.staffSalaryPayment.create({
      data: {
        staffId: staff.id,
        amount,
        paymentDate,
        notes: notes || null,
        paidBy: user.id,
      },
    });
    await tx.auditLog.create({
      data: {
        userId: user.id,
        action: "RECORD_STAFF_SALARY",
        entity: "StaffSalaryPayment",
        entityId: payment.id,
        newValue: JSON.stringify({
          paymentId: payment.id,
          staffId: staff.id,
          amount,
          paymentDate,
          notes: notes || null,
        }),
      },
    });
  });

  revalidatePath("/reports");
  revalidatePath("/dashboard");
  redirect("/reports?salaryRecorded=1#salary-tracking");
}

export async function deleteStaffSalary(formData: FormData): Promise<void> {
  const user = await requireAdmin();
  const id = clean(formData.get("id"));
  const payment = await prisma.staffSalaryPayment.findUnique({
    where: { id },
    include: { staff: true },
  });
  if (!payment) redirect("/reports?salaryError=not-found#salary-tracking");

  await verifyAdminDeleteConfirmation({
    formData,
    adminUserId: user.id,
    redirectPath: "/reports",
    requiresStrongConfirmation: true,
  });

  await prisma.$transaction(async (tx) => {
    await tx.auditLog.create({
      data: {
        userId: user.id,
        action: "DELETE_STAFF_SALARY",
        entity: "StaffSalaryPayment",
        entityId: payment.id,
        oldValue: JSON.stringify(payment),
      },
    });
    await tx.staffSalaryPayment.delete({ where: { id: payment.id } });
  });

  revalidatePath("/reports");
  revalidatePath("/dashboard");
  redirect("/reports?salaryDeleted=1#salary-tracking");
}
