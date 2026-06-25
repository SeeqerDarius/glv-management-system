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

  const product = await prisma.product.findUnique({
    where: { id },
  });

  if (!product) {
    notFound();
  }

  return (
    <div className="max-w-3xl space-y-6">
      {/* Back Button */}
      <Link
        href={`/products/${product.id}`}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 transition hover:text-gray-900"
      >
        <ArrowLeft className="size-4" /> Back to Product
      </Link>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-950">Edit Product</h1>
        <p className="mt-1 text-sm text-gray-500">
          Update cost price, daily amount, duration, category, combo details, and active status.
        </p>
      </div>

      <ProductForm
        action={updateProduct}
        product={product}
        submitLabel="Save Changes"
      />
    </div>
  );
}