import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createProduct } from "@/actions/products";
import { ProductForm } from "@/components/product-form";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";

export default async function NewProductPage() {
  const [settings, categories] = await Promise.all([
    getSettings(),
    prisma.productCategory.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
  ]);

  return (
    <div className="max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Link
          href="/products"
          aria-label="Back to products"
          title="Back"
          className="group/back mt-0.5 flex size-8 items-center justify-center rounded-md text-gray-400 transition-all duration-150 hover:bg-gray-100 hover:text-gray-700"
        >
          <ArrowLeft className="size-4 transition-transform duration-200 group-hover/back:scale-125 group-hover/back:-translate-x-0.5" />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-gray-950">Create Product</h1>
          <p className="mt-1 text-sm text-gray-500">
            Add a GLV layaway product or combo.
          </p>
        </div>
      </div>

      <ProductForm
        action={createProduct}
        submitLabel="Create Product"
        defaultDailyAmount={settings.defaultDailyCollection}
        defaultDuration={settings.installmentDurationDays}
        categories={categories.map((category) => category.name)}
      />
    </div>
  );
}
