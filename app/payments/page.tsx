import Link from "next/link";
import { UserRole } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/accounts";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export default async function PaymentsPage() {
  const session = await auth();
  const isStaff = session?.user?.role === UserRole.STAFF;

  const payments = await prisma.payment.findMany({
    where:
      isStaff && session.user.staffId
        ? {
            account: {
              customer: {
                staffId: session.user.staffId,
              },
            },
          }
        : undefined,
    orderBy: {
      paymentDate: "desc",
    },
    include: {
      account: {
        include: {
          customer: true,
          product: true,
        },
      },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gray-950">Payments</h1>
          <p className="mt-1 text-sm text-gray-600">
            View recorded installment payments and receipts.
          </p>
        </div>

        <Button asChild>
          <Link href="/payments/new">Record Payment</Link>
        </Button>
      </div>

      <div className="overflow-hidden rounded-lg border bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-100 text-left text-gray-700">
              <th className="p-3 font-medium">Receipt</th>
              <th className="p-3 font-medium">Date</th>
              <th className="p-3 font-medium">Customer</th>
              <th className="p-3 font-medium">Product</th>
              <th className="p-3 font-medium">Amount</th>
              <th className="p-3 font-medium">Method</th>
              <th className="p-3 text-right font-medium">Account</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((payment) => (
              <tr key={payment.id} className="border-t">
                <td className="p-3 font-semibold text-gray-950">
                  {payment.receiptNo}
                </td>
                <td className="p-3">{formatDate(payment.paymentDate)}</td>
                <td className="p-3">
                  <div className="font-medium text-gray-950">
                    {payment.account.customer.fullName}
                  </div>
                  <div className="text-xs text-gray-500">
                    {payment.account.customer.customerId}
                  </div>
                </td>
                <td className="p-3">{payment.account.product.name}</td>
                <td className="p-3">{formatMoney(payment.amount)}</td>
                <td className="p-3">{payment.method}</td>
                <td className="p-3 text-right">
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/accounts/${payment.accountId}`}>View</Link>
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {payments.length === 0 ? (
          <div className="border-t p-8 text-center text-sm text-gray-600">
            No payments recorded yet.
          </div>
        ) : null}
      </div>
    </div>
  );
}
