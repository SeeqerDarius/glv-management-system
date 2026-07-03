import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AccountStatus,
  DeliveryStatus,
  UserPermission,
  UserRole,
} from "@prisma/client";
import { Eye, HandCoins, PackageCheck, Trash2 } from "lucide-react";
import { deleteAccount, updateAccountDeliveryStatus } from "@/actions/accounts";
import { AccountDaysProgress } from "@/components/account-days-progress";
import { AccountPriceOverrideForm } from "@/components/account-price-override-form";
import { ConfirmDeleteForm } from "@/components/confirm-delete-form";
import { DeliveryStatusIcon } from "@/components/delivery-status-icon";
import { Button } from "@/components/ui/button";
import { formatMoney, getEffectiveAccountStatus } from "@/lib/accounts";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission, isAdminRole } from "@/lib/roles";

type CustomerProfilePageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<Record<string, string | undefined>>;
};

export default async function CustomerProfilePage({
  params,
  searchParams,
}: CustomerProfilePageProps) {
  const { id } = await params;
  const { deleted, error, updated } = await searchParams;
  const session = await auth();
  const isStaff = session?.user?.role === UserRole.STAFF;
  const isAdmin = isAdminRole(session?.user?.role);
  const canManageAll = hasPermission(
    session?.user?.role,
    session?.user?.permissions,
    UserPermission.MANAGE_CUSTOMERS,
  );

  const customer = await prisma.customer.findFirst({
    where: {
      id,
      ...(isStaff && !canManageAll && session.user.staffId
        ? {
            staffId: session.user.staffId,
          }
        : {}),
    },
    include: {
      staff: true,
      accounts: {
        orderBy: {
          createdAt: "desc",
        },
        include: {
          product: true,
          payments: {
            select: {
              id: true,
            },
          },
        },
      },
    },
  });

  if (!customer) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gray-950">
            {customer.fullName}
          </h1>
          <p className="mt-1 text-sm text-gray-600">{customer.customerId}</p>
        </div>

        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/customers">Back</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/accounts/new?customerId=${customer.id}`}>
              New Account
            </Link>
          </Button>
          <Button asChild>
            <Link href={`/customers/${customer.id}/edit`}>Edit</Link>
          </Button>
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border bg-white p-5">
          <h2 className="text-base font-semibold text-gray-950">Profile</h2>
          <dl className="mt-4 grid gap-3 text-sm">
            <div>
              <dt className="text-gray-500">Phone</dt>
              <dd className="font-medium text-gray-950">
                {customer.phone || "-"}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500">Address</dt>
              <dd className="font-medium text-gray-950">
                {customer.address || "-"}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500">National ID</dt>
              <dd className="font-medium text-gray-950">
                {customer.nationalId || "-"}
              </dd>
            </div>
          </dl>
        </div>

        <div className="rounded-lg border bg-white p-5">
          <h2 className="text-base font-semibold text-gray-950">Assigned Staff</h2>
          <dl className="mt-4 grid gap-3 text-sm">
            <div>
              <dt className="text-gray-500">Name</dt>
              <dd className="font-medium text-gray-950">
                {customer.staff.fullName}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500">Code</dt>
              <dd className="font-medium text-gray-950">{customer.staff.code}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Phone</dt>
              <dd className="font-medium text-gray-950">
                {customer.staff.phone || "-"}
              </dd>
            </div>
          </dl>
        </div>
      </section>

      {deleted === "account" ? (
        <div className="rounded-lg border border-lime-200 bg-lime-50 p-4 text-sm text-lime-900">
          Account and related payments were deleted.
        </div>
      ) : null}

      {updated === "account-price" ? (
        <div className="rounded-lg border border-lime-200 bg-lime-50 p-4 text-sm text-lime-900">
          Account price updated for this customer only.
        </div>
      ) : null}

      {error === "account-delete-blocked" ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          This account could not be deleted. Review its related records and try
          again.
        </div>
      ) : null}

      {error === "invalid-account-price" ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          Enter a valid account price greater than zero.
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

      <section className="rounded-lg border bg-white">
        <div className="border-b p-5">
          <h2 className="text-base font-semibold text-gray-950">
            Account History
          </h2>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-100 text-left text-gray-700">
              <th className="p-3 font-medium">Product</th>
              <th className="p-3 font-medium">Target</th>
              <th className="p-3 font-medium">Paid</th>
              <th className="p-3 font-medium">Balance</th>
              <th className="p-3 font-medium">Status</th>
              <th className="p-3 font-medium">Delivery</th>
              <th className="p-3 font-medium">Paid Progress</th>
              <th className="p-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {customer.accounts.map((account) => {
              const status = getEffectiveAccountStatus(account);
              const canRecordPayment =
                account.balance > 0 &&
                status !== AccountStatus.COMPLETED &&
                status !== AccountStatus.CANCELLED &&
                status !== AccountStatus.SUSPENDED;
              const canMarkDelivered =
                status === AccountStatus.COMPLETED &&
                account.balance <= 0 &&
                account.deliveryStatus === DeliveryStatus.PENDING;

              return (
                <tr key={account.id} className="border-t">
                  <td className="p-3">{account.product.name}</td>
                  <td className="p-3">{formatMoney(account.targetAmount)}</td>
                  <td className="p-3">{formatMoney(account.totalPaid)}</td>
                  <td className="p-3">{formatMoney(account.balance)}</td>
                  <td className="p-3">{status}</td>
                  <td className="p-3">
                    {status === AccountStatus.COMPLETED ? (
                      <DeliveryStatusIcon status={account.deliveryStatus} />
                    ) : (
                      <span className="text-xs text-gray-400">-</span>
                    )}
                  </td>
                  <td className="p-3">
                    <AccountDaysProgress
                      totalPaid={account.totalPaid}
                      dailyAmount={account.dailyAmount}
                      duration={account.product.duration}
                    />
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex items-center justify-end gap-0.5">
                      <Link
                        href={`/accounts/${account.id}`}
                        aria-label={`View ${account.product.name} account`}
                        title="View"
                        className="group/view flex size-8 items-center justify-center rounded-md text-gray-400 transition-all duration-150 hover:bg-blue-50 hover:text-blue-700"
                      >
                        <Eye className="size-4 transition-transform duration-200 group-hover/view:scale-125 group-hover/view:-rotate-6" />
                      </Link>
                      {canRecordPayment ? (
                        <Link
                          href={`/payments/new?customerId=${customer.id}&accountId=${account.id}`}
                          aria-label={`Record payment for ${account.product.name}`}
                          title="Record Payment"
                          className="group/pay flex size-8 items-center justify-center rounded-md text-gray-400 transition-all duration-150 hover:bg-lime-50 hover:text-green-700"
                        >
                          <HandCoins className="size-4 transition-transform duration-200 group-hover/pay:scale-125 group-hover/pay:-translate-y-0.5" />
                        </Link>
                      ) : null}
                      {canMarkDelivered ? (
                        <form action={updateAccountDeliveryStatus}>
                          <input type="hidden" name="id" value={account.id} />
                          <input
                            type="hidden"
                            name="deliveryStatus"
                            value={DeliveryStatus.DELIVERED}
                          />
                          <button
                            type="submit"
                            aria-label={`Mark ${account.product.name} as delivered`}
                            title="Mark delivered"
                            className="group/delivered flex size-8 items-center justify-center rounded-md text-gray-400 transition-all duration-150 hover:bg-green-50 hover:text-green-700"
                          >
                            <PackageCheck className="size-4 transition-transform duration-200 group-hover/delivered:scale-125 group-hover/delivered:-translate-y-0.5" />
                          </button>
                        </form>
                      ) : null}
                      {isAdmin ? (
                        <AccountPriceOverrideForm
                          accountId={account.id}
                          productName={account.product.name}
                          currentPrice={account.targetAmount}
                          returnTo={`/customers/${customer.id}`}
                        />
                      ) : null}
                      {isAdmin ? (
                        <ConfirmDeleteForm
                          action={deleteAccount}
                          id={account.id}
                          title={`Delete ${account.product.name} account?`}
                          description="This permanently deletes the account and every related payment record. This cannot be undone."
                          hasLinkedHistory={account.payments.length > 0}
                          hiddenFields={{ returnTo: `/customers/${customer.id}` }}
                          triggerClassName="group/del flex size-8 items-center justify-center rounded-md text-gray-400 transition-all duration-150 hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 className="size-4 transition-transform duration-200 group-hover/del:scale-125 group-hover/del:-translate-y-0.5" />
                        </ConfirmDeleteForm>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {customer.accounts.length === 0 ? (
          <div className="border-t p-8 text-center text-sm text-gray-600">
            No accounts created for this customer yet.
          </div>
        ) : null}
      </section>
    </div>
  );
}
