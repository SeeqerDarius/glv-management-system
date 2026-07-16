import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { updateProduct } from "@/actions/products";
import { ProductForm } from "@/components/product-form";
import { prisma } from "@/lib/prisma";

type EditProductPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function EditProductPage({ params }: EditProductPageProps) {
  const { id } = await params;

  const [product, categories] = await Promise.all([
    prisma.product.findUnique({
      where: { id },
    }),
    prisma.productCategory.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
  ]);

  if (!product) {
    notFound();
  }

  return (
    <div className="max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Link
          href={`/products/${product.id}`}
          aria-label="Back to product"
          title="Back"
          className="group/back mt-0.5 flex size-8 items-center justify-center rounded-md text-gray-400 transition-all duration-150 hover:bg-gray-100 hover:text-gray-700"
        >
          <ArrowLeft className="size-4 transition-transform duration-200 group-hover/back:scale-125 group-hover/back:-translate-x-0.5" />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-gray-950">Edit Product</h1>
          <p className="mt-1 text-sm text-gray-500">
            Update cost price, daily amount, duration, category, combo details, and active status.
          </p>
        </div>
      </div>

      <ProductForm
        action={updateProduct}
        product={product}
        submitLabel="Save Changes"
        categories={categories.map((category) => category.name)}
      />
    </div>
  );
}
