import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AccountStatus,
  DeliveryStatus,
  UserPermission,
  UserRole,
} from "@prisma/client";
import {
  ArrowLeft,
  HandCoins,
  PackageCheck,
  RotateCcw,
  Trash2,
} from "lucide-react";
import {
  deleteAccount,
  reactivateDormantAccount,
  updateAccountDeliveryStatus,
} from "@/actions/accounts";
import { AccountDaysProgress } from "@/components/account-days-progress";
import { AccountProductCorrectionForm } from "@/components/account-product-correction-form";
import { CustomerCreditRefundForm } from "@/components/customer-credit-refund-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDeleteForm } from "@/components/confirm-delete-form";
import { DeliveryStatusIcon } from "@/components/delivery-status-icon";
import { formatMoney, getEffectiveAccountStatus } from "@/lib/accounts";
import {
  getDormantReactivationAmounts,
  getDormantReactivationCutoffDate,
  isDormantReactivationEligible,
  refreshAccountLifecycleStatuses,
} from "@/lib/account-lifecycle";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission, isAdminRole } from "@/lib/roles";

type AccountDetailsPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<Record<string, string | undefined>>;
};

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export default async function AccountDetailsPage({
  params,
  searchParams,
}: AccountDetailsPageProps) {
  const { id } = await params;
  const { error, refunded, updated } = await searchParams;
  const session = await auth();
  const isStaff = session?.user?.role === UserRole.STAFF;
  const isAdmin = isAdminRole(session?.user?.role);
  const canManageAll = hasPermission(
    session?.user?.role,
    session?.user?.permissions,
    UserPermission.MANAGE_ACCOUNTS,
  );

  await refreshAccountLifecycleStatuses();

  const account = await prisma.customerAccount.findFirst({
    where: {
      id,
      ...(isStaff && !canManageAll && session.user.staffId
        ? {
            customer: {
              staffId: session.user.staffId,
            },
          }
        : {}),
    },
    include: {
      customer: {
        include: {
          staff: true,
        },
      },
      product: true,
      payments: {
        orderBy: {
          paymentDate: "desc",
        },
      },
      credits: {
        orderBy: {
          createdAt: "desc",
        },
        include: {
          payment: {
            select: {
              receiptNo: true,
            },
          },
        },
      },
    },
  });

  if (!account) {
    notFound();
  }

  const products = isAdmin
    ? await prisma.product.findMany({
        where: {
          active: true,
        },
        orderBy: {
          name: "asc",
        },
        select: {
          id: true,
          name: true,
          category: true,
          layawayPrice: true,
          dailyAmount: true,
          duration: true,
        },
      })
    : [];

  const status = getEffectiveAccountStatus(account);
  const canRecordPayment =
    account.balance > 0 &&
    account.status !== AccountStatus.COMPLETED &&
    account.status !== AccountStatus.CANCELLED &&
    account.status !== AccountStatus.SUSPENDED &&
    account.status !== AccountStatus.CLOSED &&
    account.status !== AccountStatus.ARCHIVED;
  const isCompleted = status === "COMPLETED" && account.balance <= 0;
  const isDelivered = account.deliveryStatus === DeliveryStatus.DELIVERED;
  const canReactivateDormant =
    isAdmin && isDormantReactivationEligible(account);
  const reactivationCutoffDate = getDormantReactivationCutoffDate(account);
  const reactivationAmounts = getDormantReactivationAmounts(account.totalPaid);
  const reactivationBalance = Math.max(
    account.targetAmount - reactivationAmounts.nextTotalPaid,
    0
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <Link
            href="/accounts"
            aria-label="Back to accounts"
            title="Back"
            className="group/back mt-1 flex size-8 items-center justify-center rounded-md text-gray-400 transition-all duration-150 hover:bg-gray-100 hover:text-gray-700"
          >
            <ArrowLeft className="size-4 transition-transform duration-200 group-hover/back:scale-125 group-hover/back:-translate-x-0.5" />
          </Link>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="break-words text-2xl font-bold text-gray-950 sm:text-3xl">
                {account.product.name}
              </h1>
              <Badge variant={status === "OVERDUE" ? "destructive" : "default"}>
                {status}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-gray-600">
              Account for {account.customer.fullName}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 sm:gap-0.5">
          {isAdmin ? (
            <ConfirmDeleteForm
              action={deleteAccount}
              id={account.id}
              title={`Delete ${account.product.name} account?`}
              hasLinkedHistory={account.payments.length > 0}
              description="This permanently deletes the account and every related payment record. This cannot be undone."
              triggerClassName="group/del flex size-8 items-center justify-center rounded-md text-gray-400 transition-all duration-150 hover:bg-red-50 hover:text-red-600"
            >
              <Trash2 className="size-4 transition-transform duration-200 group-hover/del:scale-125 group-hover/del:-translate-y-0.5" />
            </ConfirmDeleteForm>
          ) : null}
          {canRecordPayment ? (
            <Link
              href={`/payments/new?customerId=${account.customer.id}&accountId=${account.id}`}
              aria-label="Record payment"
              title="Record Payment"
              className="group/pay flex size-8 items-center justify-center rounded-md text-gray-400 transition-all duration-150 hover:bg-lime-50 hover:text-green-700"
            >
              <HandCoins className="size-4 transition-transform duration-200 group-hover/pay:scale-125 group-hover/pay:-translate-y-0.5" />
            </Link>
          ) : null}
          {isAdmin ? (
            <AccountProductCorrectionForm
              accountId={account.id}
              currentProductId={account.product.id}
              currentProductName={account.product.name}
              products={products}
              totalPaid={account.totalPaid}
              returnTo={`/accounts/${account.id}`}
              showLabel
            />
          ) : null}
        </div>
      </div>

      {status === "COMPLETED" ? (
        <div className="flex flex-col gap-3 rounded-lg border border-lime-200 bg-lime-50 p-4 text-sm text-lime-900 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium">
              {isDelivered
                ? "This product has been delivered."
                : "This account is completed. Delivery is pending."}
            </p>
            <p className="mt-1 text-lime-800">
              Mark the product as delivered after the customer receives it.
            </p>
          </div>
          {isCompleted ? (
            <form action={updateAccountDeliveryStatus}>
              <input type="hidden" name="id" value={account.id} />
              <input
                type="hidden"
                name="deliveryStatus"
                value={
                  isDelivered
                    ? DeliveryStatus.PENDING
                    : DeliveryStatus.DELIVERED
                }
              />
              <Button
                type="submit"
                variant={isDelivered ? "outline" : "default"}
                className="w-full gap-2 sm:w-auto"
              >
                {isDelivered ? (
                  <>
                    <RotateCcw className="size-4" />
                    Mark pending
                  </>
                ) : (
                  <>
                    <PackageCheck className="size-4" />
                    Mark delivered
                  </>
                )}
              </Button>
            </form>
          ) : null}
        </div>
      ) : null}

      {canReactivateDormant ? (
        <div className="flex flex-col gap-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="font-medium">
              Reactivate this dormant account with the six-month service fee.
            </p>
            <p className="mt-1 text-amber-900">
              Eligible from {formatDate(reactivationCutoffDate)}. A 32% service
              fee ({formatMoney(reactivationAmounts.serviceFee)}) will be
              deducted from the old paid balance, leaving{" "}
              {formatMoney(reactivationAmounts.nextTotalPaid)} paid and{" "}
              {formatMoney(reactivationBalance)} outstanding.
            </p>
          </div>
          <form
            action={reactivateDormantAccount}
            className="flex flex-col gap-2 sm:min-w-72 sm:flex-row sm:items-end"
          >
            <input type="hidden" name="id" value={account.id} />
            <input
              type="hidden"
              name="returnTo"
              value={`/accounts/${account.id}`}
            />
            <label className="flex-1 text-xs font-medium text-amber-950">
              Admin password
              <input
                type="password"
                name="adminPassword"
                className="mt-1 w-full rounded-md border border-amber-300 bg-white px-3 py-2 text-sm text-gray-950 outline-none focus:border-amber-500"
                required
              />
            </label>
            <Button type="submit" className="shrink-0">
              Reactivate
            </Button>
          </form>
        </div>
      ) : null}

      {error === "delivery-not-completed" ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Product delivery can only be changed after the account is fully paid.
        </div>
      ) : null}

      {updated === "account-reactivated" ? (
        <div className="rounded-lg border border-lime-200 bg-lime-50 p-4 text-sm text-lime-900">
          Account reactivated. The dormant service fee was deducted from the old paid balance.
        </div>
      ) : null}

      {error === "reactivation-not-eligible" ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          This account is not eligible for six-month dormant reactivation yet.
        </div>
      ) : null}

      {updated === "account-product" ? (
        <div className="rounded-lg border border-lime-200 bg-lime-50 p-4 text-sm text-lime-900">
          Account product corrected. Existing payments now count toward the corrected product.
        </div>
      ) : null}

      {refunded === "credit" ? (
        <div className="rounded-lg border border-lime-200 bg-lime-50 p-4 text-sm text-lime-900">
          Customer credit marked as refunded.
        </div>
      ) : null}

      {error === "invalid-account-product" ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          Select an active replacement product before correcting this account.
        </div>
      ) : null}

      {error === "credit-not-found" || error === "credit-not-open" ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          This credit could not be refunded. It may already be closed.
        </div>
      ) : null}

      {error === "account-delete-blocked" ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          This account could not be deleted. Review its related records and try again.
        </div>
      ) : null}

      {error === "delete-confirmation-required" ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          Type DELETE in the confirmation box before deleting account records.
        </div>
      ) : null}

      {error === "admin-password-required" || error === "invalid-admin-password" ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          Enter a valid admin password before changing account records.
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border bg-white p-5">
          <h2 className="text-base font-semibold text-gray-950">
            Customer Information
          </h2>
          <dl className="mt-4 grid gap-3 text-sm">
            <div>
              <dt className="text-gray-500">Name</dt>
              <dd className="font-medium text-gray-950">
                {account.customer.fullName}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500">Customer ID</dt>
              <dd className="font-medium text-gray-950">
                {account.customer.customerId}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500">Phone</dt>
              <dd className="font-medium text-gray-950">
                {account.customer.phone || "-"}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500">Assigned Staff</dt>
              <dd className="font-medium text-gray-950">
                {account.customer.staff.fullName} ({account.customer.staff.code})
              </dd>
            </div>
          </dl>
        </div>

        <div className="rounded-lg border bg-white p-5">
          <h2 className="text-base font-semibold text-gray-950">
            Product Information
          </h2>
          <dl className="mt-4 grid gap-3 text-sm">
            <div>
              <dt className="text-gray-500">Product</dt>
              <dd className="font-medium text-gray-950">
                {account.product.name}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500">Category</dt>
              <dd className="font-medium text-gray-950">
                {account.product.category}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500">Layaway Price</dt>
              <dd className="font-medium text-gray-950">
                {formatMoney(account.product.layawayPrice)}
              </dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border bg-white p-5">
          <p className="text-sm text-gray-500">Target Amount</p>
          <p className="mt-2 text-xl font-semibold text-gray-950">
            {formatMoney(account.targetAmount)}
          </p>
        </div>
        <div className="rounded-lg border bg-white p-5">
          <p className="text-sm text-gray-500">Daily Amount</p>
          <p className="mt-2 text-xl font-semibold text-gray-950">
            {formatMoney(account.dailyAmount)}
          </p>
        </div>
        <div className="rounded-lg border bg-white p-5">
          <p className="text-sm text-gray-500">Total Paid</p>
          <p className="mt-2 text-xl font-semibold text-gray-950">
            {formatMoney(account.totalPaid)}
          </p>
        </div>
        <div className="rounded-lg border bg-white p-5">
          <p className="text-sm text-gray-500">Balance</p>
          <p className="mt-2 text-xl font-semibold text-gray-950">
            {formatMoney(account.balance)}
          </p>
        </div>
      </section>

      <section className="rounded-lg border bg-white p-5">
        <AccountDaysProgress
          totalPaid={account.totalPaid}
          dailyAmount={account.dailyAmount}
          duration={account.product.duration}
          showLabel
        />
      </section>

      <section className="rounded-lg border bg-white">
        <div className="border-b p-5">
          <h2 className="text-base font-semibold text-gray-950">
            Refund / Credit Ledger
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[620px] text-sm">
            <thead>
              <tr className="bg-gray-100 text-left text-gray-700">
                <th className="p-3 font-medium">Date</th>
                <th className="p-3 font-medium">Receipt</th>
                <th className="p-3 font-medium">Credit</th>
                <th className="p-3 font-medium">Remaining</th>
                <th className="p-3 font-medium">Status</th>
                {isAdmin ? (
                  <th className="p-3 text-right font-medium">Actions</th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {account.credits.map((credit) => (
                <tr key={credit.id} className="border-t">
                  <td className="p-3">{formatDate(credit.createdAt)}</td>
                  <td className="p-3 font-mono text-xs">
                    {credit.payment?.receiptNo ?? "-"}
                  </td>
                  <td className="p-3 font-semibold text-gray-950">
                    {formatMoney(credit.amount)}
                  </td>
                  <td className="p-3">{formatMoney(credit.remainingAmount)}</td>
                  <td className="p-3">{credit.status}</td>
                  {isAdmin ? (
                    <td className="p-3 text-right">
                      {credit.status === "OPEN" && credit.remainingAmount > 0 ? (
                        <div className="flex justify-end">
                          <CustomerCreditRefundForm
                            creditId={credit.id}
                            amount={credit.remainingAmount}
                            returnTo={`/accounts/${account.id}`}
                          />
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
                      )}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {account.credits.length === 0 ? (
          <div className="border-t p-8 text-center text-sm text-gray-600">
            No overpayment credits recorded for this account.
          </div>
        ) : null}
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border bg-white p-5">
          <p className="text-sm text-gray-500">Duration</p>
          <p className="mt-2 text-xl font-semibold text-gray-950">
            {account.product.duration} days
          </p>
        </div>
        <div className="rounded-lg border bg-white p-5">
          <p className="text-sm text-gray-500">Start Date</p>
          <p className="mt-2 text-xl font-semibold text-gray-950">
            {formatDate(account.startDate)}
          </p>
        </div>
        <div className="rounded-lg border bg-white p-5">
          <p className="text-sm text-gray-500">Expected End Date</p>
          <p className="mt-2 text-xl font-semibold text-gray-950">
            {formatDate(account.expectedEndDate)}
          </p>
        </div>
        <div className="rounded-lg border bg-white p-5">
          <p className="text-sm text-gray-500">Delivery</p>
          <div className="mt-2">
            <DeliveryStatusIcon status={account.deliveryStatus} />
          </div>
          {account.deliveredAt ? (
            <p className="mt-2 text-xs text-gray-500">
              Delivered {formatDate(account.deliveredAt)}
            </p>
          ) : null}
        </div>
      </section>

      <section className="rounded-lg border bg-white">
        <div className="border-b p-5">
          <h2 className="text-base font-semibold text-gray-950">
            Payment History
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[620px] text-sm">
            <thead>
              <tr className="bg-gray-100 text-left text-gray-700">
                <th className="p-3 font-medium">Receipt</th>
                <th className="p-3 font-medium">Date</th>
                <th className="p-3 font-medium">Amount</th>
                <th className="p-3 font-medium">Method</th>
                <th className="p-3 font-medium">Notes</th>
              </tr>
            </thead>
            <tbody>
              {account.payments.map((payment) => (
                <tr key={payment.id} className="border-t">
                  <td className="p-3 font-semibold text-gray-950">
                    {payment.receiptNo}
                  </td>
                  <td className="p-3">{formatDate(payment.paymentDate)}</td>
                  <td className="p-3">{formatMoney(payment.amount)}</td>
                  <td className="p-3">{payment.method}</td>
                  <td className="p-3">{payment.notes || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {account.payments.length === 0 ? (
          <div className="border-t p-8 text-center text-sm text-gray-600">
            No payments recorded for this account yet.
          </div>
        ) : null}
      </section>
    </div>
  );
}
