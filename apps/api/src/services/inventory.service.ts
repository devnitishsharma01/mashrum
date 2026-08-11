import { prisma } from "@mashrum/database";
import {
  getStockStatus,
  type AdjustInventoryInput,
  type SetInventoryInput,
} from "@mashrum/shared";
import { AppError } from "../lib/errors";

async function syncAvailability(
  businessId: string,
  productId: string,
  variantId: string | null,
  quantity: number,
) {
  if (variantId) {
    await prisma.productVariant.updateMany({
      where: { id: variantId, businessId, productId },
      data: { isAvailable: quantity > 0 },
    });
    return;
  }

  await prisma.product.updateMany({
    where: { id: productId, businessId },
    data: { isAvailable: quantity > 0 },
  });
}

async function getOrCreateInventory(
  businessId: string,
  productId: string,
  variantId: string | null,
) {
  const product = await prisma.product.findFirst({
    where: { id: productId, businessId },
    select: { id: true },
  });
  if (!product) {
    throw new AppError(404, "Product not found", "NOT_FOUND");
  }

  if (variantId) {
    const variant = await prisma.productVariant.findFirst({
      where: { id: variantId, businessId, productId },
      select: { id: true },
    });
    if (!variant) {
      throw new AppError(404, "Variant not found", "NOT_FOUND");
    }
  }

  const existing = await prisma.inventory.findFirst({
    where: {
      businessId,
      productId,
      variantId: variantId ?? null,
    },
  });
  if (existing) return existing;

  return prisma.inventory.create({
    data: {
      businessId,
      productId,
      variantId,
      quantityOnHand: 0,
    },
  });
}

function serializeInventory(row: {
  id: string;
  businessId: string;
  productId: string;
  variantId: string | null;
  quantityOnHand: number;
  product: { id: string; name: string; isAvailable: boolean; isVisible: boolean };
  variant: { id: string; name: string; sku: string | null; isAvailable: boolean } | null;
}) {
  return {
    id: row.id,
    productId: row.productId,
    variantId: row.variantId,
    quantityOnHand: row.quantityOnHand,
    stockStatus: getStockStatus(row.quantityOnHand),
    product: row.product,
    variant: row.variant,
  };
}

export async function listInventory(businessId: string) {
  const rows = await prisma.inventory.findMany({
    where: { businessId },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          isAvailable: true,
          isVisible: true,
        },
      },
      variant: {
        select: {
          id: true,
          name: true,
          sku: true,
          isAvailable: true,
        },
      },
    },
    orderBy: [{ product: { name: "asc" } }],
  });

  return rows.map(serializeInventory);
}

export async function adjustInventory(
  businessId: string,
  actorUserId: string,
  input: AdjustInventoryInput,
) {
  if (input.delta === 0) {
    throw new AppError(400, "Delta cannot be zero", "INVALID_DELTA");
  }

  const variantId = input.variantId ?? null;
  const inventory = await getOrCreateInventory(
    businessId,
    input.productId,
    variantId,
  );

  const nextQty = inventory.quantityOnHand + input.delta;
  if (nextQty < 0) {
    throw new AppError(400, "Insufficient stock", "INSUFFICIENT_STOCK");
  }

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.inventory.update({
      where: { id: inventory.id },
      data: { quantityOnHand: nextQty },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            isAvailable: true,
            isVisible: true,
          },
        },
        variant: {
          select: {
            id: true,
            name: true,
            sku: true,
            isAvailable: true,
          },
        },
      },
    });

    await tx.inventoryMovement.create({
      data: {
        businessId,
        inventoryId: row.id,
        delta: input.delta,
        reason: "ADJUSTMENT",
        note: input.note,
      },
    });

    await tx.auditLog.create({
      data: {
        businessId,
        actorUserId,
        action: "INVENTORY_ADJUSTED",
        entity: "Inventory",
        entityId: row.id,
        meta: {
          productId: input.productId,
          variantId,
          delta: input.delta,
          quantityOnHand: nextQty,
        },
      },
    });

    return row;
  });

  await syncAvailability(businessId, input.productId, variantId, nextQty);
  const refreshed = await prisma.inventory.findFirstOrThrow({
    where: { id: updated.id },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          isAvailable: true,
          isVisible: true,
        },
      },
      variant: {
        select: {
          id: true,
          name: true,
          sku: true,
          isAvailable: true,
        },
      },
    },
  });
  return serializeInventory(refreshed);
}

export async function setInventoryQuantity(
  businessId: string,
  actorUserId: string,
  input: SetInventoryInput,
) {
  const variantId = input.variantId ?? null;
  const inventory = await getOrCreateInventory(
    businessId,
    input.productId,
    variantId,
  );
  const delta = input.quantity - inventory.quantityOnHand;

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.inventory.update({
      where: { id: inventory.id },
      data: { quantityOnHand: input.quantity },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            isAvailable: true,
            isVisible: true,
          },
        },
        variant: {
          select: {
            id: true,
            name: true,
            sku: true,
            isAvailable: true,
          },
        },
      },
    });

    if (delta !== 0) {
      await tx.inventoryMovement.create({
        data: {
          businessId,
          inventoryId: row.id,
          delta,
          reason: "MANUAL_SET",
          note: input.note,
        },
      });
    }

    await tx.auditLog.create({
      data: {
        businessId,
        actorUserId,
        action: "INVENTORY_SET",
        entity: "Inventory",
        entityId: row.id,
        meta: {
          productId: input.productId,
          variantId,
          quantity: input.quantity,
        },
      },
    });

    return row;
  });

  await syncAvailability(
    businessId,
    input.productId,
    variantId,
    input.quantity,
  );
  const refreshed = await prisma.inventory.findFirstOrThrow({
    where: { id: updated.id },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          isAvailable: true,
          isVisible: true,
        },
      },
      variant: {
        select: {
          id: true,
          name: true,
          sku: true,
          isAvailable: true,
        },
      },
    },
  });
  return serializeInventory(refreshed);
}

export async function ensureInventoryRecord(
  businessId: string,
  productId: string,
  variantId: string | null,
  initialStock: number,
) {
  return prisma.inventory.create({
    data: {
      businessId,
      productId,
      variantId,
      quantityOnHand: initialStock,
      movements:
        initialStock !== 0
          ? {
              create: {
                businessId,
                delta: initialStock,
                reason: "MANUAL_SET",
                note: "Initial stock",
              },
            }
          : undefined,
    },
  });
}
