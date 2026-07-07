import Link from "next/link";
import {
  CreditSource,
  CreditStatus,
  UserPermission,
  type Prisma,
} from "@prisma/client";
import { Eye, SearchIcon } from "lucide-react";
import { CustomerCreditRefundForm } from "@/components/customer-credit-refund-form";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/accounts";
import { refreshAccountLifecycleStatuses } from "@/lib/account-lifecycle";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission, isAdminRole } from "@/lib/roles";

export const dynamic = "force-dynamic";
const creditSortOptions = [
  "newest",
  "oldest",
  "amount-high",
  "remaining-high",
  "customer-az",
] as const;
type CreditSort = (typeof creditSortOptions)[number];

function isCreditSort(value: string): value is CreditSort {
  return creditSortOptions.includes(value as CreditSort);
}

function getCreditOrderBy(sort: CreditSort): Prisma.CustomerCreditOrderByWithRelationInput {
  switch (sort) {
    case "oldest":
      return { createdAt: "asc" };
    case "amount-high":
      return { amount: "desc" };
    case "remaining-high":
      return { remainingAmount: "desc" };
    case "customer-az":
      return { customer: { fullName: "asc" } };
    case "newest":
    default:
      return { createdAt: "desc" };
  }
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function sourceLabel(source: CreditSource) {
  if (source === CreditSource.ACCOUNT_CLOSURE_REFUND) {
    return "Closure refund";
  }

  if (source === CreditSource.PAYMENT_OVERPAYMENT) {
    return "Overpayment";
  }

  return "Manual adjustment";
}

export default async function CreditsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const query = await searchParams;
  const session = await auth();
  const canManageCredits =
    isAdminRole(session?.user?.role) ||
    hasPermission(
      session?.user?.role,
      session?.user?.permissions,
      UserPermission.MANAGE_PAYMENTS
    );

  if (!canManageCredits) {
    return (
      <div className="rounded-lg border bg-white p-5">
        <h1 className="text-xl font-semibold text-gray-950">
          Credits and refunds are available to administrators.
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          Use Payments for your assigned customer collection work.
        </p>
      </div>
    );
  }

  await refreshAccountLifecycleStatuses();

  const q = query.q?.trim() ?? "";
  const selectedStatus = query.status?.trim() || CreditStatus.OPEN;
  const selectedSource = query.source?.trim() || "";
  const sortParam = query.sort ?? "";
  const selectedSort: CreditSort = isCreditSort(sortParam)
    ? sortParam
    : "customer-az";
  const filters: Prisma.CustomerCreditWhereInput[] = [];

  if (selectedStatus !== "ALL") {
    filters.push({
      status: selectedStatus as CreditStatus,
    });
  }

  if (selectedSource) {
    filters.push({
      source: selectedSource as CreditSource,
    });
  }

  if (q) {
    filters.push({
      OR: [
        { notes: { contains: q, mode: "insensitive" } },
        { customer: { fullName: { contains: q, mode: "insensitive" } } },
        { customer: { customerId: { contains: q, mode: "insensitive" } } },
        { account: { product: { name: { contains: q, mode: "insensitive" } } } },
        { payment: { receiptNo: { contains: q, mode: "insensitive" } } },
      ],
    });
  }

  const where: Prisma.CustomerCreditWhereInput =
    filters.length > 0 ? { AND: filters } : {};

  const credits = await prisma.customerCredit.findMany({
    where,
    orderBy: getCreditOrderBy(selectedSort),
    include: {
      customer: {
        include: {
          staff: true,
        },
      },
      account: {
        include: {
          product: true,
        },
      },
      payment: true,
    },
  });
  const openSummary = await prisma.customerCredit.aggregate({
    where: {
      status: CreditStatus.OPEN,
    },
    _count: true,
    _sum: {
      remainingAmount: true,
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gray-950">
            Credits & Refunds
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            Review customer overpayment credits and account-closure refunds.
          </p>
        </div>
        <div className="rounded-lg border bg-white px-4 py-3 text-sm">
          <p className="text-gray-500">Open refund liability</p>
          <p className="mt-1 text-xl font-semibold text-gray-950">
            {formatMoney(openSummary._sum.remainingAmount ?? 0)}
          </p>
          <p className="text-xs text-gray-500">
            {openSummary._count} open item(s)
          </p>
        </div>
      </div>

      {query.refunded === "credit" ? (
        <div className="rounded-lg border border-lime-200 bg-lime-50 p-4 text-sm text-lime-900">
          Customer credit marked as refunded.
        </div>
      ) : null}

      {query.error === "credit-not-found" || query.error === "credit-not-open" ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          This credit could not be refunded. It may already be closed.
        </div>
      ) : null}

      {query.error === "admin-password-required" ||
      query.error === "invalid-admin-password" ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          Enter a valid admin password before changing credit records.
        </div>
      ) : null}

      <form className="grid gap-3 rounded-lg border bg-white p-4 md:grid-cols-[minmax(0,1fr)_170px_190px_180px_auto] md:items-end">
        <label className="block space-y-1">
          <span className="text-xs font-medium text-gray-600">Search</span>
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
            <input
              name="q"
              defaultValue={q}
              placeholder="Customer, receipt, product"
              className="w-full rounded border p-3 pl-9 text-sm"
            />
          </div>
        </label>

        <label className="block space-y-1">
          <span className="text-xs font-medium text-gray-600">Status</span>
          <select
            name="status"
            defaultValue={selectedStatus}
            className="w-full rounded border p-3 text-sm"
          >
            <option value="ALL">All statuses</option>
            <option value={CreditStatus.OPEN}>Open</option>
            <option value={CreditStatus.REFUNDED}>Refunded</option>
            <option value={CreditStatus.APPLIED}>Applied</option>
            <option value={CreditStatus.VOID}>Void</option>
          </select>
        </label>

        <label className="block space-y-1">
          <span className="text-xs font-medium text-gray-600">Source</span>
          <select
            name="source"
            defaultValue={selectedSource}
            className="w-full rounded border p-3 text-sm"
          >
            <option value="">All sources</option>
            <option value={CreditSource.PAYMENT_OVERPAYMENT}>Overpayment</option>
            <option value={CreditSource.ACCOUNT_CLOSURE_REFUND}>
              Closure refund
            </option>
            <option value={CreditSource.MANUAL_ADJUSTMENT}>
              Manual adjustment
            </option>
          </select>
        </label>

        <label className="block space-y-1">
          <span className="text-xs font-medium text-gray-600">Sort</span>
          <select
            name="sort"
            defaultValue={selectedSort}
            className="w-full rounded border p-3 text-sm"
          >
            <option value="customer-az">Customer A-Z</option>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="amount-high">Highest amount</option>
            <option value="remaining-high">Highest remaining</option>
          </select>
        </label>

        <div className="flex gap-2">
          <Button type="submit" variant="outline" className="flex-1 md:flex-none">
            Filter
          </Button>
          <Button asChild type="button" variant="outline">
            <Link href="/credits">Clear</Link>
          </Button>
        </div>
      </form>

      <div className="overflow-x-auto rounded-lg border bg-white">
        <table className="w-full min-w-[980px] text-sm">
          <thead>
            <tr className="bg-gray-100 text-left text-gray-700">
              <th className="p-3 font-medium">Date</th>
              <th className="p-3 font-medium">Customer</th>
              <th className="p-3 font-medium">Staff</th>
              <th className="p-3 font-medium">Account</th>
              <th className="p-3 font-medium">Receipt</th>
              <th className="p-3 font-medium">Source</th>
              <th className="p-3 font-medium">Amount</th>
              <th className="p-3 font-medium">Remaining</th>
              <th className="p-3 font-medium">Status</th>
              <th className="p-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {credits.map((credit) => (
              <tr key={credit.id} className="border-t">
                <td className="p-3">{formatDate(credit.createdAt)}</td>
                <td className="p-3">
                  <p className="font-medium text-gray-950">
                    {credit.customer.fullName}
                  </p>
                  <p className="text-xs text-gray-500">
                    {credit.customer.customerId}
                  </p>
                </td>
                <td className="p-3">{credit.customer.staff.code}</td>
                <td className="p-3">
                  {credit.account ? credit.account.product.name : "-"}
                </td>
                <td className="p-3 font-mono text-xs">
                  {credit.payment?.receiptNo ?? "-"}
                </td>
                <td className="p-3">{sourceLabel(credit.source)}</td>
                <td className="p-3 font-semibold text-gray-950">
                  {formatMoney(credit.amount)}
                </td>
                <td className="p-3">{formatMoney(credit.remainingAmount)}</td>
                <td className="p-3">{credit.status}</td>
                <td className="p-3 text-right">
                  <div className="flex items-center justify-end gap-0.5">
                    <Link
                      href={`/customers/${credit.customerId}`}
                      aria-label={`View ${credit.customer.fullName}`}
                      title="View Customer"
                      className="group/view flex size-8 items-center justify-center rounded-md text-gray-400 transition-all duration-150 hover:bg-blue-50 hover:text-blue-700"
                    >
                      <Eye className="size-4 transition-transform duration-200 group-hover/view:scale-125 group-hover/view:-rotate-6" />
                    </Link>
                    {credit.status === CreditStatus.OPEN &&
                    credit.remainingAmount > 0 ? (
                      <CustomerCreditRefundForm
                        creditId={credit.id}
                        amount={credit.remainingAmount}
                        returnTo="/credits"
                      />
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {credits.length === 0 ? (
          <div className="border-t p-8 text-center text-sm text-gray-600">
            No credits or refunds match these filters.
          </div>
        ) : null}
      </div>
    </div>
  );
}
