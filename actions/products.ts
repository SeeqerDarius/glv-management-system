"use server";

import { UserPermission } from "@prisma/client";
import { del, put } from "@vercel/blob";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission, isAdminRole } from "@/lib/roles";
import { verifyAdminDeleteConfirmation } from "@/lib/admin-delete";

export type ProductFormState = {
  errors?: {
    name?: string;
    category?: string;
    costPrice?: string;
    dailyAmount?: string;
    duration?: string;
    transportCost?: string;
    quantityOnSale?: string;
    image?: string;
    form?: string;
  };
  duplicateWarning?: string;
};

type ProductInput = {
  name: string;
  category: string;
  description: string | null;
  costPrice: number;
  layawayPrice: number;
  dailyAmount: number;
  duration: number;
  transportCost: number;
  quantityOnSale: number;
};

const maxProductImageSize = 4 * 1024 * 1024;
const allowedProductImageTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

async function requireProductManager() {
  const session = await auth();

  if (
    !session?.user?.id ||
    !session.user.role ||
    !hasPermission(
      session.user.role,
      session.user.permissions,
      UserPermission.MANAGE_PRODUCTS
    )
  ) {
    throw new Error("Unauthorized");
  }

  return { id: session.user.id };
}

async function requireAdmin() {
  const session = await auth();

  if (!session?.user?.id || !isAdminRole(session.user.role)) {
    throw new Error("Unauthorized");
  }

  return { id: session.user.id };
}

function cleanInput(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

function parseNumber(formData: FormData, field: string) {
  const value = Number(cleanInput(formData.get(field)));
  return Number.isFinite(value) ? value : Number.NaN;
}

function getProductImageFile(formData: FormData) {
  const image = formData.get("image");
  return image instanceof File && image.size > 0 ? image : null;
}

function safeBlobName(name: string, file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const baseName = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 48);

  return `products/${baseName || "product"}-${Date.now()}.${extension}`;
}

async function resolveProductImageUrl({
  formData,
  productName,
  existingImageUrl,
}: {
  formData: FormData;
  productName: string;
  existingImageUrl?: string | null;
}): Promise<{ imageUrl?: string | null; error?: string }> {
  const image = getProductImageFile(formData);
  const removeImage = formData.get("removeImage") === "on";

  if (!image) {
    return { imageUrl: removeImage ? null : existingImageUrl ?? null };
  }

  if (!allowedProductImageTypes.has(image.type)) {
    return {
      error: "Use a JPG, PNG, WebP, or GIF image.",
    };
  }

  if (image.size > maxProductImageSize) {
    return {
      error: "Product image must be 4MB or smaller.",
    };
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return {
      error:
        "Product image storage is not configured. Add BLOB_READ_WRITE_TOKEN in Vercel, then try again.",
    };
  }

  const blob = await put(safeBlobName(productName, image), image, {
    access: "public",
    addRandomSuffix: true,
  }).catch(() => null);

  if (!blob) {
    return {
      error: "Unable to upload product image. Please try again.",
    };
  }

  if (existingImageUrl) {
    await del(existingImageUrl).catch(() => undefined);
  }

  return { imageUrl: blob.url };
}

function validateProduct(formData: FormData): {
  data?: ProductInput;
  errors?: ProductFormState["errors"];
} {
  const name = cleanInput(formData.get("name"));
  const category = cleanInput(formData.get("category"));
  const description = cleanInput(formData.get("description"));
  const costPrice = parseNumber(formData, "costPrice");
  const dailyAmount = parseNumber(formData, "dailyAmount");
  const duration = Number(cleanInput(formData.get("duration")));
  const transportCost = parseNumber(formData, "transportCost");
  const quantityOnSale = Number(cleanInput(formData.get("quantityOnSale")));
  const errors: ProductFormState["errors"] = {};

  if (!name) errors.name = "Product name is required.";
  if (!category) errors.category = "Category is required.";

  if (!Number.isFinite(costPrice) || costPrice <= 0) {
    errors.costPrice = "Cost price must be greater than zero.";
  }

  if (!Number.isFinite(dailyAmount) || dailyAmount <= 0) {
    errors.dailyAmount = "Daily amount must be greater than zero.";
  }

  if (!Number.isInteger(duration) || duration <= 0) {
    errors.duration = "Duration must be a positive whole number.";
  }

  if (!Number.isFinite(transportCost) || transportCost < 0) {
    errors.transportCost = "Transport cost cannot be negative.";
  }

  if (!Number.isInteger(quantityOnSale) || quantityOnSale < 0) {
    errors.quantityOnSale = "Quantity must be a whole number of zero or more.";
  }

  const layawayPrice =
    Number.isFinite(dailyAmount) && Number.isInteger(duration)
      ? dailyAmount * duration
      : Number.NaN;

  if (Number.isFinite(costPrice) && Number.isFinite(layawayPrice) && layawayPrice < costPrice) {
    errors.dailyAmount =
      "Daily amount × duration cannot be lower than cost price.";
  }

  if (Object.keys(errors).length > 0) {
    return { errors };
  }

  return {
    data: {
      name,
      category,
      description: description || null,
      costPrice,
      layawayPrice,
      dailyAmount,
      duration,
      transportCost,
      quantityOnSale,
    },
  };
}

async function findDuplicateName(name: string, currentProductId?: string) {
  return prisma.product.findFirst({
    where: {
      name: {
        equals: name,
        mode: "insensitive",
      },
      ...(currentProductId
        ? {
            NOT: {
              id: currentProductId,
            },
          }
        : {}),
    },
    select: {
      id: true,
    },
  });
}

async function findSimilarProduct(name: string, category: string) {
  const categoryProducts = await prisma.product.findMany({
    where: {
      category: {
        equals: category,
        mode: "insensitive",
      },
    },
    select: {
      name: true,
      category: true,
    },
  });

  const normalizedName = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

  return categoryProducts.find((product) => {
    const existing = product.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();

    return (
      existing === normalizedName ||
      existing.includes(normalizedName) ||
      normalizedName.includes(existing)
    );
  });
}

async function logProductAudit({
  userId,
  action,
  productId,
  oldValue,
  newValue,
}: {
  userId: string;
  action: string;
  productId: string;
  oldValue?: unknown;
  newValue?: unknown;
}) {
  await prisma.auditLog.create({
    data: {
      userId,
      action,
      entity: "Product",
      entityId: productId,
      oldValue: oldValue ? JSON.stringify(oldValue) : null,
      newValue: newValue ? JSON.stringify(newValue) : null,
    },
  });
}

export async function createProduct(
  _state: ProductFormState,
  formData: FormData
): Promise<ProductFormState> {
  const user = await requireProductManager();
  const validated = validateProduct(formData);

  if (validated.errors || !validated.data) {
    return { errors: validated.errors };
  }

  const duplicate = await findSimilarProduct(
    validated.data.name,
    validated.data.category
  );

  if (duplicate && formData.get("confirmDuplicate") !== "true") {
    return {
      duplicateWarning: `${duplicate.name} already exists in ${duplicate.category}. Do you still want to add this product?`,
    };
  }

  const imageResult = await resolveProductImageUrl({
    formData,
    productName: validated.data.name,
  });

  if (imageResult.error) {
    return {
      errors: {
        image: imageResult.error,
      },
    };
  }

  const product = await prisma.product.create({
    data: {
      ...validated.data,
      imageUrl: imageResult.imageUrl,
      quantityOnSale: 0,
      active: formData.get("active") === "on",
    },
  });

  await logProductAudit({
    userId: user.id,
    action: "CREATE_PRODUCT",
    productId: product.id,
    newValue: product,
  });

  revalidatePath("/products");
  revalidatePath("/accounts/new");
  revalidatePath("/customers/new");
  revalidatePath("/payments/new");
  redirect(`/products/${product.id}`);
}

export async function updateProduct(
  _state: ProductFormState,
  formData: FormData
): Promise<ProductFormState> {
  const user = await requireProductManager();
  const id = cleanInput(formData.get("id"));
  const validated = validateProduct(formData);

  if (!id) {
    return {
      errors: {
        form: "Product record was not found.",
      },
    };
  }

  if (validated.errors || !validated.data) {
    return { errors: validated.errors };
  }

  const duplicate = await findDuplicateName(validated.data.name, id);

  if (duplicate) {
    return {
      errors: {
        name: "A product with this name already exists.",
      },
    };
  }

  const existingProduct = await prisma.product.findUnique({
    where: { id },
  });

  if (!existingProduct) {
    return {
      errors: {
        form: "Product record was not found.",
      },
    };
  }

  const imageResult = await resolveProductImageUrl({
    formData,
    productName: validated.data.name,
    existingImageUrl: existingProduct.imageUrl,
  });

  if (imageResult.error) {
    return {
      errors: {
        image: imageResult.error,
      },
    };
  }

  if (formData.get("removeImage") === "on" && existingProduct.imageUrl) {
    await del(existingProduct.imageUrl).catch(() => undefined);
  }

  const updatedProduct = await prisma.product.update({
    where: { id },
    data: {
      ...validated.data,
      imageUrl: imageResult.imageUrl,
      quantityOnSale: existingProduct.quantityOnSale,
      active: formData.get("active") === "on",
    },
  });

  await logProductAudit({
    userId: user.id,
    action: "UPDATE_PRODUCT",
    productId: updatedProduct.id,
    oldValue: existingProduct,
    newValue: updatedProduct,
  });

  await logProductAudit({
    userId: user.id,
    action: "UPDATE_PRODUCT_COSTING",
    productId: updatedProduct.id,
    oldValue: {
      costPrice: existingProduct.costPrice,
      transportCost: existingProduct.transportCost,
      quantityOnSale: existingProduct.quantityOnSale,
      description: existingProduct.description,
    },
    newValue: {
      costPrice: updatedProduct.costPrice,
      transportCost: updatedProduct.transportCost,
      quantityOnSale: updatedProduct.quantityOnSale,
      description: updatedProduct.description,
    },
  });

  await logProductAudit({
    userId: user.id,
    action: "UPDATE_PRODUCT_PRICE",
    productId: updatedProduct.id,
    oldValue: {
      layawayPrice: existingProduct.layawayPrice,
      dailyAmount: existingProduct.dailyAmount,
      duration: existingProduct.duration,
    },
    newValue: {
      layawayPrice: updatedProduct.layawayPrice,
      dailyAmount: updatedProduct.dailyAmount,
      duration: updatedProduct.duration,
    },
  });

  revalidatePath("/products");
  revalidatePath(`/products/${id}`);
  revalidatePath("/accounts/new");
  revalidatePath("/customers/new");
  revalidatePath("/payments/new");
  redirect(`/products/${id}`);
}

export async function deactivateProduct(formData: FormData): Promise<void> {
  const user = await requireProductManager();
  const id = cleanInput(formData.get("id"));

  const existingProduct = await prisma.product.findUnique({
    where: { id },
  });

  if (!existingProduct) {
    throw new Error("Product record was not found.");
  }

  const updatedProduct = await prisma.product.update({
    where: { id },
    data: {
      active: false,
    },
  });

  await logProductAudit({
    userId: user.id,
    action: "DEACTIVATE_PRODUCT",
    productId: updatedProduct.id,
    oldValue: existingProduct,
    newValue: updatedProduct,
  });

  revalidatePath("/products");
  revalidatePath(`/products/${id}`);
}

export async function deleteProduct(formData: FormData): Promise<void> {
  const user = await requireAdmin();
  const id = cleanInput(formData.get("id"));

  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      accounts: {
        include: {
          payments: {
            orderBy: {
              paymentDate: "desc",
            },
          },
        },
      },
    },
  });

  if (!product) {
    redirect("/products?error=product-not-found");
  }

  await verifyAdminDeleteConfirmation({
    formData,
    adminUserId: user.id,
    redirectPath: "/products",
    requiresStrongConfirmation: product.accounts.length > 0,
  });

  try {
    await prisma.$transaction(async (tx) => {
      const accountIds = product.accounts.map((account) => account.id);

      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: "DELETE_PRODUCT",
          entity: "Product",
          entityId: product.id,
          oldValue: JSON.stringify(product),
        },
      });

      if (accountIds.length > 0) {
        await tx.payment.deleteMany({
          where: {
            accountId: {
              in: accountIds,
            },
          },
        });

        await tx.customerAccount.deleteMany({
          where: {
            id: {
              in: accountIds,
            },
          },
        });
      }

      await tx.product.delete({
        where: {
          id: product.id,
        },
      });
    });
  } catch {
    redirect("/products?error=product-delete-blocked");
  }

  revalidatePath("/products");
  redirect("/products?deleted=product");
}
