import Link from "next/link";
import {
  AccountStatus,
  DeliveryStatus,
  Prisma,
  UserPermission,
  UserRole,
} from "@prisma/client";
import { Eye, HandCoins } from "lucide-react";
import { bulkReassignCustomers } from "@/actions/customers";
import { AccountDaysProgress } from "@/components/account-days-progress";
import { BulkReassignmentForm } from "@/components/bulk-reassignment-form";
import { DeliveryStatusIcon } from "@/components/delivery-status-icon";
import { Button } from "@/components/ui/button";
import { formatMoney, getEffectiveAccountStatus } from "@/lib/accounts";
import { refreshAccountLifecycleStatuses } from "@/lib/account-lifecycle";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission, isAdminRole } from "@/lib/roles";

// ============================================================================
// SECTION: Type Definitions
// Defines the shape of search parameters this page accepts
// ============================================================================
type AccountsPageProps = {
  searchParams: Promise<{
    q?: string;
    staffId?: string;
    status?: string;
    productId?: string;
    sort?: string;
    page?: string;
    error?: string;
    deleted?: string;
    delegated?: string;
  }>;
};

// ============================================================================
// SECTION: Constants & Helper Functions
// Pagination size, date formatting, and URL builder for pagination links
// ============================================================================
const PAGE_SIZE = 20;
const accountSortOptions = [
  "newest",
  "oldest",
  "customer-az",
  "product-az",
  "paid-high",
  "balance-high",
  "expected-soon",
] as const;
type AccountSort = (typeof accountSortOptions)[number];

function isAccountSort(value: string): value is AccountSort {
  return accountSortOptions.includes(value as AccountSort);
}

function getAccountOrderBy(sort: AccountSort): Prisma.CustomerAccountOrderByWithRelationInput {
  switch (sort) {
    case "oldest":
      return { createdAt: "asc" };
    case "customer-az":
      return { customer: { fullName: "asc" } };
    case "product-az":
      return { product: { name: "asc" } };
    case "paid-high":
      return { totalPaid: "desc" };
    case "balance-high":
      return { balance: "desc" };
    case "expected-soon":
      return { expectedEndDate: "asc" };
    case "newest":
    default:
      return { createdAt: "desc" };
  }
}

function buildPageHref(params: URLSearchParams, page: number) {
  const nextParams = new URLSearchParams(params);
  nextParams.set("page", String(page));
  return `/accounts?${nextParams.toString()}`;
}

export default async function AccountsPage({ searchParams }: AccountsPageProps) {
  // ==========================================================================
  // SECTION: Authentication & Authorization Setup
  // Determines user role, permissions, and access level
  // ==========================================================================
  const params = await searchParams;
  const session = await auth();
  const isStaff = session?.user?.role === UserRole.STAFF;
  const isAdmin = isAdminRole(session?.user?.role);
  const canManageAll = hasPermission(
    session?.user?.role,
    session?.user?.permissions,
    UserPermission.MANAGE_ACCOUNTS
  );

  // ==========================================================================
  // SECTION: Query Parameter Extraction
  // Pulls filter values from the URL search params
  // ==========================================================================
  const query = params.q?.trim() ?? "";
  const selectedStatus = params.status || AccountStatus.ACTIVE;
  const selectedStaffId = params.staffId || "";
  const selectedProductId = params.productId || "";
  const sortParam = params.sort ?? "";
  const selectedSort: AccountSort = isAccountSort(sortParam)
    ? sortParam
    : "customer-az";
  const currentPage = Math.max(Number(params.page || "1"), 1);

  // ==========================================================================
  // SECTION: Date Setup & Filter Construction
  // Builds the Prisma WHERE clause based on active filters and user permissions
  // ==========================================================================
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const filters: Prisma.CustomerAccountWhereInput[] = [];

  if (isStaff && !canManageAll && session.user.staffId) {
    filters.push({ customer: { staffId: session.user.staffId } });
  } else if (selectedStaffId) {
    filters.push({ customer: { staffId: selectedStaffId } });
  }

  if (selectedProductId) {
    filters.push({ productId: selectedProductId });
  }

  if (query) {
    filters.push({
      OR: [
        { customer: { fullName: { contains: query, mode: "insensitive" } } },
        { customer: { customerId: { contains: query, mode: "insensitive" } } },
        { product: { name: { contains: query, mode: "insensitive" } } },
      ],
    });
  }

  if (selectedStatus === "OVERDUE") {
    filters.push({
      status: AccountStatus.ACTIVE,
      balance: { gt: 0 },
      expectedEndDate: { lt: today },
    });
  } else if (selectedStatus === "ALL") {
    // no filter
  } else if (selectedStatus === AccountStatus.ACTIVE) {
    filters.push({
      status: AccountStatus.ACTIVE,
      balance: { gt: 0 },
      expectedEndDate: { gte: today },
    });
  } else {
    filters.push({ status: selectedStatus as AccountStatus });
  }

  const where: Prisma.CustomerAccountWhereInput =
    filters.length > 0 ? { AND: filters } : {};

  // ==========================================================================
  // SECTION: Data Containers
  // Declares typed variables to hold fetched data
  // ==========================================================================
  let accounts: Array<{
    id: string;
    startDate: Date;
    expectedEndDate: Date;
    targetAmount: number;
    totalPaid: number;
    balance: number;
    dailyAmount: number;
    status: AccountStatus;
    deliveryStatus: DeliveryStatus;
    deliveredAt: Date | null;
    customer: {
      id: string;
      fullName: string;
      customerId: string;
      staff: { code: string };
    };
    product: { name: string; duration: number };
  }> = [];
  let totalAccounts = 0;
  let staff: Array<{ id: string; code: string; fullName: string }> = [];
  let products: Array<{ id: string; name: string }> = [];
  let loadError = false;

  // ==========================================================================
  // SECTION: Database Queries
  // Fetches accounts (paginated), total count, staff list (admin only), and products
  // ==========================================================================
  try {
    await refreshAccountLifecycleStatuses();

    // Fetch accounts first (most important), then supporting data sequentially
    accounts = await prisma.customerAccount.findMany({
      where,
      orderBy: getAccountOrderBy(selectedSort),
      skip: (currentPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        startDate: true,
        expectedEndDate: true,
        targetAmount: true,
        totalPaid: true,
        balance: true,
        dailyAmount: true,
        status: true,
        deliveryStatus: true,
        deliveredAt: true,
        customer: {
          select: {
            id: true,
            fullName: true,
            customerId: true,
            staff: { select: { code: true } },
          },
        },
        product: { select: { name: true, duration: true } },
      },
    });

    totalAccounts = await prisma.customerAccount.count({ where });

    if (isAdmin) {
      staff = await prisma.staff.findMany({
        orderBy: { fullName: "asc" },
        select: { id: true, code: true, fullName: true },
      });
    }

    products = await prisma.product.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    });
  } catch (err) {
    console.error("ACCOUNTS_LOAD_ERROR", err);
    loadError = true;
  }

  // ==========================================================================
  // SECTION: Pagination Calculation & URL Param Preservation
  // Computes total pages and preserves current filters across page navigation
  // ==========================================================================
  const totalPages = Math.max(Math.ceil(totalAccounts / PAGE_SIZE), 1);
  const urlParams = new URLSearchParams();
  if (query) urlParams.set("q", query);
  if (selectedStaffId) urlParams.set("staffId", selectedStaffId);
  if (selectedStatus) urlParams.set("status", selectedStatus);
  if (selectedProductId) urlParams.set("productId", selectedProductId);
  if (selectedSort !== "customer-az") urlParams.set("sort", selectedSort);

  // ==========================================================================
  // SECTION: Error State (Database Unavailable)
  // Returns early if the database query failed
  // ==========================================================================
  if (loadError) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-950">Accounts</h1>
          <p className="mt-1 text-sm text-gray-600">
            Track customer installment accounts separately from customer
            profiles.
          </p>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-center">
          <p className="font-medium text-amber-900">
            Unable to load accounts right now.
          </p>
          <p className="mt-1 text-sm text-amber-700">
            The database is temporarily unavailable. Please{" "}
            <Link href="/accounts" className="underline">
              try again
            </Link>
            .
          </p>
        </div>
      </div>
    );
  }

  // ==========================================================================
  // SECTION: Main UI - Page Header
  // Title, description, and "Create Account" button
  // ==========================================================================
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gray-950">Accounts</h1>
          <p className="mt-1 text-sm text-gray-600">
            Track customer installment accounts separately from customer
            profiles.
          </p>
        </div>
        <Button asChild>
          <Link href="/accounts/new">Create Account</Link>
        </Button>
      </div>

      {/* ==================================================================== */}
      {/* SECTION: Filter Form                                                   */}
      {/* Search input, staff/status/product dropdowns, and filter button        */}
      {/* ==================================================================== */}
      <form className="grid gap-3 rounded-lg border bg-white p-4 md:grid-cols-6">
        <input
          name="q"
          defaultValue={query}
          placeholder="Search customer or product"
          className="rounded border p-3 md:col-span-2"
        />

        {!isStaff ? (
          <select name="staffId" defaultValue={selectedStaffId} className="rounded border p-3">
            <option value="">All staff</option>
            {staff.map((member) => (
              <option key={member.id} value={member.id}>
                {member.code}
              </option>
            ))}
          </select>
        ) : null}

        <select name="status" defaultValue={selectedStatus} className="rounded border p-3">
          <option value="ALL">All statuses</option>
          <option value={AccountStatus.ACTIVE}>Active</option>
          <option value="OVERDUE">Overdue</option>
          <option value={AccountStatus.DORMANT}>Dormant</option>
          <option value={AccountStatus.PROBATION}>Probation</option>
          <option value={AccountStatus.COMPLETED}>Completed</option>
          <option value={AccountStatus.CLOSED}>Closed</option>
          <option value={AccountStatus.ARCHIVED}>Archived</option>
          <option value={AccountStatus.CANCELLED}>Cancelled</option>
          <option value={AccountStatus.SUSPENDED}>Suspended</option>
        </select>

        <select name="productId" defaultValue={selectedProductId} className="rounded border p-3">
          <option value="">All products</option>
          {products.map((product) => (
            <option key={product.id} value={product.id}>
              {product.name}
            </option>
          ))}
        </select>

        <select name="sort" defaultValue={selectedSort} className="rounded border p-3">
          <option value="customer-az">Customer A-Z</option>
          <option value="product-az">Product A-Z</option>
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="paid-high">Highest paid</option>
          <option value="balance-high">Highest balance</option>
          <option value="expected-soon">Expected date soonest</option>
        </select>

        <Button type="submit" variant="outline">
          Filter
        </Button>
      </form>

      {/* ==================================================================== */}
      {/* SECTION: Toast Notifications                                           */}
      {/* Displays success/error messages based on URL params                    */}
      {/* ==================================================================== */}
      {params.error === "account-not-found" ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          Account could not be found.
        </div>
      ) : null}
      {params.deleted === "account" ? (
        <div className="rounded-lg border border-lime-200 bg-lime-50 p-4 text-sm text-lime-900">
          Account and all related payments were permanently deleted.
        </div>
      ) : null}
      {params.delegated ? (
        <div className="rounded-lg border border-lime-200 bg-lime-50 p-4 text-sm text-lime-900">
          Reassigned the customer ownership for {params.delegated} selected
          account record(s).
        </div>
      ) : null}

      {/* ==================================================================== */}
      {/* SECTION: Bulk Reassignment Form (Admin Only)                           */}
      {/* Allows admins to reassign multiple customers to a different staff      */}
      {/* ==================================================================== */}
      {isAdmin ? (
        <BulkReassignmentForm
          action={bulkReassignCustomers}
          staff={staff}
          formId="bulk-account-reassignment"
          returnTo="/accounts"
        />
      ) : null}

      {/* ==================================================================== */}
      {/* SECTION: Accounts Table Container                                      */}
      {/* The main data table showing all filtered accounts                      */}
      {/* ==================================================================== */}
      <div className="overflow-hidden rounded-lg border bg-white">
        <div className="overflow-x-auto">
        <table className="min-w-[920px] text-sm">
          {/* ================================================================== */}
          {/* SECTION: Table Header                                                */}
          {/* Column labels for the accounts table                                 */}
          {/* ================================================================== */}
          <thead>
            <tr className="bg-gray-100 text-left text-gray-700">
              {isAdmin ? <th className="p-3 font-medium">Select</th> : null}
              <th className="p-3 font-medium">Customer</th>
              <th className="p-3 font-medium">Staff</th>
              <th className="p-3 font-medium">Product</th>
              <th className="p-3 font-medium">Paid</th>
              <th className="p-3 font-medium">Balance</th>
              <th className="p-3 font-medium">Delivery</th>
              <th className="p-3 font-medium">Daily</th>
              <th className="p-3 font-medium">Paid Progress</th>
              <th className="p-3 text-right font-medium">Actions</th>
            </tr>
          </thead>

          {/* ================================================================== */}
          {/* SECTION: Table Body - Account Rows                                   */}
          {/* Renders each account as a row with all relevant data                 */}
          {/* ================================================================== */}
          <tbody>
            {accounts.map((account) => {
              const status = getEffectiveAccountStatus(account);
              return (
                <tr key={account.id} className="border-t">
                  {isAdmin ? (
                    <td className="p-3">
                      <input
                        form="bulk-account-reassignment"
                        type="checkbox"
                        name="customerIds"
                        value={account.customer.id}
                        className="size-4"
                        aria-label={`Select ${account.customer.fullName} ${account.product.name}`}
                      />
                    </td>
                  ) : null}
                  <td className="p-3">
                    <div className="font-medium text-gray-950">
                      {account.customer.fullName}
                    </div>
                    <div className="text-xs text-gray-500">
                      {account.customer.customerId}
                    </div>
                  </td>
                  <td className="p-3">{account.customer.staff.code}</td>
                  <td className="p-3">{account.product.name}</td>
                  <td className="p-3">{formatMoney(account.totalPaid)}</td>
                  <td className="p-3">{formatMoney(account.balance)}</td>
                  <td className="p-3">
                    {status === AccountStatus.COMPLETED ? (
                      <DeliveryStatusIcon status={account.deliveryStatus} />
                    ) : (
                      <span className="text-xs text-gray-400">-</span>
                    )}
                  </td>
                  <td className="p-3">{formatMoney(account.dailyAmount)}</td>
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
                        aria-label={`View ${account.customer.fullName} ${account.product.name} account`}
                        title="View"
                        className="group/view flex size-8 items-center justify-center rounded-md text-gray-400 transition-all duration-150 hover:bg-blue-50 hover:text-blue-700"
                      >
                        <Eye className="size-4 transition-transform duration-200 group-hover/view:scale-125 group-hover/view:-rotate-6" />
                      </Link>

                      {account.balance > 0 &&
                      status !== AccountStatus.COMPLETED &&
                      status !== AccountStatus.CANCELLED &&
                      status !== AccountStatus.SUSPENDED &&
                      status !== AccountStatus.CLOSED &&
                      status !== AccountStatus.ARCHIVED ? (
                        <Link
                          href={`/payments/new?customerId=${account.customer.id}&accountId=${account.id}`}
                          aria-label={`Record payment for ${account.customer.fullName}`}
                          title="Record Payment"
                          className="group/pay flex size-8 items-center justify-center rounded-md text-gray-400 transition-all duration-150 hover:bg-lime-50 hover:text-green-700"
                        >
                          <HandCoins className="size-4 transition-transform duration-200 group-hover/pay:scale-125 group-hover/pay:-translate-y-0.5" />
                        </Link>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>

        {/* ================================================================== */}
        {/* SECTION: Empty State                                                 */}
        {/* Shown when no accounts match the current filters                     */}
        {/* ================================================================== */}
        {accounts.length === 0 ? (
          <div className="border-t p-8 text-center text-sm text-gray-600">
            No customer accounts found.
          </div>
        ) : null}
      </div>

      {/* ==================================================================== */}
      {/* SECTION: Pagination Controls                                           */}
      {/* Shows current page info and Previous/Next navigation buttons           */}
      {/* ==================================================================== */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-gray-600">
        <p>
          Showing page {currentPage} of {totalPages} ({totalAccounts} accounts)
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
