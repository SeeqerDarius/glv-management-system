import { AccountStatus } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSuperAdminRole } from "@/lib/roles";
import {
  parseWeeklyReport,
  type RecoveredAccountRow,
} from "@/lib/weekly-report-import";
import {
  claimIdempotencyKey,
  completeIdempotencyKey,
  normalizeIdempotencyKey,
} from "@/lib/idempotency";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function normalized(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function accountStatus(value: string) {
  return Object.values(AccountStatus).includes(value as AccountStatus)
    ? (value as AccountStatus)
    : AccountStatus.ACTIVE;
}

function accountKey(customerId: string, productName: string) {
  return `${normalized(customerId)}::${normalized(productName)}`;
}

function inferredProduct(account: RecoveredAccountRow) {
  return {
    category: "Recovered",
    name: account.productName,
    costPrice: 0,
    transportCost: 0,
    dailyAmount: account.dailyAmount,
    duration: Math.max(1, Math.round(account.daysPaid + account.daysLeft)),
    layawayPrice: account.targetAmount,
  };
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id || !isSuperAdminRole(session.user.role)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const actorId = session.user.id;
  const idempotencyKey = normalizeIdempotencyKey(
    request.headers.get("idempotency-key")
  );
  if (!idempotencyKey) {
    return Response.json(
      { error: "Missing or invalid Idempotency-Key header." },
      { status: 400 }
    );
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const mappingValue = String(formData.get("staffMapping") ?? "{}");
  if (!(file instanceof File) || !file.name.toLowerCase().endsWith(".xlsx")) {
    return Response.json({ error: "Choose a valid XLSX weekly report." }, { status: 400 });
  }

  try {
    const report = await parseWeeklyReport(await file.arrayBuffer());
    const staffMapping = JSON.parse(mappingValue) as Record<string, string>;
    const selectedStaffIds = Array.from(
      new Set(report.staffCodes.map((code) => staffMapping[code]).filter(Boolean))
    );
    const currentStaff = await prisma.staff.findMany({
      where: { id: { in: selectedStaffIds }, active: true },
      select: { id: true },
    });
    const validStaffIds = new Set(currentStaff.map((staff) => staff.id));
    const unmappedCodes = report.staffCodes.filter(
      (code) => !staffMapping[code] || !validStaffIds.has(staffMapping[code])
    );

    if (unmappedCodes.length) {
      return Response.json(
        { error: `Map these staff codes before importing: ${unmappedCodes.join(", ")}` },
        { status: 400 }
      );
    }
    if (report.warnings.length) {
      return Response.json(
        { error: report.warnings.join(" ") },
        { status: 400 }
      );
    }

    const result = await prisma.$transaction(
      async (tx) => {
        const claim = await claimIdempotencyKey({
          tx,
          userId: actorId,
          operation: "IMPORT_WEEKLY_REPORT",
          key: idempotencyKey,
        });
        if (!claim.claimed) {
          if (!claim.resourceId) {
            throw new Error("The original import is still processing.");
          }
          return JSON.parse(claim.resourceId) as {
            productsCreated: number;
            customersCreated: number;
            customersUpdated: number;
            accountsCreated: number;
            accountsSkipped: number;
            paymentsCreated: number;
            paymentsSkipped: number;
            openingAdjustmentsCreated: number;
          };
        }

        const counts = {
          productsCreated: 0,
          customersCreated: 0,
          customersUpdated: 0,
          accountsCreated: 0,
          accountsSkipped: 0,
          paymentsCreated: 0,
          paymentsSkipped: 0,
          openingAdjustmentsCreated: 0,
        };

        const productDetails = new Map(
          report.products.map((product) => [normalized(product.name), product])
        );
        const products = await tx.product.findMany();
        const productsByName = new Map(
          products.map((product) => [normalized(product.name), product])
        );
        const accountProductNames = Array.from(
          new Set(report.accounts.map((account) => account.productName))
        );

        for (const productName of accountProductNames) {
          const key = normalized(productName);
          if (productsByName.has(key)) continue;

          const exampleAccount = report.accounts.find(
            (account) => normalized(account.productName) === key
          )!;
          const exportedProduct =
            productDetails.get(key) ?? inferredProduct(exampleAccount);
          await tx.productCategory.upsert({
            where: { name: exportedProduct.category },
            update: { active: true },
            create: { name: exportedProduct.category, active: true },
          });
          const created = await tx.product.create({
            data: {
              name: productName,
              category: exportedProduct.category,
              costPrice: exportedProduct.costPrice,
              transportCost: exportedProduct.transportCost,
              dailyAmount: exportedProduct.dailyAmount || exampleAccount.dailyAmount,
              duration:
                exportedProduct.duration ||
                Math.max(1, Math.round(exampleAccount.daysPaid + exampleAccount.daysLeft)),
              layawayPrice:
                exportedProduct.layawayPrice || exampleAccount.targetAmount,
              quantityOnSale: 0,
              active: true,
              description:
                productDetails.has(key) && exportedProduct.name !== productName
                  ? exportedProduct.name
                  : null,
            },
          });
          productsByName.set(key, created);
          counts.productsCreated += 1;
        }

        const earliestAccountDate = new Map<string, Date>();
        for (const account of report.accounts) {
          const current = earliestAccountDate.get(account.customerId);
          if (!current || account.startDate < current) {
            earliestAccountDate.set(account.customerId, account.startDate);
          }
        }

        const customersByExternalId = new Map<
          string,
          { id: string; customerId: string }
        >();
        for (const account of report.accounts) {
          if (customersByExternalId.has(account.customerId)) continue;
          const existing = await tx.customer.findUnique({
            where: { customerId: account.customerId },
            select: { id: true, customerId: true },
          });
          if (existing) {
            const updated = await tx.customer.update({
              where: { id: existing.id },
              data: {
                fullName: account.customerName,
                phone: account.phone,
                staffId: staffMapping[account.staffCode],
              },
              select: { id: true, customerId: true },
            });
            customersByExternalId.set(account.customerId, updated);
            counts.customersUpdated += 1;
          } else {
            const created = await tx.customer.create({
              data: {
                customerId: account.customerId,
                fullName: account.customerName,
                phone: account.phone,
                staffId: staffMapping[account.staffCode],
                createdAt: earliestAccountDate.get(account.customerId),
              },
              select: { id: true, customerId: true },
            });
            customersByExternalId.set(account.customerId, created);
            counts.customersCreated += 1;
          }
        }

        const importedAccounts = new Map<
          string,
          Array<{ id: string; row: RecoveredAccountRow; created: boolean }>
        >();
        const rememberAccount = (
          key: string,
          account: { id: string; row: RecoveredAccountRow; created: boolean }
        ) => {
          importedAccounts.set(key, [...(importedAccounts.get(key) ?? []), account]);
        };
        for (const account of report.accounts) {
          const customer = customersByExternalId.get(account.customerId)!;
          const product = productsByName.get(normalized(account.productName))!;
          const existing = await tx.customerAccount.findFirst({
            where: {
              customerId: customer.id,
              productId: product.id,
              startDate: account.startDate,
            },
            select: { id: true },
          });
          if (existing) {
            rememberAccount(accountKey(account.customerId, account.productName), {
              id: existing.id,
              row: account,
              created: false,
            });
            counts.accountsSkipped += 1;
            continue;
          }
          const created = await tx.customerAccount.create({
            data: {
              customerId: customer.id,
              productId: product.id,
              startDate: account.startDate,
              expectedEndDate: account.expectedEndDate,
              targetAmount: account.targetAmount,
              dailyAmount: account.dailyAmount,
              totalPaid: account.totalPaid,
              balance: account.balance,
              status: accountStatus(account.status),
              createdAt: account.startDate,
            },
            select: { id: true },
          });
          rememberAccount(accountKey(account.customerId, account.productName), {
            id: created.id,
            row: account,
            created: true,
          });
          counts.accountsCreated += 1;
        }

        const weeklyAmountsByAccount = new Map<string, number>();
        for (const payment of report.payments) {
          const key = accountKey(payment.customerId, payment.productName);
          const matches = importedAccounts.get(key) ?? [];
          if (matches.length !== 1) {
            throw new Error(
              `Payment ${payment.receiptNo} cannot be matched safely to one account (${payment.customerId} / ${payment.productName}).`
            );
          }
          const importedAccount = matches[0];
          const existing = await tx.payment.findUnique({
            where: { receiptNo: payment.receiptNo },
            select: { id: true },
          });
          if (existing) {
            counts.paymentsSkipped += 1;
            continue;
          }
          await tx.payment.create({
            data: {
              receiptNo: payment.receiptNo,
              accountId: importedAccount.id,
              amount: payment.amount,
              paymentDate: payment.paymentDate,
              method: payment.method,
              notes: payment.notes,
              receivedBy: actorId,
              createdAt: payment.paymentDate,
            },
          });
          weeklyAmountsByAccount.set(
            importedAccount.id,
            (weeklyAmountsByAccount.get(importedAccount.id) ?? 0) + payment.amount
          );
          counts.paymentsCreated += 1;
        }

        for (const accountMatches of importedAccounts.values()) {
          for (const importedAccount of accountMatches) {
            if (!importedAccount.created) continue;
            const openingAmount = Math.max(
              importedAccount.row.totalPaid -
                (weeklyAmountsByAccount.get(importedAccount.id) ?? 0),
              0
            );
            if (openingAmount <= 0) continue;
            const receiptNo = `RECOVERED-${importedAccount.id}`;
            const exists = await tx.payment.findUnique({
              where: { receiptNo },
              select: { id: true },
            });
            if (exists) continue;
            await tx.payment.create({
              data: {
                receiptNo,
                accountId: importedAccount.id,
                amount: openingAmount,
                paymentDate: importedAccount.row.startDate,
                method: "RECOVERED_OPENING_BALANCE",
                notes:
                  "Recovered aggregate paid before the exported week; original receipt dates were unavailable.",
                receivedBy: actorId,
                createdAt: importedAccount.row.startDate,
              },
            });
            counts.openingAdjustmentsCreated += 1;
          }
        }

        await tx.auditLog.create({
          data: {
            userId: actorId,
            action: "IMPORT_WEEKLY_REPORT_RECOVERY",
            entity: "DatabaseRecovery",
            entityId: file.name,
            newValue: JSON.stringify({ counts, staffMapping }),
          },
        });
        await completeIdempotencyKey(
          tx,
          claim.id,
          JSON.stringify(counts)
        );

        return counts;
      },
      { maxWait: 20_000, timeout: 240_000 }
    );

    return Response.json({ ok: true, counts: result });
  } catch (error) {
    console.error("WEEKLY_REPORT_IMPORT_FAILED", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Import failed and was rolled back." },
      { status: 400 }
    );
  }
}
