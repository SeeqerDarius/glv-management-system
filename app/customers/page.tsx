import Link from "next/link";
import { Prisma, UserPermission, UserRole } from "@prisma/client";
import { bulkReassignCustomers, deleteCustomer } from "@/actions/customers";
import { BulkReassignmentForm } from "@/components/bulk-reassignment-form";
import { ConfirmDeleteForm } from "@/components/confirm-delete-form";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { hasPermission, isAdminRole } from "@/lib/roles";

type CustomersPageProps = {
  searchParams: Promise<Record<string, string | undefined>>;
};

const PAGE_SIZE = 25;

function buildPageHref(params: URLSearchParams, page: number) {
  const next = new URLSearchParams(params);
  next.set("page", String(page));
  return `/customers?${next.toString()}`;
}

export default async function CustomersPage({ searchParams }: CustomersPageProps) {
  const { error, deleted, delegated, q, page } = await searchParams;
  const session = await auth();
  const isStaff = session?.user?.role === UserRole.STAFF;
  const isAdmin = isAdminRole(session?.user?.role);
  const canManageAll = hasPermission(
    session?.user?.role,
    session?.user?.permissions,
    UserPermission.MANAGE_CUSTOMERS
  );

  const query = q?.trim() ?? "";
  const currentPage = Math.max(Number(page || "1"), 1);

  const staffFilter: Prisma.CustomerWhereInput | undefined =
    isStaff && !canManageAll && session.user.staffId
      ? { staffId: session.user.staffId }
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
    phone: string;
    staff: { code: string };
    _count: { accounts: number };
  }> = [];
  let totalCustomers = 0;
  let staff: Array<{ id: string; code: string; fullName: string }> = [];
  let loadError = false;

  try {
    // Sequential to avoid exhausting Neon connections
    customers = await prisma.customer.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (currentPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        customerId: true,
        fullName: true,
        phone: true,
        staff: { select: { code: true } },
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
      <form className="flex max-w-md gap-2">
        <input
          name="q"
          defaultValue={query}
          placeholder="Search name, ID or phone"
          className="flex-1 rounded border bg-white p-3"
        />
        <Button type="submit" variant="outline">
          Search
        </Button>
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
        <table className="w-full text-sm">
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
            {customers.map((customer) => (
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
                <td className="p-3">{customer.phone}</td>
                <td className="p-3">{customer.staff.code}</td>
                <td className="p-3">{customer._count.accounts}</td>
                <td className="p-3 text-right">
                  <div className="flex justify-end gap-2">
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/customers/${customer.id}`}>View</Link>
                    </Button>
                    {isAdmin ? (
                      <ConfirmDeleteForm
                        action={deleteCustomer}
                        id={customer.id}
                        title={`Delete ${customer.fullName}?`}
                        description="This permanently deletes the customer, every related account, and all payment records. This cannot be undone."
                        hasLinkedHistory={customer._count.accounts > 0}
                      >
                        Delete
                      </ConfirmDeleteForm>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

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