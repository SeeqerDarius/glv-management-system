import Link from "next/link";
import { UserPermission, UserRole, type Prisma } from "@prisma/client";
import { Eye, Pencil, SearchIcon, Trash2 } from "lucide-react";
import { deletePayment } from "@/actions/payments";
import { ConfirmDeleteForm } from "@/components/confirm-delete-form";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/accounts";
import { refreshAccountLifecycleStatuses } from "@/lib/account-lifecycle";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission, isAdminRole } from "@/lib/roles";
import { getSettings } from "@/lib/settings";

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

type PaymentsPageProps = {
  searchParams: Promise<Record<string, string | undefined>>;
};

const PAGE_SIZE = 50;
const paymentSortOptions = [
  "newest",
  "oldest",
  "amount-high",
  "amount-low",
  "receipt-az",
] as const;
type PaymentSort = (typeof paymentSortOptions)[number];

function isPaymentSort(value: string): value is PaymentSort {
  return paymentSortOptions.includes(value as PaymentSort);
}

function getPaymentOrderBy(sort: PaymentSort): Prisma.PaymentOrderByWithRelationInput {
  switch (sort) {
    case "oldest":
      return { paymentDate: "asc" };
    case "amount-high":
      return { amount: "desc" };
    case "amount-low":
      return { amount: "asc" };
    case "receipt-az":
      return { receiptNo: "asc" };
    case "newest":
    default:
      return { paymentDate: "desc" };
  }
}

function buildPageHref(params: URLSearchParams, page: number) {
  const next = new URLSearchParams(params);
  next.set("page", String(page));
  return `/payments?${next.toString()}`;
}

function parseDateFilter(value?: string) {
  if (!value) return null;

  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function canEditPayment(createdAt: Date, windowHours: number) {
  const elapsedMs = Date.now() - createdAt.getTime();
  return elapsedMs >= 0 && elapsedMs <= windowHours * 60 * 60 * 1000;
}

export default async function PaymentsPage({ searchParams }: PaymentsPageProps) {
  const { error, deleted, from, method, page, q, sort, staffId, to } =
    await searchParams;
  const session = await auth();
  const isStaff = session?.user?.role === UserRole.STAFF;
  const isAdmin = isAdminRole(session?.user?.role);
  const canManageAll = hasPermission(
    session?.user?.role,
    session?.user?.permissions,
    UserPermission.MANAGE_PAYMENTS
  );

  const currentPage = Math.max(Number(page || "1"), 1);
  const query = q?.trim() ?? "";
  const selectedMethod = method?.trim() ?? "";
  const selectedStaffId = staffId?.trim() ?? "";
  const sortParam = sort ?? "";
  const selectedSort: PaymentSort = isPaymentSort(sortParam)
    ? sortParam
    : "newest";
  const fromDate = parseDateFilter(from);
  const toDate = parseDateFilter(to);
  const settings = await getSettings();
  const paymentEditWindowHours = Number(settings.paymentEditWindowHours ?? 3);
  if (toDate) {
    toDate.setHours(23, 59, 59, 999);
  }

  const filters: Prisma.PaymentWhereInput[] = [];

  if (isStaff && !canManageAll && session.user.staffId) {
    filters.push({
      account: {
        customer: {
          staffId: session.user.staffId,
        },
      },
    });
  } else if (selectedStaffId) {
    filters.push({
      account: {
        customer: {
          staffId: selectedStaffId,
        },
      },
    });
  }

  if (query) {
    filters.push({
      OR: [
        { receiptNo: { contains: query, mode: "insensitive" } },
        { method: { contains: query, mode: "insensitive" } },
        {
          account: {
            product: {
              name: { contains: query, mode: "insensitive" },
            },
          },
        },
        {
          account: {
            customer: {
              fullName: { contains: query, mode: "insensitive" },
            },
          },
        },
        {
          account: {
            customer: {
              customerId: { contains: query, mode: "insensitive" },
            },
          },
        },
        {
          account: {
            customer: {
              staff: {
                code: { contains: query, mode: "insensitive" },
              },
            },
          },
        },
        {
          account: {
            customer: {
              staff: {
                fullName: { contains: query, mode: "insensitive" },
              },
            },
          },
        },
      ],
    });
  }

  if (selectedMethod) {
    filters.push({
      method: selectedMethod,
    });
  }

  if (fromDate || toDate) {
    filters.push({
      paymentDate: {
        ...(fromDate ? { gte: fromDate } : {}),
        ...(toDate ? { lte: toDate } : {}),
      },
    });
  }

  const paymentFilter: Prisma.PaymentWhereInput =
    filters.length > 0 ? { AND: filters } : {};

  let payments: Array<{
    id: string;
    receiptNo: string;
    amount: number;
    paymentDate: Date;
    createdAt: Date;
    method: string;
    credit: {
      id: string;
      amount: number;
      remainingAmount: number;
      status: string;
    } | null;
    account: {
      id: string;
      balance: number;
      product: { name: string };
      customer: {
        id: string;
        fullName: string;
        customerId: string;
        staff: { id: string; code: string; fullName: string };
      };
    };
  }> = [];
  let staff: Array<{ id: string; code: string; fullName: string }> = [];
  let totalPayments = 0;
  let loadError = false;

  try {
    await refreshAccountLifecycleStatuses();

    payments = await prisma.payment.findMany({
      where: paymentFilter,
      orderBy: getPaymentOrderBy(selectedSort),
      skip: (currentPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        receiptNo: true,
        amount: true,
        paymentDate: true,
        createdAt: true,
        method: true,
        credit: {
          select: {
            id: true,
            amount: true,
            remainingAmount: true,
            status: true,
          },
        },
        account: {
          select: {
            id: true,
            balance: true,
            product: { select: { name: true } },
            customer: {
              select: {
                id: true,
                fullName: true,
                customerId: true,
                staff: { select: { id: true, code: true, fullName: true } },
              },
            },
          },
        },
      },
    });

    totalPayments = await prisma.payment.count({ where: paymentFilter });

    if (isAdmin) {
      staff = await prisma.staff.findMany({
        where: { active: true },
        orderBy: { fullName: "asc" },
        select: { id: true, code: true, fullName: true },
      });
    }
  } catch (err) {
    console.error("PAYMENTS_LOAD_ERROR", err);
    loadError = true;
  }

  const totalPages = Math.max(Math.ceil(totalPayments / PAGE_SIZE), 1);
  const urlParams = new URLSearchParams();
  if (query) urlParams.set("q", query);
  if (selectedStaffId) urlParams.set("staffId", selectedStaffId);
  if (selectedMethod) urlParams.set("method", selectedMethod);
  if (from) urlParams.set("from", from);
  if (to) urlParams.set("to", to);
  if (selectedSort !== "newest") urlParams.set("sort", selectedSort);

  // Group payments: staff → customer → account
  const groupedPayments = payments.reduce(
    (staffGroups, payment) => {
      const staff = payment.account.customer.staff;
      const customer = payment.account.customer;
      const account = payment.account;

      if (!staffGroups.has(staff.id)) {
        staffGroups.set(staff.id, {
          staff,
          customers: new Map(),
        });
      }
      const staffGroup = staffGroups.get(staff.id)!;

      if (!staffGroup.customers.has(customer.id)) {
        staffGroup.customers.set(customer.id, {
          customer,
          accounts: new Map(),
        });
      }
      const customerGroup = staffGroup.customers.get(customer.id)!;

      if (!customerGroup.accounts.has(account.id)) {
        customerGroup.accounts.set(account.id, { account, payments: [] });
      }
      customerGroup.accounts.get(account.id)!.payments.push(payment);

      return staffGroups;
    },
    new Map<
      string,
      {
        staff: (typeof payments)[number]["account"]["customer"]["staff"];
        customers: Map<
          string,
          {
            customer: (typeof payments)[number]["account"]["customer"];
            accounts: Map<
              string,
              {
                account: (typeof payments)[number]["account"];
                payments: typeof payments;
              }
            >;
          }
        >;
      }
    >()
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-950">Payments</h1>
          <p className="mt-1 text-sm text-gray-600">
            View recorded installment payments and receipts.
          </p>
        </div>
        <Button asChild className="w-full sm:w-auto">
          <Link href="/payments/new">Record Payment</Link>
        </Button>
      </div>

      {/* Toasts */}
      {error === "payment-not-found" ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          Payment record could not be found.
        </div>
      ) : null}
      {error === "payment-delete-blocked" ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Payment deletion was blocked by related records. Review the account
          and try again.
        </div>
      ) : null}
      {error === "delete-confirmation-required" ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          Type DELETE in the confirmation box before deleting payment records.
        </div>
      ) : null}
      {error === "admin-password-required" || error === "invalid-admin-password" ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          Enter a valid admin password before deleting payment records.
        </div>
      ) : null}
      {deleted === "payment" ? (
        <div className="rounded-lg border border-lime-200 bg-lime-50 p-4 text-sm text-lime-900">
          Payment record deleted and account balance recalculated.
        </div>
      ) : null}

      <form className="grid gap-3 rounded-lg border bg-white p-4 md:grid-cols-[minmax(0,1fr)_160px_160px_150px_150px_170px_auto] md:items-end">
        <label className="block space-y-1">
          <span className="text-xs font-medium text-gray-600">Search</span>
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
            <input
              name="q"
              defaultValue={query}
              placeholder="Receipt, customer, staff code, product"
              className="w-full rounded border p-3 pl-9 text-sm"
            />
          </div>
        </label>

        {isAdmin ? (
          <label className="block space-y-1">
            <span className="text-xs font-medium text-gray-600">Staff</span>
            <select
              name="staffId"
              defaultValue={selectedStaffId}
              className="w-full rounded border p-3 text-sm"
            >
              <option value="">All staff</option>
              {staff.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.code} - {member.fullName}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <label className="block space-y-1">
          <span className="text-xs font-medium text-gray-600">Method</span>
          <select
            name="method"
            defaultValue={selectedMethod}
            className="w-full rounded border p-3 text-sm"
          >
            <option value="">All methods</option>
            <option value="Cash">Cash</option>
            <option value="Mobile Money">Mobile Money</option>
            <option value="Bank Transfer">Bank Transfer</option>
            <option value="Cheque">Cheque</option>
          </select>
        </label>

        <label className="block space-y-1">
          <span className="text-xs font-medium text-gray-600">From</span>
          <input
            name="from"
            type="date"
            defaultValue={from ?? ""}
            className="w-full rounded border p-3 text-sm"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-xs font-medium text-gray-600">To</span>
          <input
            name="to"
            type="date"
            defaultValue={to ?? ""}
            className="w-full rounded border p-3 text-sm"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-xs font-medium text-gray-600">Sort</span>
          <select
            name="sort"
            defaultValue={selectedSort}
            className="w-full rounded border p-3 text-sm"
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="amount-high">Highest amount</option>
            <option value="amount-low">Lowest amount</option>
            <option value="receipt-az">Receipt A-Z</option>
          </select>
        </label>

        <div className="flex gap-2">
          <Button type="submit" className="flex-1 md:flex-none">
            Filter
          </Button>
          <Button asChild type="button" variant="outline">
            <Link href="/payments">Clear</Link>
          </Button>
        </div>
      </form>

      {loadError ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-center">
          <p className="font-medium text-amber-900">
            Unable to load payments right now.
          </p>
          <p className="mt-1 text-sm text-amber-700">
            The database is temporarily unavailable. Please{" "}
            <Link href="/payments" className="underline">
              try again
            </Link>
            .
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {Array.from(groupedPayments.values()).map((staffGroup) => (
            <section
              key={staffGroup.staff.id}
              className="rounded-lg border bg-white"
            >
              <div className="border-b bg-lime-50 p-4">
                <h2 className="text-lg font-semibold text-gray-950">
                  Staff Code: {staffGroup.staff.code}
                </h2>
                <p className="text-sm text-gray-600">
                  {staffGroup.staff.fullName}
                </p>
              </div>

              <div className="space-y-4 p-3 sm:p-4">
                {Array.from(staffGroup.customers.values()).map(
                  (customerGroup) => (
                    <div
                      key={customerGroup.customer.id}
                      className="rounded-md border border-gray-200"
                    >
                      <div className="border-b bg-gray-50 p-3">
                        <div className="font-semibold text-gray-950">
                          {customerGroup.customer.fullName}
                        </div>
                        <div className="text-xs text-gray-500">
                          {customerGroup.customer.customerId}
                        </div>
                      </div>

                      <div className="space-y-3 p-3">
                        {Array.from(customerGroup.accounts.values()).map(
                          (accountGroup) => (
                            <div
                              key={accountGroup.account.id}
                              className="rounded border"
                            >
                              <div className="flex flex-col gap-3 border-b p-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                                <div>
                                  <div className="font-medium text-gray-950">
                                    {accountGroup.account.product.name}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    Balance{" "}
                                    {formatMoney(accountGroup.account.balance)}
                                  </div>
                                </div>
                                <Link
                                  href={`/accounts/${accountGroup.account.id}`}
                                  aria-label={`View ${accountGroup.account.product.name} account`}
                                  title="View Account"
                                  className="group/view flex size-8 items-center justify-center rounded-md text-gray-400 transition-all duration-150 hover:bg-blue-50 hover:text-blue-700"
                                >
                                  <Eye className="size-4 transition-transform duration-200 group-hover/view:scale-125 group-hover/view:-rotate-6" />
                                </Link>
                              </div>

                              <div className="overflow-x-auto">
                                <table className="w-full min-w-[620px] text-sm">
                                  <thead>
                                    <tr className="bg-gray-100 text-left text-gray-700">
                                      <th className="p-3 font-medium">Receipt</th>
                                      <th className="p-3 font-medium">Date</th>
                                      <th className="p-3 font-medium">Amount</th>
                                      <th className="p-3 font-medium">Credit</th>
                                      <th className="p-3 font-medium">Method</th>
                                      <th className="p-3 text-right font-medium">
                                        Actions
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {accountGroup.payments.map((payment) => {
                                      const canEdit = canEditPayment(
                                        payment.createdAt,
                                        paymentEditWindowHours
                                      );

                                      return (
                                        <tr key={payment.id} className="border-t">
                                          <td className="p-3 font-semibold text-gray-950">
                                            {payment.receiptNo}
                                          </td>
                                          <td className="p-3">
                                            {formatDate(payment.paymentDate)}
                                          </td>
                                          <td className="p-3">
                                            {formatMoney(payment.amount)}
                                          </td>
                                          <td className="p-3">
                                            {payment.credit ? (
                                              <span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-800">
                                                {formatMoney(payment.credit.amount)}{" "}
                                                {payment.credit.status.toLowerCase()}
                                              </span>
                                            ) : (
                                              <span className="text-xs text-gray-400">-</span>
                                            )}
                                          </td>
                                          <td className="p-3">{payment.method}</td>
                                          <td className="p-3 text-right">
                                            <div className="flex justify-end gap-1">
                                              {canEdit ? (
                                                <Link
                                                  href={`/payments/${payment.id}/edit`}
                                                  aria-label={`Edit receipt ${payment.receiptNo}`}
                                                  title="Edit Payment"
                                                  className="group/edit flex size-8 items-center justify-center rounded-md text-gray-400 transition-all duration-150 hover:bg-lime-50 hover:text-green-700"
                                                >
                                                  <Pencil className="size-4 transition-transform duration-200 group-hover/edit:scale-125 group-hover/edit:rotate-12" />
                                                </Link>
                                              ) : null}
                                              {isAdmin ? (
                                                <ConfirmDeleteForm
                                                  action={deletePayment}
                                                  id={payment.id}
                                                  title={`Delete receipt ${payment.receiptNo}?`}
                                                  description="This permanently deletes the payment and recalculates the account total paid, balance, and status. This cannot be undone."
                                                  triggerClassName="group/del flex size-8 items-center justify-center rounded-md text-gray-400 transition-all duration-150 hover:bg-red-50 hover:text-red-600"
                                                >
                                                  <Trash2 className="size-4 transition-transform duration-200 group-hover/del:scale-125 group-hover/del:-translate-y-0.5" />
                                                </ConfirmDeleteForm>
                                              ) : null}
                                              {!canEdit && !isAdmin ? (
                                                <span className="text-xs text-gray-400">-</span>
                                              ) : null}
                                            </div>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  )
                )}
              </div>
            </section>
          ))}

          {payments.length === 0 && !loadError ? (
            <div className="rounded-lg border bg-white p-8 text-center text-sm text-gray-600">
              No payments recorded yet.
            </div>
          ) : null}
        </div>
      )}

      {/* Pagination */}
      {!loadError && (
        <div className="flex flex-col gap-3 text-sm text-gray-600 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <p>
            Showing page {currentPage} of {totalPages} ({totalPayments}{" "}
            payments)
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button asChild variant="outline" size="sm" className="w-full sm:w-auto">
              <Link
                href={buildPageHref(urlParams, Math.max(currentPage - 1, 1))}
              >
                Previous
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="w-full sm:w-auto">
              <Link
                href={buildPageHref(
                  urlParams,
                  Math.min(currentPage + 1, totalPages)
                )}
              >
                Next
              </Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
