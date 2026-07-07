import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { UserPermission, UserRole } from "@prisma/client";
import { PaymentEditForm } from "@/components/payment-edit-form";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/roles";
import { getSettings } from "@/lib/settings";

type EditPaymentPageProps = {
  params: Promise<{
    id: string;
  }>;
};

function dateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

function canEditPayment(createdAt: Date, windowHours: number) {
  const elapsedMs = Date.now() - createdAt.getTime();
  return elapsedMs >= 0 && elapsedMs <= windowHours * 60 * 60 * 1000;
}

export default async function EditPaymentPage({ params }: EditPaymentPageProps) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.id || !session.user.role) {
    redirect("/login");
  }

  const settings = await getSettings();
  const editWindowHours = Number(settings.paymentEditWindowHours ?? 3);
  const canManageAll = hasPermission(
    session.user.role,
    session.user.permissions,
    UserPermission.MANAGE_PAYMENTS
  );

  const payment = await prisma.payment.findUnique({
    where: {
      id,
    },
    include: {
      account: {
        include: {
          customer: {
            include: {
              staff: true,
            },
          },
          product: true,
        },
      },
    },
  });

  if (!payment) {
    notFound();
  }

  if (
    session.user.role === UserRole.STAFF &&
    payment.account.customer.staffId !== session.user.staffId &&
    !canManageAll
  ) {
    redirect("/payments?error=payment-not-found");
  }

  const editable = canEditPayment(payment.createdAt, editWindowHours);

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex min-w-0 items-start gap-3">
        <Link
          href={`/accounts/${payment.accountId}`}
          aria-label="Back to account"
          title="Back"
          className="mt-1 flex size-8 items-center justify-center rounded-md text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-gray-950">Edit Payment</h1>
          <p className="mt-1 text-sm text-gray-600">
            {payment.account.customer.fullName} | {payment.account.product.name}
          </p>
          <p className="mt-1 text-xs text-gray-500">
            Payments can be edited within {editWindowHours} hour
            {editWindowHours === 1 ? "" : "s"} of being recorded.
          </p>
        </div>
      </div>

      {editable ? (
        <PaymentEditForm
          payment={{
            id: payment.id,
            receiptNo: payment.receiptNo,
            amount: payment.amount,
            paymentDate: dateInputValue(payment.paymentDate),
            method: payment.method,
            notes: payment.notes ?? "",
            accountId: payment.accountId,
          }}
        />
      ) : (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          This payment is outside the {editWindowHours}-hour edit window and can
          no longer be changed.
        </div>
      )}
    </div>
  );
}
