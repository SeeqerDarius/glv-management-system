import Link from "next/link";
import { notFound } from "next/navigation";
import { deactivateProduct } from "@/actions/products";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";

type ProductDetailsPageProps = {
  params: Promise<{
    id: string;
  }>;
};

function money(value: number) {
  return `GHS ${value.toFixed(2)}`;
}

export default async function ProductDetailsPage({
  params,
}: ProductDetailsPageProps) {
  const { id } = await params;
  const product = await prisma.product.findUnique({
    where: {
      id,
    },
    include: {
      _count: {
        select: {
          accounts: true,
        },
      },
    },
  });

  if (!product) {
    notFound();
  }

  const profitAmount = product.layawayPrice - product.costPrice;
  const profitPercentage = (profitAmount / product.costPrice) * 100;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-gray-950">
              {product.name}
            </h1>
            <Badge variant={product.active ? "default" : "secondary"}>
              {product.active ? "Active" : "Inactive"}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-gray-600">{product.category}</p>
        </div>

        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/products">Back</Link>
          </Button>
          <Button asChild>
            <Link href={`/products/${product.id}/edit`}>Edit</Link>
          </Button>
          {product.active ? (
            <form action={deactivateProduct}>
              <input type="hidden" name="id" value={product.id} />
              <Button type="submit" variant="destructive">
                Deactivate
              </Button>
            </form>
          ) : null}
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border bg-white p-5">
          <p className="text-sm text-gray-500">Cost Price</p>
          <p className="mt-2 text-xl font-semibold text-gray-950">
            {money(product.costPrice)}
          </p>
        </div>
        <div className="rounded-lg border bg-white p-5">
          <p className="text-sm text-gray-500">Cash Price</p>
          <p className="mt-2 text-xl font-semibold text-gray-950">
            {money(product.cashPrice)}
          </p>
        </div>
        <div className="rounded-lg border bg-white p-5">
          <p className="text-sm text-gray-500">Layaway Price</p>
          <p className="mt-2 text-xl font-semibold text-gray-950">
            {money(product.layawayPrice)}
          </p>
        </div>
        <div className="rounded-lg border bg-white p-5">
          <p className="text-sm text-gray-500">Daily Amount</p>
          <p className="mt-2 text-xl font-semibold text-gray-950">
            {money(product.dailyAmount)}
          </p>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border bg-white p-5">
          <p className="text-sm text-gray-500">Duration</p>
          <p className="mt-2 text-xl font-semibold text-gray-950">
            {product.duration} days
          </p>
        </div>
        <div className="rounded-lg border bg-white p-5">
          <p className="text-sm text-gray-500">Profit Amount</p>
          <p className="mt-2 text-xl font-semibold text-gray-950">
            {money(profitAmount)}
          </p>
        </div>
        <div className="rounded-lg border bg-white p-5">
          <p className="text-sm text-gray-500">Profit Percentage</p>
          <p className="mt-2 text-xl font-semibold text-gray-950">
            {profitPercentage.toFixed(2)}%
          </p>
        </div>
      </section>

      <section className="rounded-lg border bg-white p-5">
        <h2 className="text-base font-semibold text-gray-950">Usage</h2>
        <p className="mt-2 text-sm text-gray-600">
          {product._count.accounts} customer account
          {product._count.accounts === 1 ? "" : "s"} use this product.
        </p>
      </section>
    </div>
  );
}
