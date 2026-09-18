import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { UserPermission } from "@prisma/client";
import { ArrowLeft } from "lucide-react";
import { BackButton } from "@/components/back-button";
import { InventoryCountForm } from "@/components/inventory-count-form";
import { InventoryMovementsTable } from "@/components/inventory-movements-table";
import { InventoryReceiveForm } from "@/components/inventory-receive-form";
import { ProductImagePreview } from "@/components/product-image-preview";
import { formatMoney } from "@/lib/accounts";
import { auth } from "@/lib/auth";
import { getInventoryMovements } from "@/lib/inventory";
import { prisma } from "@/lib/prisma";
import { getProcurementDemand } from "@/lib/procurement";
import { ProductCategoryBadge } from "@/lib/product-categories";
import { hasPermission, isAdminRole } from "@/lib/roles";

type InventoryProductPageProps = {
  params: Promise<{ productId: string }>;
};

export default async function InventoryProductPage({
  params,
}: InventoryProductPageProps) {
  const session = await auth();
  const canManageProducts =
    isAdminRole(session?.user?.role) ||
    hasPermission(
      session?.user?.role,
      session?.user?.permissions,
      UserPermission.MANAGE_PRODUCTS
    );

  if (!canManageProducts) {
    redirect("/dashboard");
  }

  const { productId } = await params;
  const [product, movements, demand] = await Promise.all([
    prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        name: true,
        category: true,
        imageUrl: true,
        active: true,
        stockOnHand: true,
        costPrice: true,
        transportCost: true,
      },
    }),
    getInventoryMovements({ productId, take: 200 }),
    getProcurementDemand(),
  ]);

  if (!product) {
    notFound();
  }

  const landedUnitCost = product.costPrice + product.transportCost;
  const unitsOwed = demand.unitsByProduct.get(product.id) ?? 0;
  const shortfall = Math.max(unitsOwed - product.stockOnHand, 0);
  const returnTo = `/inventory/${product.id}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <BackButton
            fallbackHref="/inventory"
            className="mt-1 flex size-8 items-center justify-center rounded-md text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
          >
            <ArrowLeft className="size-4" />
          </BackButton>
          <ProductImagePreview
            src={product.imageUrl}
            alt={product.name}
            className="size-16 rounded-lg bg-white"
            iconClassName="size-7"
            previewTitle={product.name}
          />
          <div className="min-w-0">
            <h1 className="break-words text-2xl font-bold text-gray-950 sm:text-3xl">
              {product.name}
            </h1>
            <div className="mt-2">
              <ProductCategoryBadge category={product.category} />
            </div>
            <p className="mt-2 text-sm text-gray-600">
              Every movement that put this product on the shelf or took it off.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <InventoryReceiveForm
            productId={product.id}
            productName={product.name}
            stockOnHand={product.stockOnHand}
            suggestedQuantity={shortfall}
            returnTo={returnTo}
            variant="button"
          />
          <InventoryCountForm
            productId={product.id}
            productName={product.name}
            stockOnHand={product.stockOnHand}
            returnTo={returnTo}
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <div className="rounded-lg border bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            In stock
          </p>
          <p className="mt-1 text-2xl font-semibold text-gray-950">
            {product.stockOnHand}
          </p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Units owed
          </p>
          <p className="mt-1 text-2xl font-semibold text-gray-950">
            {unitsOwed}
          </p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Still to buy
          </p>
          <p
            className={`mt-1 text-2xl font-semibold ${
              shortfall > 0 ? "text-amber-700" : "text-gray-950"
            }`}
          >
            {shortfall}
          </p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Stock value
          </p>
          <p className="mt-1 text-2xl font-semibold text-green-700">
            {formatMoney(product.stockOnHand * landedUnitCost)}
          </p>
        </div>
      </div>

      {shortfall > 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3.5 text-sm text-amber-900">
          {shortfall} more unit{shortfall === 1 ? "" : "s"} still to buy, so this
          product is on the{" "}
          <Link
            href="/products?tab=procurement"
            className="font-medium underline underline-offset-2"
          >
            procurement list
          </Link>
          . Receive the stock and it drops off.
        </div>
      ) : null}

      <InventoryMovementsTable movements={movements} hideProduct />
    </div>
  );
}
