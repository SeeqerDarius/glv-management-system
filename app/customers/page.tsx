import Link from "next/link";
import { AccountStatus, Prisma, UserPermission, UserRole } from "@prisma/client";
import { Eye, HandCoins, SearchIcon, Trash2 } from "lucide-react";
import { bulkReassignCustomers, deleteCustomer } from "@/actions/customers";
import { BulkReassignmentForm } from "@/components/bulk-reassignment-form";
import { ConfirmDeleteForm } from "@/components/confirm-delete-form";
import { Button } from "@/components/ui/button";
import { refreshAccountLifecycleStatuses } from "@/lib/account-lifecycle";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { hasPermission, isAdminRole } from "@/lib/roles";

type CustomersPageProps = {
  searchParams: Promise<Record<string, string | undefined>>;
};

const PAGE_SIZE = 25;
const customerSortOptions = [
  "newest",
  "oldest",
  "name-az",
  "name-za",
  "id-az",
] as const;
type CustomerSort = (typeof customerSortOptions)[number];

function isCustomerSort(value: string): value is CustomerSort {
  return customerSortOptions.includes(value as CustomerSort);
}

function getCustomerOrderBy(sort: CustomerSort): Prisma.CustomerOrderByWithRelationInput {
  switch (sort) {
    case "oldest":
      return { createdAt: "asc" };
    case "name-az":
      return { fullName: "asc" };
    case "name-za":
      return { fullName: "desc" };
    case "id-az":
      return { customerId: "asc" };
    case "newest":
    default:
      return { createdAt: "desc" };
  }
}

function buildPageHref(params: URLSearchParams, page: number) {
  const next = new URLSearchParams(params);
  next.set("page", String(page));
  return `/customers?${next.toString()}`;
}

export default async function CustomersPage({ searchParams }: CustomersPageProps) {
  const { error, deleted, delegated, q, page, sort, staffId } =
    await searchParams;
  const session = await auth();
  const isStaff = session?.user?.role === UserRole.STAFF;
  const isAdmin = isAdminRole(session?.user?.role);
  const canManageAll = hasPermission(
    session?.user?.role,
    session?.user?.permissions,
    UserPermission.MANAGE_CUSTOMERS
  );

  const query = q?.trim() ?? "";
  const selectedStaffId = staffId?.trim() ?? "";
  const sortParam = sort ?? "";
  const selectedSort: CustomerSort = isCustomerSort(sortParam)
    ? sortParam
    : "name-az";
  const currentPage = Math.max(Number(page || "1"), 1);

  const staffFilter: Prisma.CustomerWhereInput | undefined =
    isStaff && !canManageAll && session.user.staffId
      ? { staffId: session.user.staffId }
      : selectedStaffId
        ? { staffId: selectedStaffId }
      : undefined;

  const searchFilter: Prisma.CustomerWhereInput | undefined = query
    ? {
        OR: [
          { fullName: { contains: query, mode: "insensitive" } },
          { customerId: { contains: query, mode: "insensitive" } },
          { phone: { contains: query, mode: "insensitive" } },
        ],
      }
    : undefined;

  const andClauses = [staffFilter, searchFilter].filter(
    (f): f is Prisma.CustomerWhereInput => f !== undefined
  );
  const where: Prisma.CustomerWhereInput =
    andClauses.length > 0 ? { AND: andClauses } : {};

  let customers: Array<{
    id: string;
    customerId: string;
    fullName: string;
    phone: string | null;
    staff: { code: string };
    accounts: Array<{ id: string }>;
    _count: { accounts: number };
  }> = [];
  let totalCustomers = 0;
  let staff: Array<{ id: string; code: string; fullName: string }> = [];
  let loadError = false;

  try {
    await refreshAccountLifecycleStatuses();

    // Sequential to avoid exhausting Neon connections
    customers = await prisma.customer.findMany({
      where,
      orderBy: getCustomerOrderBy(selectedSort),
      skip: (currentPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        customerId: true,
        fullName: true,
        phone: true,
        staff: { select: { code: true } },
        accounts: {
          where: {
            balance: { gt: 0 },
            status: {
              notIn: [
                AccountStatus.COMPLETED,
                AccountStatus.CANCELLED,
                AccountStatus.SUSPENDED,
                AccountStatus.CLOSED,
                AccountStatus.ARCHIVED,
              ],
            },
          },
          select: { id: true },
          take: 1,
        },
        _count: { select: { accounts: true } },
      },
    });

    totalCustomers = await prisma.customer.count({ where });

    if (isAdmin) {
      staff = await prisma.staff.findMany({
        where: { active: true },
        orderBy: { fullName: "asc" },
        select: { id: true, code: true, fullName: true },
      });
    }
  } catch (err) {
    console.error("CUSTOMERS_LOAD_ERROR", err);
    loadError = true;
  }

  const totalPages = Math.max(Math.ceil(totalCustomers / PAGE_SIZE), 1);
  const urlParams = new URLSearchParams();
  if (query) urlParams.set("q", query);
  if (selectedStaffId) urlParams.set("staffId", selectedStaffId);
  if (selectedSort !== "name-az") urlParams.set("sort", selectedSort);

  if (loadError) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-950">Customers</h1>
          <p className="mt-1 text-sm text-gray-600">
            View customer profiles and account history.
          </p>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-center">
          <p className="font-medium text-amber-900">
            Unable to load customers right now.
          </p>
          <p className="mt-1 text-sm text-amber-700">
            The database is temporarily unavailable. Please{" "}
            <Link href="/customers" className="underline">
              try again
            </Link>
            .
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gray-950">Customers</h1>
          <p className="mt-1 text-sm text-gray-600">
            View customer profiles and account history.
          </p>
        </div>
        <Button asChild>
          <Link href="/customers/new">Create Customer</Link>
        </Button>
      </div>

      {/* Search */}
      <form className="grid gap-3 rounded-lg border bg-white p-4 md:grid-cols-[minmax(0,1fr)_220px_190px_auto] md:items-end">
        <label className="block space-y-1">
          <span className="text-xs font-medium text-gray-600">Search</span>
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
            <input
              name="q"
              defaultValue={query}
              placeholder="Search name, ID or phone"
              className="w-full rounded border bg-white p-3 pl-9 text-sm"
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
          <span className="text-xs font-medium text-gray-600">Sort</span>
          <select
            name="sort"
            defaultValue={selectedSort}
            className="w-full rounded border p-3 text-sm"
          >
            <option value="name-az">Name A-Z</option>
            <option value="name-za">Name Z-A</option>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="id-az">Customer ID A-Z</option>
          </select>
        </label>

        <div className="flex gap-2">
          <Button type="submit" variant="outline" className="flex-1 md:flex-none">
            Filter
          </Button>
          <Button asChild type="button" variant="outline">
            <Link href="/customers">Clear</Link>
          </Button>
        </div>
      </form>

      {/* Toasts */}
      {error === "delete-confirmation-required" ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          Type DELETE in the confirmation box before deleting customer records.
        </div>
      ) : null}
      {error === "admin-password-required" || error === "invalid-admin-password" ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          Enter a valid admin password before deleting customer records.
        </div>
      ) : null}
      {error === "customer-delete-blocked" ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Customer deletion was blocked by related records. Remove or correct
          the related records first.
        </div>
      ) : null}
      {deleted === "customer" ? (
        <div className="rounded-lg border border-lime-200 bg-lime-50 p-4 text-sm text-lime-900">
          Customer and all related accounts and payments were permanently
          deleted.
        </div>
      ) : null}
      {delegated ? (
        <div className="rounded-lg border border-lime-200 bg-lime-50 p-4 text-sm text-lime-900">
          Reassigned {delegated} selected customer record(s).
        </div>
      ) : null}

      {isAdmin ? (
        <BulkReassignmentForm
          action={bulkReassignCustomers}
          staff={staff}
          formId="bulk-customer-reassignment"
          returnTo="/customers"
        />
      ) : null}

      <div className="overflow-hidden rounded-lg border bg-white">
        <div className="overflow-x-auto">
        <table className="min-w-[860px] text-sm">
          <thead>
            <tr className="bg-gray-100 text-left text-gray-700">
              {isAdmin ? <th className="p-3 font-medium">Select</th> : null}
              <th className="p-3 font-medium">Customer ID</th>
              <th className="p-3 font-medium">Name</th>
              <th className="p-3 font-medium">Phone</th>
              <th className="p-3 font-medium">Staff</th>
              <th className="p-3 font-medium">Accounts</th>
              <th className="p-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((customer) => {
              const canRecordPayment = customer.accounts.length > 0;

              return (
                <tr key={customer.id} className="border-t">
                  {isAdmin ? (
                    <td className="p-3">
                      <input
                        form="bulk-customer-reassignment"
                        type="checkbox"
                        name="customerIds"
                        value={customer.id}
                        className="size-4"
                        aria-label={`Select ${customer.fullName}`}
                      />
                    </td>
                  ) : null}
                  <td className="p-3 font-semibold text-gray-950">
                    {customer.customerId}
                  </td>
                  <td className="p-3">{customer.fullName}</td>
                  <td className="p-3">{customer.phone || "-"}</td>
                  <td className="p-3">{customer.staff.code}</td>
                  <td className="p-3">{customer._count.accounts}</td>
                  <td className="p-3 text-right">
                    <div className="flex items-center justify-end gap-0.5">
                      <Link
                        href={`/customers/${customer.id}`}
                        aria-label={`View ${customer.fullName}`}
                        title="View"
                        className="group/view flex size-8 items-center justify-center rounded-md text-gray-400 transition-all duration-150 hover:bg-blue-50 hover:text-blue-700"
                      >
                        <Eye className="size-4 transition-transform duration-200 group-hover/view:scale-125 group-hover/view:-rotate-6" />
                      </Link>

                      {canRecordPayment ? (
                        <Link
                          href={`/payments/new?customerId=${customer.id}`}
                          aria-label={`Record payment for ${customer.fullName}`}
                          title="Record Payment"
                          className="group/pay flex size-8 items-center justify-center rounded-md text-gray-400 transition-all duration-150 hover:bg-lime-50 hover:text-green-700"
                        >
                          <HandCoins className="size-4 transition-transform duration-200 group-hover/pay:scale-125 group-hover/pay:-translate-y-0.5" />
                        </Link>
                      ) : null}

                      {isAdmin ? (
                        <ConfirmDeleteForm
                          action={deleteCustomer}
                          id={customer.id}
                          title={`Delete ${customer.fullName}?`}
                          description="This permanently deletes the customer, every related account, and all payment records. This cannot be undone."
                          hasLinkedHistory={customer._count.accounts > 0}
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
        </div>

        {customers.length === 0 ? (
          <div className="border-t p-8 text-center text-sm text-gray-600">
            No customers found.
          </div>
        ) : null}
      </div>

      {/* Pagination */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-gray-600">
        <p>
          Showing page {currentPage} of {totalPages} ({totalCustomers}{" "}
          customers)
        </p>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={buildPageHref(urlParams, Math.max(currentPage - 1, 1))}>
              Previous
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
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
    </div>
  );
}
