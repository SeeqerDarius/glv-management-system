"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdminRole } from "@/lib/roles";
import { verifyAdminDeleteConfirmation } from "@/lib/admin-delete";

export type ProductFormState = {
  errors?: {
    name?: string;
    category?: string;
    costPrice?: string;
    cashPrice?: string;
    layawayPrice?: string;
    dailyAmount?: string;
    duration?: string;
    form?: string;
  };
};

type ProductInput = {
  name: string;
  category: string;
  costPrice: number;
  cashPrice: number;
  layawayPrice: number;
  dailyAmount: number;
  duration: number;
};

async function requireAdmin() {
  const session = await auth();

  if (!isAdminRole(session?.user?.role) || !session?.user?.id) {
    throw new Error("Unauthorized");
  }

  return {
    id: session.user.id,
  };
}

function cleanInput(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

function parseNumber(formData: FormData, field: string) {
  const value = Number(cleanInput(formData.get(field)));
  return Number.isFinite(value) ? value : Number.NaN;
}

function validateProduct(formData: FormData): {
  data?: ProductInput;
  errors?: ProductFormState["errors"];
} {
  const name = cleanInput(formData.get("name"));
  const category = cleanInput(formData.get("category"));
  const costPrice = parseNumber(formData, "costPrice");
  const cashPrice = parseNumber(formData, "cashPrice");
  const layawayPrice = parseNumber(formData, "layawayPrice");
  const dailyAmount = parseNumber(formData, "dailyAmount");
  const duration = Number(cleanInput(formData.get("duration")));
  const errors: ProductFormState["errors"] = {};

  if (!name) errors.name = "Product name is required.";
  if (!category) errors.category = "Category is required.";
  if (!Number.isFinite(costPrice) || costPrice <= 0) {
    errors.costPrice = "Cost price must be greater than zero.";
  }
  if (!Number.isFinite(cashPrice) || cashPrice <= 0) {
    errors.cashPrice = "Cash price must be greater than zero.";
  }
  if (!Number.isFinite(layawayPrice) || layawayPrice <= 0) {
    errors.layawayPrice = "Layaway price must be greater than zero.";
  }
  if (!Number.isFinite(dailyAmount) || dailyAmount <= 0) {
    errors.dailyAmount = "Daily amount must be greater than zero.";
  }
  if (!Number.isInteger(duration) || duration <= 0) {
    errors.duration = "Duration must be a positive whole number.";
  }
  if (
    Number.isFinite(costPrice) &&
    Number.isFinite(cashPrice) &&
    cashPrice < costPrice
  ) {
    errors.cashPrice = "Cash price cannot be lower than cost price.";
  }
  if (
    Number.isFinite(costPrice) &&
    Number.isFinite(layawayPrice) &&
    layawayPrice < costPrice
  ) {
    errors.layawayPrice = "Layaway price cannot be lower than cost price.";
  }

  if (Object.keys(errors).length > 0) {
    return { errors };
  }

  return {
    data: {
      name,
      category,
      costPrice,
      cashPrice,
      layawayPrice,
      dailyAmount,
      duration,
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
  const user = await requireAdmin();
  const validated = validateProduct(formData);

  if (validated.errors || !validated.data) {
    return { errors: validated.errors };
  }

  const duplicate = await findDuplicateName(validated.data.name);

  if (duplicate) {
    return {
      errors: {
        name: "A product with this name already exists.",
      },
    };
  }

  const product = await prisma.product.create({
    data: {
      ...validated.data,
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
  redirect(`/products/${product.id}`);
}

export async function updateProduct(
  _state: ProductFormState,
  formData: FormData
): Promise<ProductFormState> {
  const user = await requireAdmin();
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
    where: {
      id,
    },
  });

  if (!existingProduct) {
    return {
      errors: {
        form: "Product record was not found.",
      },
    };
  }

  const updatedProduct = await prisma.product.update({
    where: {
      id,
    },
    data: {
      ...validated.data,
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

  revalidatePath("/products");
  revalidatePath(`/products/${id}`);
  redirect(`/products/${id}`);
}

export async function deactivateProduct(formData: FormData): Promise<void> {
  const user = await requireAdmin();
  const id = cleanInput(formData.get("id"));
  const existingProduct = await prisma.product.findUnique({
    where: {
      id,
    },
  });

  if (!existingProduct) {
    throw new Error("Product record was not found.");
  }

  const updatedProduct = await prisma.product.update({
    where: {
      id,
    },
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

  await verifyAdminDeleteConfirmation({
    formData,
    adminUserId: user.id,
    redirectPath: "/products",
  });

  const product = await prisma.product.findUnique({
    where: {
      id,
    },
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
