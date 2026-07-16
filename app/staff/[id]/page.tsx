import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  Eye,
  Mail,
  Pencil,
  Phone,
  Package,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import { updateStaffInventory } from "@/actions/staff-inventory";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProfileAvatar } from "@/components/profile-avatar";
import { formatMoney } from "@/lib/accounts";
import { auth } from "@/lib/auth";
import { permissionLabels } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { isAdminRole, isSuperAdminRole } from "@/lib/roles";
import { ensureStaffInventorySchema } from "@/lib/staff-inventory-schema";

type StaffDetailsPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    inventory?: string;
  }>;
};

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default async function StaffDetailsPage({
  params,
  searchParams,
}: StaffDetailsPageProps) {
  const { id } = await params;
  const { inventory } = await searchParams;
  const session = await auth();
  await ensureStaffInventorySchema();

  const canManageStaff = isSuperAdminRole(session?.user?.role);
  const canManageInventory = isAdminRole(session?.user?.role);
  const staff = await prisma.staff.findUnique({
    where: {
      id,
    },
    include: {
      user: true,
      customers: {
        orderBy: {
          createdAt: "desc",
        },
        take: 8,
        include: {
          _count: {
            select: {
              accounts: true,
            },
          },
        },
      },
      salaryPayments: {
        orderBy: {
          paymentDate: "desc",
        },
        take: 8,
      },
      inventory: {
        include: {
          product: true,
        },
        orderBy: {
          product: {
            name: "asc",
          },
        },
      },
      _count: {
        select: {
          customers: true,
          salaryPayments: true,
        },
      },
    },
  });

  if (!staff) {
    notFound();
  }

  const permissions = staff.user?.permissions ?? [];
  const products = canManageInventory
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
        },
      })
    : [];
  const inventoryByProductId = new Map(
    staff.inventory.map((item) => [item.productId, item]),
  );
  const salaryPaid = staff.salaryPayments.reduce(
    (total, payment) => total + payment.amount,
    0,
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <Link
            href="/staff"
            aria-label="Back to staff"
            title="Back"
            className="group/back mt-1 flex size-8 items-center justify-center rounded-md text-gray-400 transition-all duration-150 hover:bg-gray-100 hover:text-gray-700"
          >
            <ArrowLeft className="size-4 transition-transform duration-200 group-hover/back:scale-125 group-hover/back:-translate-x-0.5" />
          </Link>
          <ProfileAvatar
            name={staff.fullName}
            src={staff.user?.profileImageUrl}
            className="size-16 text-xl sm:size-18"
          />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="break-words text-2xl font-bold text-gray-950 sm:text-3xl">
                {staff.fullName}
              </h1>
              <Badge variant={staff.active ? "default" : "secondary"}>
                {staff.active ? "Active" : "Inactive"}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-gray-600">
              Staff code {staff.code}
            </p>
            {staff.position ? (
              <p className="mt-2 inline-flex rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                {staff.position}
              </p>
            ) : null}
          </div>
        </div>

        {canManageStaff ? (
        <div className="flex flex-wrap items-center gap-0.5">
          <Link
            href={`/staff/${staff.id}/edit`}
            aria-label={`Edit ${staff.fullName}`}
            title="Edit"
            className="group/edit flex size-8 items-center justify-center rounded-md text-gray-400 transition-all duration-150 hover:bg-lime-50 hover:text-green-700"
          >
            <Pencil className="size-4 transition-transform duration-200 group-hover/edit:scale-125 group-hover/edit:rotate-12" />
          </Link>
        </div>
        ) : null}
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg border bg-white p-5">
          <p className="flex items-center gap-2 text-sm text-gray-500">
            <UserCheck className="size-4" />
            Assigned Customers
          </p>
          <p className="mt-2 text-2xl font-semibold text-gray-950">
            {staff._count.customers}
          </p>
        </div>
        <div className="rounded-lg border bg-white p-5">
          <p className="flex items-center gap-2 text-sm text-gray-500">
            <ShieldCheck className="size-4" />
            Login
          </p>
          <p className="mt-2 text-2xl font-semibold text-gray-950">
            {staff.user ? "Created" : "Missing"}
          </p>
          <p className="mt-1 text-xs text-gray-500">
            {staff.user?.mustChangePassword
              ? "Password change required"
              : "Password is current"}
          </p>
        </div>
        {canManageStaff ? (
        <div className="rounded-lg border bg-white p-5">
          <p className="text-sm text-gray-500">Monthly Salary</p>
          <p className="mt-2 text-2xl font-semibold text-gray-950">
            {formatMoney(staff.monthlySalary)}
          </p>
        </div>
        ) : null}
        {canManageStaff ? (
        <div className="rounded-lg border bg-white p-5">
          <p className="text-sm text-gray-500">Recent Salary Paid</p>
          <p className="mt-2 text-2xl font-semibold text-gray-950">
            {formatMoney(salaryPaid)}
          </p>
          <p className="mt-1 text-xs text-gray-500">
            Last {staff.salaryPayments.length} payment
            {staff.salaryPayments.length === 1 ? "" : "s"}
          </p>
        </div>
        ) : null}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border bg-white p-5">
          <h2 className="text-base font-semibold text-gray-950">Profile</h2>
          <dl className="mt-4 grid gap-3 text-sm">
            <div>
              <dt className="text-gray-500">Position / Rank</dt>
              <dd className="mt-1 font-medium text-gray-950">
                {staff.position || "-"}
              </dd>
            </div>
            <div>
              <dt className="flex items-center gap-2 text-gray-500">
                <Mail className="size-4" />
                Email
              </dt>
              <dd className="mt-1 font-medium text-gray-950">{staff.email}</dd>
            </div>
            <div>
              <dt className="flex items-center gap-2 text-gray-500">
                <Phone className="size-4" />
                Phone
              </dt>
              <dd className="mt-1 font-medium text-gray-950">
                {staff.phone || "-"}
              </dd>
            </div>
            <div>
              <dt className="flex items-center gap-2 text-gray-500">
                <CalendarDays className="size-4" />
                Added
              </dt>
              <dd className="mt-1 font-medium text-gray-950">
                {formatDate(staff.createdAt)}
              </dd>
            </div>
          </dl>
        </div>

        <div className="rounded-lg border bg-white p-5">
          <h2 className="text-base font-semibold text-gray-950">
            Access & Presence
          </h2>
          <dl className="mt-4 grid gap-3 text-sm">
            <div>
              <dt className="text-gray-500">Last Seen</dt>
              <dd className="font-medium text-gray-950">
                {staff.user?.lastSeenAt
                  ? formatDateTime(staff.user.lastSeenAt)
                  : "-"}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500">Current Presence</dt>
              <dd className="font-medium text-gray-950">
                {staff.user?.online ? "Online" : "Offline"}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500">Assistant Admin Privileges</dt>
              <dd className="mt-2 flex flex-wrap gap-2">
                {permissions.length ? (
                  permissions.map((permission) => (
                    <span
                      key={permission}
                      className="rounded-full bg-lime-50 px-2.5 py-1 text-xs font-medium text-green-700"
                    >
                      {permissionLabels[permission]}
                    </span>
                  ))
                ) : (
                  <span className="text-gray-950">None</span>
                )}
              </dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="rounded-lg border bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b p-5">
          <div>
            <h2 className="text-base font-semibold text-gray-950">
              Staff Inventory
            </h2>
            <p className="mt-1 text-xs text-gray-500">
              Product stock allocated to this staff member. Creating a customer
              account consumes one unit from this inventory.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
            <Package className="size-3.5" />
            {staff.inventory.reduce((total, item) => total + item.quantity, 0)}{" "}
            total units
          </div>
        </div>

        {inventory === "updated" ? (
          <div className="border-b border-lime-200 bg-lime-50 px-5 py-3 text-sm text-lime-900">
            Staff inventory updated.
          </div>
        ) : null}
        {inventory === "negative" ? (
          <div className="border-b border-red-200 bg-red-50 px-5 py-3 text-sm text-red-800">
            Inventory cannot be reduced below zero.
          </div>
        ) : null}
        {inventory === "invalid" || inventory === "error" || inventory === "not-found" ? (
          <div className="border-b border-red-200 bg-red-50 px-5 py-3 text-sm text-red-800">
            Inventory update failed. Check the product and quantity.
          </div>
        ) : null}

        <div className="overflow-x-auto">
          <table className="min-w-[720px] text-sm">
            <thead>
              <tr className="bg-gray-100 text-left text-gray-700">
                <th className="p-3 font-medium">Product</th>
                <th className="p-3 font-medium">Category</th>
                <th className="p-3 text-right font-medium">Current Stock</th>
                {canManageInventory ? (
                  <th className="p-3 text-right font-medium">Restock / Adjust</th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {(canManageInventory ? products : staff.inventory.map((item) => item.product)).map((product) => {
                const inventoryItem = inventoryByProductId.get(product.id);
                const quantity = inventoryItem?.quantity ?? 0;

                return (
                  <tr key={product.id} className="border-t">
                    <td className="p-3 font-semibold text-gray-950">
                      {product.name}
                    </td>
                    <td className="p-3 text-gray-700">{product.category}</td>
                    <td className="p-3 text-right">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                          quantity > 0
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {quantity}
                      </span>
                    </td>
                    {canManageInventory ? (
                      <td className="p-3">
                        <form
                          action={updateStaffInventory}
                          className="ml-auto grid max-w-xs grid-cols-[1fr_auto] gap-2"
                        >
                          <input type="hidden" name="staffId" value={staff.id} />
                          <input type="hidden" name="productId" value={product.id} />
                          <input
                            type="hidden"
                            name="returnTo"
                            value={`/staff/${staff.id}`}
                          />
                          <input
                            name="quantity"
                            type="number"
                            step="1"
                            placeholder="+5 or -1"
                            className="w-full rounded border px-3 py-2 text-right"
                            required
                          />
                          <Button type="submit" size="sm">
                            Save
                          </Button>
                        </form>
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!canManageInventory && staff.inventory.length === 0 ? (
            <div className="border-t p-8 text-center text-sm text-gray-600">
              No stock has been allocated to this staff member yet.
            </div>
          ) : null}
        </div>
      </section>

      {canManageStaff ? (
      <section className="rounded-lg border bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b p-5">
          <div>
            <h2 className="text-base font-semibold text-gray-950">
              Assigned Customers
            </h2>
            <p className="mt-1 text-xs text-gray-500">
              Showing latest {staff.customers.length} of {staff._count.customers}
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href={`/customers?staffId=${staff.id}`}>Open Customers</Link>
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[680px] text-sm">
            <thead>
              <tr className="bg-gray-100 text-left text-gray-700">
                <th className="p-3 font-medium">Customer ID</th>
                <th className="p-3 font-medium">Name</th>
                <th className="p-3 font-medium">Phone</th>
                <th className="p-3 text-right font-medium">Accounts</th>
                <th className="p-3 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {staff.customers.map((customer) => (
                <tr key={customer.id} className="border-t">
                  <td className="p-3 font-semibold text-gray-950">
                    {customer.customerId}
                  </td>
                  <td className="p-3">{customer.fullName}</td>
                  <td className="p-3">{customer.phone || "-"}</td>
                  <td className="p-3 text-right tabular-nums">
                    {customer._count.accounts}
                  </td>
                  <td className="p-3 text-right">
                    <Link
                      href={`/customers/${customer.id}`}
                      aria-label={`View ${customer.fullName}`}
                      title="View"
                      className="group/view ml-auto flex size-8 items-center justify-center rounded-md text-gray-400 transition-all duration-150 hover:bg-blue-50 hover:text-blue-700"
                    >
                      <Eye className="size-4 transition-all duration-200 group-hover/view:scale-125 group-hover/view:opacity-70" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {staff.customers.length === 0 ? (
            <div className="border-t p-8 text-center text-sm text-gray-600">
              No customers assigned to this staff member yet.
            </div>
          ) : null}
        </div>
      </section>
      ) : null}

      <section className="rounded-lg border bg-white">
        <div className="border-b p-5">
          <h2 className="text-base font-semibold text-gray-950">
            Salary Payment History
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[560px] text-sm">
            <thead>
              <tr className="bg-gray-100 text-left text-gray-700">
                <th className="p-3 font-medium">Date</th>
                <th className="p-3 text-right font-medium">Amount</th>
                <th className="p-3 font-medium">Notes</th>
              </tr>
            </thead>
            <tbody>
              {staff.salaryPayments.map((payment) => (
                <tr key={payment.id} className="border-t">
                  <td className="p-3">{formatDate(payment.paymentDate)}</td>
                  <td className="p-3 text-right font-semibold text-gray-950">
                    {formatMoney(payment.amount)}
                  </td>
                  <td className="p-3">{payment.notes || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {staff.salaryPayments.length === 0 ? (
            <div className="border-t p-8 text-center text-sm text-gray-600">
              No salary payments recorded for this staff member.
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
