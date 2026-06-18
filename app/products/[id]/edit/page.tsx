import { notFound } from "next/navigation";
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
    where: {
      id,
    },
  });

  if (!product) {
    notFound();
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-950">Edit Product</h1>
        <p className="mt-1 text-sm text-gray-600">
          Update prices, daily amount, duration, and active status.
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
