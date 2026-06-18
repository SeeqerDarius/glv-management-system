import Link from "next/link";
import { SearchIcon } from "lucide-react";
import { deactivateProduct } from "@/actions/products";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";

type ProductsPageProps = {
  searchParams: Promise<{
    q?: string;
  }>;
};

function money(value: number) {
  return `GHS ${value.toFixed(2)}`;
}

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const { q } = await searchParams;
  const query = q?.trim() ?? "";
  const products = await prisma.product.findMany({
    where: query
      ? {
          OR: [
            {
              name: {
                contains: query,
                mode: "insensitive",
              },
            },
            {
              category: {
                contains: query,
                mode: "insensitive",
              },
            },
          ],
        }
      : undefined,
    orderBy: {
      name: "asc",
    },
    include: {
      _count: {
        select: {
          accounts: true,
        },
      },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gray-950">Products</h1>
          <p className="mt-1 text-sm text-gray-600">
            Manage GLV assets, prices, and installment terms.
          </p>
        </div>

        <Button asChild>
          <Link href="/products/new">Create Product</Link>
        </Button>
      </div>

      <form className="flex max-w-xl gap-2">
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
          <input
            name="q"
            defaultValue={query}
            placeholder="Search products or categories"
            className="w-full rounded border bg-white py-3 pl-9 pr-3"
          />
        </div>
        <Button type="submit" variant="outline">
          Search
        </Button>
      </form>

      <div className="overflow-hidden rounded-lg border bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-100 text-left text-gray-700">
              <th className="p-3 font-medium">Name</th>
              <th className="p-3 font-medium">Category</th>
              <th className="p-3 font-medium">Layaway</th>
              <th className="p-3 font-medium">Daily</th>
              <th className="p-3 font-medium">Duration</th>
              <th className="p-3 font-medium">Status</th>
              <th className="p-3 font-medium">Accounts</th>
              <th className="p-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <tr key={product.id} className="border-t">
                <td className="p-3 font-semibold text-gray-950">
                  {product.name}
                </td>
                <td className="p-3">{product.category}</td>
                <td className="p-3">{money(product.layawayPrice)}</td>
                <td className="p-3">{money(product.dailyAmount)}</td>
                <td className="p-3">{product.duration} days</td>
                <td className="p-3">
                  <Badge variant={product.active ? "default" : "secondary"}>
                    {product.active ? "Active" : "Inactive"}
                  </Badge>
                </td>
                <td className="p-3">{product._count.accounts}</td>
                <td className="p-3">
                  <div className="flex justify-end gap-2">
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/products/${product.id}`}>View</Link>
                    </Button>
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/products/${product.id}/edit`}>Edit</Link>
                    </Button>
                    {product.active ? (
                      <form action={deactivateProduct}>
                        <input type="hidden" name="id" value={product.id} />
                        <Button type="submit" variant="destructive" size="sm">
                          Deactivate
                        </Button>
                      </form>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {products.length === 0 ? (
          <div className="border-t p-8 text-center text-sm text-gray-600">
            No products found.
          </div>
        ) : null}
      </div>
    </div>
  );
}
