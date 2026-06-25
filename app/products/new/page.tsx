import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createProduct } from "@/actions/products";
import { ProductForm } from "@/components/product-form";

export default function NewProductPage() {
  return (
    <div className="max-w-3xl space-y-6">
      {/* Back Button */}
      <Link
        href="/products"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 transition hover:text-gray-900"
      >
        <ArrowLeft className="size-4" /> Back to Products
      </Link>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-950">Create Product</h1>
        <p className="mt-1 text-sm text-gray-500">
          Add a GLV layaway product or combo.
        </p>
      </div>

      <ProductForm action={createProduct} submitLabel="Create Product" />
    </div>
  );
}