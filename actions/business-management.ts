"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isAdminRole } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { isFutureDate } from "@/lib/date-rules";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id || !isAdminRole(session.user.role)) throw new Error("Unauthorized");
  return session.user.id;
}

function clean(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

function dateValue(value: FormDataEntryValue | null) {
  const raw = clean(value);
  const date = new Date(`${raw}T00:00:00`);
  return raw && !Number.isNaN(date.getTime()) ? date : null;
}

async function staffExists(staffId: string) {
  return Boolean(await prisma.staff.findUnique({ where: { id: staffId }, select: { id: true } }));
}

export async function createLeaveRequest(formData: FormData) {
  const userId = await requireAdmin();
  const staffId = clean(formData.get("staffId"));
  const leaveType = clean(formData.get("leaveType"));
  const startDate = dateValue(formData.get("startDate"));
  const endDate = dateValue(formData.get("endDate"));
  const reason = clean(formData.get("reason"));
  if (!staffId || !leaveType || !startDate || !endDate || endDate < startDate || !(await staffExists(staffId))) {
    redirect("/business?error=invalid-leave#people");
  }
  const request = await prisma.staffLeaveRequest.create({
    data: { staffId, leaveType, startDate, endDate, reason: reason || null, createdBy: userId },
  });
  await prisma.auditLog.create({ data: { userId, action: "CREATE_LEAVE_REQUEST", entity: "StaffLeaveRequest", entityId: request.id, newValue: JSON.stringify(request) } });
  revalidatePath("/business");
  redirect("/business?saved=leave#people");
}

export async function reviewLeaveRequest(formData: FormData) {
  const userId = await requireAdmin();
  const id = clean(formData.get("id"));
  const status = clean(formData.get("status"));
  if (!id || !["APPROVED", "REJECTED"].includes(status)) redirect("/business?error=invalid-leave-review#people");
  const result = await prisma.staffLeaveRequest.updateMany({ where: { id, status: "PENDING" }, data: { status, reviewedBy: userId, reviewedAt: new Date() } });
  if (!result.count) redirect("/business?error=leave-not-pending#people");
  await prisma.auditLog.create({ data: { userId, action: `${status}_LEAVE_REQUEST`, entity: "StaffLeaveRequest", entityId: id, newValue: JSON.stringify({ status }) } });
  revalidatePath("/business");
  redirect("/business?saved=leave-review#people");
}

export async function createPerformanceReview(formData: FormData) {
  const userId = await requireAdmin();
  const staffId = clean(formData.get("staffId"));
  const reviewDate = dateValue(formData.get("reviewDate"));
  const rating = Number(clean(formData.get("rating")));
  const strengths = clean(formData.get("strengths"));
  const improvements = clean(formData.get("improvements"));
  const notes = clean(formData.get("notes"));
  if (!staffId || !reviewDate || isFutureDate(reviewDate) || !Number.isInteger(rating) || rating < 1 || rating > 5 || !(await staffExists(staffId))) {
    redirect("/business?error=invalid-review#people");
  }
  const review = await prisma.staffPerformanceReview.create({ data: { staffId, reviewDate, rating, strengths: strengths || null, improvements: improvements || null, notes: notes || null, reviewedBy: userId } });
  await prisma.auditLog.create({ data: { userId, action: "CREATE_PERFORMANCE_REVIEW", entity: "StaffPerformanceReview", entityId: review.id, newValue: JSON.stringify(review) } });
  revalidatePath("/business");
  redirect("/business?saved=review#people");
}

export async function recordBusinessExpense(formData: FormData) {
  const userId = await requireAdmin();
  const expenseDate = dateValue(formData.get("expenseDate"));
  const category = clean(formData.get("category"));
  const description = clean(formData.get("description"));
  const amount = Number(clean(formData.get("amount")));
  const method = clean(formData.get("method"));
  const reference = clean(formData.get("reference"));
  const notes = clean(formData.get("notes"));
  if (!expenseDate || isFutureDate(expenseDate) || !category || !description || !Number.isFinite(amount) || amount <= 0) {
    redirect("/business?error=invalid-expense#accounting");
  }
  const expense = await prisma.businessExpense.create({ data: { expenseDate, category, description, amount, method: method || null, reference: reference || null, notes: notes || null, recordedBy: userId } });
  await prisma.auditLog.create({ data: { userId, action: "RECORD_BUSINESS_EXPENSE", entity: "BusinessExpense", entityId: expense.id, newValue: JSON.stringify(expense) } });
  revalidatePath("/business");
  revalidatePath("/dashboard");
  redirect("/business?saved=expense#accounting");
}
