import { createProduct } from "@/actions/products";
import { ProductForm } from "@/components/product-form";

export default function NewProductPage() {
  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-950">Create Product</h1>
        <p className="mt-1 text-sm text-gray-600">
          Add a GLV asset and its 184-day layaway terms.
        </p>
      </div>

      <ProductForm action={createProduct} submitLabel="Create Product" />
    </div>
  );
}
