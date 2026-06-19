import Link from "next/link";
import { notFound } from "next/navigation";
import { UserRole } from "@prisma/client";
import { AccountDaysProgress } from "@/components/account-days-progress";
import { Button } from "@/components/ui/button";
import { formatMoney, getEffectiveAccountStatus } from "@/lib/accounts";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type CustomerProfilePageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function CustomerProfilePage({
  params,
}: CustomerProfilePageProps) {
  const { id } = await params;
  const session = await auth();
  const isStaff = session?.user?.role === UserRole.STAFF;

  const customer = await prisma.customer.findFirst({
    where: {
      id,
      ...(isStaff && session.user.staffId
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
            <Link href="/accounts/new">New Account</Link>
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
              <dd className="font-medium text-gray-950">{customer.phone}</dd>
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
              <th className="p-3 font-medium">Paid Progress</th>
              <th className="p-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {customer.accounts.map((account) => {
              const status = getEffectiveAccountStatus(account);

              return (
                <tr key={account.id} className="border-t">
                  <td className="p-3">{account.product.name}</td>
                  <td className="p-3">{formatMoney(account.targetAmount)}</td>
                  <td className="p-3">{formatMoney(account.totalPaid)}</td>
                  <td className="p-3">{formatMoney(account.balance)}</td>
                  <td className="p-3">{status}</td>
                  <td className="p-3">
                    <AccountDaysProgress
                      totalPaid={account.totalPaid}
                      dailyAmount={account.dailyAmount}
                      duration={account.product.duration}
                    />
                  </td>
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

        {customer.accounts.length === 0 ? (
          <div className="border-t p-8 text-center text-sm text-gray-600">
            No accounts created for this customer yet.
          </div>
        ) : null}
      </section>
    </div>
  );
}
