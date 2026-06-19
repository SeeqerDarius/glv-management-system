import Link from "next/link";
import { UserRole } from "@prisma/client";
import { deletePayment } from "@/actions/payments";
import { ConfirmDeleteForm } from "@/components/confirm-delete-form";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/accounts";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdminRole } from "@/lib/roles";

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

export default async function PaymentsPage({ searchParams }: PaymentsPageProps) {
  const { error, deleted } = await searchParams;
  const session = await auth();
  const isStaff = session?.user?.role === UserRole.STAFF;
  const isAdmin = isAdminRole(session?.user?.role);

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
          customer: {
            include: {
              staff: true,
            },
          },
          product: true,
        },
      },
    },
  });

  const groupedPayments = payments.reduce(
    (staffGroups, payment) => {
      const staff = payment.account.customer.staff;
      const customer = payment.account.customer;
      const account = payment.account;
      const staffGroup =
        staffGroups.get(staff.id) ??
        {
          staff,
          customers: new Map<
            string,
            {
              customer: typeof customer;
              accounts: Map<
                string,
                {
                  account: typeof account;
                  payments: typeof payments;
                }
              >;
            }
          >(),
        };

      const customerGroup =
        staffGroup.customers.get(customer.id) ??
        {
          customer,
          accounts: new Map<
            string,
            {
              account: typeof account;
              payments: typeof payments;
            }
          >(),
        };

      const accountGroup =
        customerGroup.accounts.get(account.id) ??
        {
          account,
          payments: [],
        };

      accountGroup.payments.push(payment);
      customerGroup.accounts.set(account.id, accountGroup);
      staffGroup.customers.set(customer.id, customerGroup);
      staffGroups.set(staff.id, staffGroup);

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

      {error === "payment-not-found" ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          Payment record could not be found.
        </div>
      ) : null}

      {error === "payment-delete-blocked" ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Payment deletion was blocked by related records. Review the account and try again.
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

      <div className="space-y-4">
        {Array.from(groupedPayments.values()).map((staffGroup) => (
          <section key={staffGroup.staff.id} className="rounded-lg border bg-white">
            <div className="border-b bg-lime-50 p-4">
              <h2 className="text-lg font-semibold text-gray-950">
                Staff Code: {staffGroup.staff.code}
              </h2>
              <p className="text-sm text-gray-600">{staffGroup.staff.fullName}</p>
            </div>

            <div className="space-y-4 p-4">
              {Array.from(staffGroup.customers.values()).map((customerGroup) => (
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
                        <div key={accountGroup.account.id} className="rounded border">
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b p-3">
                            <div>
                              <div className="font-medium text-gray-950">
                                {accountGroup.account.product.name}
                              </div>
                              <div className="text-xs text-gray-500">
                                Balance {formatMoney(accountGroup.account.balance)}
                              </div>
                            </div>
                            <Button asChild variant="outline" size="sm">
                              <Link href={`/accounts/${accountGroup.account.id}`}>
                                View Account
                              </Link>
                            </Button>
                          </div>

                          <table className="w-full text-sm">
                            <thead>
                              <tr className="bg-gray-100 text-left text-gray-700">
                                <th className="p-3 font-medium">Receipt</th>
                                <th className="p-3 font-medium">Date</th>
                                <th className="p-3 font-medium">Amount</th>
                                <th className="p-3 font-medium">Method</th>
                                {isAdmin ? (
                                  <th className="p-3 text-right font-medium">
                                    Actions
                                  </th>
                                ) : null}
                              </tr>
                            </thead>
                            <tbody>
                              {accountGroup.payments.map((payment) => (
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
                                  <td className="p-3">{payment.method}</td>
                                  {isAdmin ? (
                                    <td className="p-3 text-right">
                                      <ConfirmDeleteForm
                                        action={deletePayment}
                                        id={payment.id}
                                        title={`Delete receipt ${payment.receiptNo}?`}
                                        description="This permanently deletes the payment and recalculates the account total paid, balance, and status. This cannot be undone."
                                      >
                                        Delete
                                      </ConfirmDeleteForm>
                                    </td>
                                  ) : null}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}

        {payments.length === 0 ? (
          <div className="rounded-lg border bg-white p-8 text-center text-sm text-gray-600">
            No payments recorded yet.
          </div>
        ) : null}
      </div>
    </div>
  );
}
