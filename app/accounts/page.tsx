import Link from "next/link";
import { AccountStatus, Prisma, UserPermission, UserRole } from "@prisma/client";
import { bulkReassignCustomers } from "@/actions/customers";
import { AccountDaysProgress } from "@/components/account-days-progress";
import { BulkReassignmentForm } from "@/components/bulk-reassignment-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatMoney, getEffectiveAccountStatus } from "@/lib/accounts";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission, isAdminRole } from "@/lib/roles";

type AccountsPageProps = {
  searchParams: Promise<{
    q?: string;
    staffId?: string;
    status?: string;
    productId?: string;
    page?: string;
    error?: string;
    deleted?: string;
    delegated?: string;
  }>;
};

const PAGE_SIZE = 20;

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function buildPageHref(params: URLSearchParams, page: number) {
  const nextParams = new URLSearchParams(params);
  nextParams.set("page", String(page));
  return `/accounts?${nextParams.toString()}`;
}

export default async function AccountsPage({ searchParams }: AccountsPageProps) {
  const params = await searchParams;
  const session = await auth();
  const isStaff = session?.user?.role === UserRole.STAFF;
  const isAdmin = isAdminRole(session?.user?.role);
  const canManageAll = hasPermission(
    session?.user?.role,
    session?.user?.permissions,
    UserPermission.MANAGE_ACCOUNTS
  );

  const query = params.q?.trim() ?? "";
  const selectedStatus = params.status || AccountStatus.ACTIVE;
  const selectedStaffId = params.staffId || "";
  const selectedProductId = params.productId || "";
  const currentPage = Math.max(Number(params.page || "1"), 1);

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

  // Data containers
  let accounts: Array<{
    id: string;
    startDate: Date;
    expectedEndDate: Date;
    targetAmount: number;
    totalPaid: number;
    balance: number;
    dailyAmount: number;
    status: AccountStatus;
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

  try {
    // Fetch accounts first (most important), then supporting data sequentially
    accounts = await prisma.customerAccount.findMany({
      where,
      orderBy: { createdAt: "desc" },
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

  const totalPages = Math.max(Math.ceil(totalAccounts / PAGE_SIZE), 1);
  const urlParams = new URLSearchParams();
  if (query) urlParams.set("q", query);
  if (selectedStaffId) urlParams.set("staffId", selectedStaffId);
  if (selectedStatus) urlParams.set("status", selectedStatus);
  if (selectedProductId) urlParams.set("productId", selectedProductId);

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

      <form className="grid gap-3 rounded-lg border bg-white p-4 md:grid-cols-5">
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
          <option value={AccountStatus.COMPLETED}>Completed</option>
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

        <Button type="submit" variant="outline">
          Filter
        </Button>
      </form>

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

      {isAdmin ? (
        <BulkReassignmentForm
          action={bulkReassignCustomers}
          staff={staff}
          formId="bulk-account-reassignment"
          returnTo="/accounts"
        />
      ) : null}

      <div className="overflow-hidden rounded-lg border bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-100 text-left text-gray-700">
              {isAdmin ? <th className="p-3 font-medium">Select</th> : null}
              <th className="p-3 font-medium">Customer</th>
              <th className="p-3 font-medium">Staff</th>
              <th className="p-3 font-medium">Product</th>
              <th className="p-3 font-medium">Target</th>
              <th className="p-3 font-medium">Paid</th>
              <th className="p-3 font-medium">Balance</th>
              <th className="p-3 font-medium">Daily</th>
              <th className="p-3 font-medium">Paid Progress</th>
              <th className="p-3 font-medium">Status</th>
              <th className="p-3 font-medium">Start</th>
              <th className="p-3 font-medium">Expected End</th>
              <th className="p-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
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
                  <td className="p-3">{formatMoney(account.targetAmount)}</td>
                  <td className="p-3">{formatMoney(account.totalPaid)}</td>
                  <td className="p-3">{formatMoney(account.balance)}</td>
                  <td className="p-3">{formatMoney(account.dailyAmount)}</td>
                  <td className="p-3">
                    <AccountDaysProgress
                      totalPaid={account.totalPaid}
                      dailyAmount={account.dailyAmount}
                      duration={account.product.duration}
                    />
                  </td>
                  <td className="p-3">
                    <Badge
                      variant={status === "OVERDUE" ? "destructive" : "default"}
                    >
                      {status}
                    </Badge>
                  </td>
                  <td className="p-3">{formatDate(account.startDate)}</td>
                  <td className="p-3">{formatDate(account.expectedEndDate)}</td>
                  <td className="p-3 text-right">
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/accounts/${account.id}`}>View</Link>
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {accounts.length === 0 ? (
          <div className="border-t p-8 text-center text-sm text-gray-600">
            No customer accounts found.
          </div>
        ) : null}
      </div>

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