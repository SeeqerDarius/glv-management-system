import Link from "next/link";
import { notFound } from "next/navigation";
import { UserRole } from "@prisma/client";
import { deleteAccount } from "@/actions/accounts";
import { AccountDaysProgress } from "@/components/account-days-progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDeleteForm } from "@/components/confirm-delete-form";
import { formatMoney, getEffectiveAccountStatus } from "@/lib/accounts";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdminRole } from "@/lib/roles";

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
  const { error } = await searchParams;
  const session = await auth();
  const isStaff = session?.user?.role === UserRole.STAFF;
  const isAdmin = isAdminRole(session?.user?.role);

  const account = await prisma.customerAccount.findFirst({
    where: {
      id,
      ...(isStaff && session.user.staffId
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
    },
  });

  if (!account) {
    notFound();
  }

  const status = getEffectiveAccountStatus(account);
  const canRecordPayment =
    account.balance > 0 &&
    !["COMPLETED", "CANCELLED", "SUSPENDED"].includes(account.status);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-gray-950">
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

        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/accounts">Back</Link>
          </Button>
          {isAdmin ? (
            <ConfirmDeleteForm
              action={deleteAccount}
              id={account.id}
              title={`Delete ${account.product.name} account?`}
              description="This permanently deletes the account and every related payment record. This cannot be undone."
            >
              Delete
            </ConfirmDeleteForm>
          ) : null}
          {canRecordPayment ? (
            <Button asChild>
              <Link href="/payments/new">Record Payment</Link>
            </Button>
          ) : null}
        </div>
      </div>

      {status === "COMPLETED" ? (
        <div className="rounded-lg border border-lime-200 bg-lime-50 p-4 text-sm text-lime-900">
          This account is completed. The product is ready for release/collection.
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
          Enter a valid admin password before deleting account records.
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
                {account.customer.phone}
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
      </section>

      <section className="rounded-lg border bg-white">
        <div className="border-b p-5">
          <h2 className="text-base font-semibold text-gray-950">
            Payment History
          </h2>
        </div>

        <table className="w-full text-sm">
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

        {account.payments.length === 0 ? (
          <div className="border-t p-8 text-center text-sm text-gray-600">
            No payments recorded for this account yet.
          </div>
        ) : null}
      </section>
    </div>
  );
}
