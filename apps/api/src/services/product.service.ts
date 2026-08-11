import { prisma } from "@mashrum/database";
import {
  getStockStatus,
  type CreateProductInput,
  type CreateVariantInput,
  type UpdateProductInput,
  type UpdateVariantInput,
} from "@mashrum/shared";
import { AppError } from "../lib/errors";
import { toNumber } from "../lib/money";

type ListFilters = {
  q?: string;
  categoryId?: string;
  isVisible?: boolean;
  isAvailable?: boolean;
};

function serializeProduct<
  T extends {
    basePrice: { toString(): string } | number;
    variants?: Array<{
      price: { toString(): string } | number;
      inventory?: Array<{ quantityOnHand: number }>;
    }>;
    inventory?: Array<{ quantityOnHand: number; variantId: string | null }>;
  },
>(product: T) {
  const baseInventory =
    product.inventory?.find((i) => i.variantId === null)?.quantityOnHand ??
    product.inventory?.[0]?.quantityOnHand;
  const quantityOnHand =
    baseInventory ??
    product.inventory?.reduce((sum, i) => sum + i.quantityOnHand, 0) ??
    0;

  return {
    ...product,
    basePrice: toNumber(product.basePrice),
    quantityOnHand,
    stockStatus: getStockStatus(quantityOnHand),
    variants: product.variants?.map((variant) => {
      const qty = variant.inventory?.[0]?.quantityOnHand ?? 0;
      return {
        ...variant,
        price: toNumber(variant.price),
        quantityOnHand: qty,
        stockStatus: getStockStatus(qty),
      };
    }),
  };
}

async function assertCategory(
  businessId: string,
  categoryId: string | null | undefined,
) {
  if (!categoryId) return;
  const category = await prisma.category.findFirst({
    where: { id: categoryId, businessId },
    select: { id: true },
  });
  if (!category) {
    throw new AppError(400, "Category not found", "INVALID_CATEGORY");
  }
}

export async function listProducts(businessId: string, filters: ListFilters) {
  const products = await prisma.product.findMany({
    where: {
      businessId,
      categoryId: filters.categoryId,
      isVisible: filters.isVisible,
      isAvailable: filters.isAvailable,
      ...(filters.q
        ? {
            OR: [
              { name: { contains: filters.q, mode: "insensitive" } },
              { description: { contains: filters.q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: {
      category: { select: { id: true, name: true } },
      variants: {
        orderBy: { createdAt: "asc" },
        include: {
          inventory: {
            where: { businessId },
            select: { quantityOnHand: true },
          },
        },
      },
      inventory: {
        where: { businessId },
        select: { quantityOnHand: true, variantId: true },
      },
    },
    orderBy: [{ createdAt: "desc" }],
  });

  return products.map((p) => serializeProduct(p));
}

export async function getProduct(businessId: string, productId: string) {
  const product = await prisma.product.findFirst({
    where: { id: productId, businessId },
    include: {
      category: { select: { id: true, name: true } },
      variants: {
        orderBy: { createdAt: "asc" },
        include: {
          inventory: {
            where: { businessId },
            select: { quantityOnHand: true },
          },
        },
      },
      inventory: {
        where: { businessId },
        select: { quantityOnHand: true, variantId: true },
      },
    },
  });

  if (!product) {
    throw new AppError(404, "Product not found", "NOT_FOUND");
  }

  return serializeProduct(product);
}

export async function createProduct(
  businessId: string,
  actorUserId: string,
  input: CreateProductInput,
) {
  await assertCategory(businessId, input.categoryId);

  const initialStock = input.initialStock ?? 0;
  const isAvailable =
    input.isAvailable !== undefined ? input.isAvailable : initialStock > 0;

  const product = await prisma.$transaction(async (tx) => {
    const created = await tx.product.create({
      data: {
        businessId,
        categoryId: input.categoryId ?? null,
        name: input.name,
        description: input.description ?? null,
        basePrice: input.basePrice,
        isAvailable,
        isVisible: input.isVisible ?? true,
        imageUrl: input.imageUrl ?? null,
      },
    });

    await tx.inventory.create({
      data: {
        businessId,
        productId: created.id,
        variantId: null,
        quantityOnHand: initialStock,
        movements:
          initialStock > 0
            ? {
                create: {
                  businessId,
                  delta: initialStock,
                  reason: "MANUAL_SET",
                  note: input.sku
                    ? `Initial stock (SKU: ${input.sku})`
                    : "Initial stock",
                },
              }
            : undefined,
      },
    });

    await tx.auditLog.create({
      data: {
        businessId,
        actorUserId,
        action: "PRODUCT_CREATED",
        entity: "Product",
        entityId: created.id,
        meta: { sku: input.sku, initialStock },
      },
    });

    return created;
  });

  return getProduct(businessId, product.id);
}

export async function updateProduct(
  businessId: string,
  actorUserId: string,
  productId: string,
  input: UpdateProductInput,
) {
  const existing = await prisma.product.findFirst({
    where: { id: productId, businessId },
  });
  if (!existing) {
    throw new AppError(404, "Product not found", "NOT_FOUND");
  }

  if (input.categoryId !== undefined) {
    await assertCategory(businessId, input.categoryId);
  }

  await prisma.product.update({
    where: { id: productId },
    data: {
      name: input.name,
      description: input.description,
      categoryId: input.categoryId,
      basePrice: input.basePrice,
      isAvailable: input.isAvailable,
      isVisible: input.isVisible,
      imageUrl: input.imageUrl,
    },
  });

  await prisma.auditLog.create({
    data: {
      businessId,
      actorUserId,
      action: "PRODUCT_UPDATED",
      entity: "Product",
      entityId: productId,
      meta: input,
    },
  });

  return getProduct(businessId, productId);
}

export async function deleteProduct(
  businessId: string,
  actorUserId: string,
  productId: string,
) {
  const existing = await prisma.product.findFirst({
    where: { id: productId, businessId },
    include: { _count: { select: { orderItems: true } } },
  });
  if (!existing) {
    throw new AppError(404, "Product not found", "NOT_FOUND");
  }

  if (existing._count.orderItems > 0) {
    // Soft-hide instead of hard delete when referenced by orders
    await prisma.product.update({
      where: { id: productId },
      data: { isVisible: false, isAvailable: false },
    });
    await prisma.auditLog.create({
      data: {
        businessId,
        actorUserId,
        action: "PRODUCT_ARCHIVED",
        entity: "Product",
        entityId: productId,
      },
    });
    return { success: true, archived: true };
  }

  await prisma.product.delete({ where: { id: productId } });
  await prisma.auditLog.create({
    data: {
      businessId,
      actorUserId,
      action: "PRODUCT_DELETED",
      entity: "Product",
      entityId: productId,
    },
  });
  return { success: true, archived: false };
}

export async function createVariant(
  businessId: string,
  actorUserId: string,
  productId: string,
  input: CreateVariantInput,
) {
  const product = await prisma.product.findFirst({
    where: { id: productId, businessId },
    select: { id: true },
  });
  if (!product) {
    throw new AppError(404, "Product not found", "NOT_FOUND");
  }

  const initialStock = input.initialStock ?? 0;

  const variant = await prisma.$transaction(async (tx) => {
    const created = await tx.productVariant.create({
      data: {
        businessId,
        productId,
        name: input.name,
        sku: input.sku ?? null,
        price: input.price,
        isAvailable:
          input.isAvailable ?? (initialStock > 0 || input.isAvailable === true),
      },
    });

    await tx.inventory.create({
      data: {
        businessId,
        productId,
        variantId: created.id,
        quantityOnHand: initialStock,
        movements:
          initialStock > 0
            ? {
                create: {
                  businessId,
                  delta: initialStock,
                  reason: "MANUAL_SET",
                  note: "Initial variant stock",
                },
              }
            : undefined,
      },
    });

    if (initialStock === 0 && input.isAvailable === undefined) {
      await tx.productVariant.update({
        where: { id: created.id },
        data: { isAvailable: false },
      });
    }

    await tx.auditLog.create({
      data: {
        businessId,
        actorUserId,
        action: "VARIANT_CREATED",
        entity: "ProductVariant",
        entityId: created.id,
        meta: { productId, initialStock },
      },
    });

    return created;
  });

  return getProduct(businessId, productId).then((p) => ({
    product: p,
    variantId: variant.id,
  }));
}

export async function updateVariant(
  businessId: string,
  actorUserId: string,
  productId: string,
  variantId: string,
  input: UpdateVariantInput,
) {
  const existing = await prisma.productVariant.findFirst({
    where: { id: variantId, businessId, productId },
  });
  if (!existing) {
    throw new AppError(404, "Variant not found", "NOT_FOUND");
  }

  await prisma.productVariant.update({
    where: { id: variantId },
    data: {
      name: input.name,
      sku: input.sku,
      price: input.price,
      isAvailable: input.isAvailable,
    },
  });

  await prisma.auditLog.create({
    data: {
      businessId,
      actorUserId,
      action: "VARIANT_UPDATED",
      entity: "ProductVariant",
      entityId: variantId,
      meta: input,
    },
  });

  return getProduct(businessId, productId);
}

export async function deleteVariant(
  businessId: string,
  actorUserId: string,
  productId: string,
  variantId: string,
) {
  const existing = await prisma.productVariant.findFirst({
    where: { id: variantId, businessId, productId },
    include: { _count: { select: { orderItems: true } } },
  });
  if (!existing) {
    throw new AppError(404, "Variant not found", "NOT_FOUND");
  }

  if (existing._count.orderItems > 0) {
    await prisma.productVariant.update({
      where: { id: variantId },
      data: { isAvailable: false },
    });
    await prisma.auditLog.create({
      data: {
        businessId,
        actorUserId,
        action: "VARIANT_ARCHIVED",
        entity: "ProductVariant",
        entityId: variantId,
      },
    });
    return getProduct(businessId, productId);
  }

  await prisma.productVariant.delete({ where: { id: variantId } });
  await prisma.auditLog.create({
    data: {
      businessId,
      actorUserId,
      action: "VARIANT_DELETED",
      entity: "ProductVariant",
      entityId: variantId,
    },
  });

  return getProduct(businessId, productId);
}
