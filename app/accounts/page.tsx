import Link from "next/link";
import { UserRole } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatMoney, getEffectiveAccountStatus } from "@/lib/accounts";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export default async function AccountsPage() {
  const session = await auth();
  const isStaff = session?.user?.role === UserRole.STAFF;

  const accounts = await prisma.customerAccount.findMany({
    where:
      isStaff && session.user.staffId
        ? {
            customer: {
              staffId: session.user.staffId,
            },
          }
        : undefined,
    orderBy: {
      createdAt: "desc",
    },
    include: {
      customer: {
        include: {
          staff: true,
        },
      },
      product: true,
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gray-950">Accounts</h1>
          <p className="mt-1 text-sm text-gray-600">
            Track customer installment accounts separately from customer profiles.
          </p>
        </div>

        <Button asChild>
          <Link href="/accounts/new">Create Account</Link>
        </Button>
      </div>

      <div className="overflow-hidden rounded-lg border bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-100 text-left text-gray-700">
              <th className="p-3 font-medium">Customer</th>
              <th className="p-3 font-medium">Product</th>
              <th className="p-3 font-medium">Target</th>
              <th className="p-3 font-medium">Paid</th>
              <th className="p-3 font-medium">Balance</th>
              <th className="p-3 font-medium">Daily</th>
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
                  <td className="p-3">
                    <div className="font-medium text-gray-950">
                      {account.customer.fullName}
                    </div>
                    <div className="text-xs text-gray-500">
                      {account.customer.customerId}
                    </div>
                  </td>
                  <td className="p-3">{account.product.name}</td>
                  <td className="p-3">{formatMoney(account.targetAmount)}</td>
                  <td className="p-3">{formatMoney(account.totalPaid)}</td>
                  <td className="p-3">{formatMoney(account.balance)}</td>
                  <td className="p-3">{formatMoney(account.dailyAmount)}</td>
                  <td className="p-3">
                    <Badge variant={status === "OVERDUE" ? "destructive" : "default"}>
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
    </div>
  );
}
