import { prisma, type OrderStatus, type Prisma } from "@mashrum/database";
import {
  KANBAN_COLUMNS,
  canTransition,
  getAllowedTransitions,
  shouldDeductInventory,
  shouldRestoreInventory,
  type CreateOrderInput,
  type TransitionOrderInput,
  type UpdatePaymentInput,
} from "@mashrum/shared";
import { AppError } from "../lib/errors";
import { enqueue } from "../lib/queue";
import { toNumber } from "../lib/money";

type ListFilters = {
  q?: string;
  status?: OrderStatus;
  paymentStatus?: "PENDING" | "COLLECTED" | "FAILED" | "CANCELLED";
  view?: "list" | "kanban";
};

function serializeOrder<T extends { total: unknown; subtotal: unknown }>(
  order: T,
) {
  return {
    ...order,
    subtotal: toNumber(order.subtotal as never),
    total: toNumber(order.total as never),
  };
}

async function nextOrderNumber(businessId: string, tx: Prisma.TransactionClient) {
  const count = await tx.order.count({ where: { businessId } });
  return `ORD-${1001 + count}`;
}

const orderDetailInclude = {
  customer: {
    select: { id: true, name: true, waId: true },
  },
  items: {
    include: {
      product: { select: { id: true, name: true } },
      variant: { select: { id: true, name: true, sku: true } },
    },
  },
  timeline: { orderBy: { createdAt: "asc" as const } },
  payment: true,
} satisfies Prisma.OrderInclude;

async function getOrderOrThrow(businessId: string, orderId: string) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, businessId },
    include: orderDetailInclude,
  });
  if (!order) {
    throw new AppError(404, "Order not found", "NOT_FOUND");
  }
  return {
    ...serializeOrder(order),
    items: order.items.map((item) => ({
      ...item,
      unitPrice: toNumber(item.unitPrice),
      lineTotal: toNumber(item.lineTotal),
    })),
    payment: order.payment
      ? { ...order.payment, amount: toNumber(order.payment.amount) }
      : null,
    allowedTransitions: getAllowedTransitions(order.status),
  };
}

async function applyInventoryDelta(
  tx: Prisma.TransactionClient,
  businessId: string,
  orderId: string,
  items: Array<{
    productId: string | null;
    variantId: string | null;
    qty: number;
  }>,
  direction: "DEDUCT" | "RESTORE",
) {
  for (const item of items) {
    if (!item.productId) continue;
    const inventory = await tx.inventory.findFirst({
      where: {
        businessId,
        productId: item.productId,
        variantId: item.variantId ?? null,
      },
    });
    if (!inventory) {
      throw new AppError(
        400,
        "Inventory record missing for order item",
        "INVENTORY_MISSING",
      );
    }

    const delta = direction === "DEDUCT" ? -item.qty : item.qty;
    const nextQty = inventory.quantityOnHand + delta;
    if (nextQty < 0) {
      throw new AppError(400, "Insufficient stock", "INSUFFICIENT_STOCK");
    }

    await tx.inventory.update({
      where: { id: inventory.id },
      data: { quantityOnHand: nextQty },
    });

    await tx.inventoryMovement.create({
      data: {
        businessId,
        inventoryId: inventory.id,
        delta,
        reason:
          direction === "DEDUCT" ? "ORDER_CONFIRM" : "ORDER_CANCEL_RESTORE",
        refType: "Order",
        refId: orderId,
      },
    });

    if (item.variantId) {
      await tx.productVariant.updateMany({
        where: {
          id: item.variantId,
          businessId,
          productId: item.productId,
        },
        data: { isAvailable: nextQty > 0 },
      });
    } else {
      await tx.product.updateMany({
        where: { id: item.productId, businessId },
        data: { isAvailable: nextQty > 0 },
      });
    }
  }
}

export async function listOrders(businessId: string, filters: ListFilters) {
  const where: Prisma.OrderWhereInput = {
    businessId,
    status: filters.status,
    paymentStatus: filters.paymentStatus,
    ...(filters.q
      ? {
          OR: [
            { orderNumber: { contains: filters.q, mode: "insensitive" } },
            {
              customer: {
                OR: [
                  { name: { contains: filters.q, mode: "insensitive" } },
                  { waId: { contains: filters.q } },
                ],
              },
            },
          ],
        }
      : {}),
  };

  const orders = await prisma.order.findMany({
    where,
    include: {
      customer: { select: { id: true, name: true, waId: true } },
      payment: true,
      _count: { select: { items: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const serialized = orders.map((order) => ({
    ...serializeOrder(order),
    payment: order.payment
      ? { ...order.payment, amount: toNumber(order.payment.amount) }
      : null,
    allowedTransitions: getAllowedTransitions(order.status),
  }));

  if (filters.view === "kanban") {
    const columns = Object.fromEntries(
      KANBAN_COLUMNS.map((status) => [status, [] as typeof serialized]),
    ) as Record<(typeof KANBAN_COLUMNS)[number], typeof serialized>;

    for (const order of serialized) {
      if (order.status in columns) {
        columns[order.status as (typeof KANBAN_COLUMNS)[number]].push(order);
      }
    }
    return { view: "kanban" as const, columns };
  }

  return { view: "list" as const, orders: serialized };
}

export async function getOrder(businessId: string, orderId: string) {
  return getOrderOrThrow(businessId, orderId);
}

export async function createOrder(
  businessId: string,
  actorUserId: string | null,
  input: CreateOrderInput,
) {
  const customer = await prisma.customer.findFirst({
    where: { id: input.customerId, businessId },
    include: { addresses: true },
  });
  if (!customer) {
    throw new AppError(404, "Customer not found", "NOT_FOUND");
  }

  let deliveryAddress = input.deliveryAddress ?? null;
  if (input.addressId) {
    const address = customer.addresses.find((a) => a.id === input.addressId);
    if (!address) {
      throw new AppError(400, "Address not found", "INVALID_ADDRESS");
    }
    deliveryAddress = {
      line1: address.line1,
      landmark: address.landmark,
      city: address.city,
    };
  } else if (!deliveryAddress) {
    const fallback =
      customer.addresses.find((a) => a.isDefault) ?? customer.addresses[0];
    if (fallback) {
      deliveryAddress = {
        line1: fallback.line1,
        landmark: fallback.landmark,
        city: fallback.city,
      };
    }
  }

  const lineInputs: Array<{
    productId: string;
    variantId: string | null;
    nameSnapshot: string;
    qty: number;
    unitPrice: number;
    lineTotal: number;
  }> = [];
  for (const item of input.items) {
    const product = await prisma.product.findFirst({
      where: { id: item.productId, businessId },
    });
    if (!product) {
      throw new AppError(400, "Product not found", "INVALID_PRODUCT");
    }
    if (!product.isAvailable || !product.isVisible) {
      throw new AppError(
        400,
        `Product "${product.name}" is unavailable`,
        "PRODUCT_UNAVAILABLE",
      );
    }

    let unitPrice = toNumber(product.basePrice);
    let nameSnapshot = product.name;
    let variantId: string | null = item.variantId ?? null;

    if (variantId) {
      const variant = await prisma.productVariant.findFirst({
        where: { id: variantId, businessId, productId: product.id },
      });
      if (!variant || !variant.isAvailable) {
        throw new AppError(400, "Variant unavailable", "VARIANT_UNAVAILABLE");
      }
      unitPrice = toNumber(variant.price);
      nameSnapshot = `${product.name} · ${variant.name}`;
    }

    const inventory = await prisma.inventory.findFirst({
      where: {
        businessId,
        productId: product.id,
        variantId,
      },
    });
    if (!inventory || inventory.quantityOnHand < item.qty) {
      throw new AppError(
        400,
        `Insufficient stock for ${nameSnapshot}`,
        "INSUFFICIENT_STOCK",
      );
    }

    lineInputs.push({
      productId: product.id,
      variantId,
      nameSnapshot,
      qty: item.qty,
      unitPrice,
      lineTotal: unitPrice * item.qty,
    });
  }

  const subtotal = lineInputs.reduce((sum, line) => sum + line.lineTotal, 0);
  const total = subtotal;

  const order = await prisma.$transaction(async (tx) => {
    const orderNumber = await nextOrderNumber(businessId, tx);
    const created = await tx.order.create({
      data: {
        businessId,
        customerId: customer.id,
        orderNumber,
        status: "NEW",
        paymentMethod: "COD",
        paymentStatus: "PENDING",
        subtotal,
        total,
        notes: input.notes ?? null,
        deliveryAddressSnapshot: deliveryAddress ?? undefined,
        stockReserved: false,
        items: {
          create: lineInputs,
        },
        timeline: {
          create: {
            fromStatus: null,
            toStatus: "NEW",
            actorType: actorUserId ? "USER" : "CUSTOMER",
            actorId: actorUserId,
            note: actorUserId ? "Order created" : "Order created via WhatsApp",
          },
        },
        payment: {
          create: {
            businessId,
            method: "COD",
            status: "PENDING",
            amount: total,
          },
        },
      },
    });

    await tx.auditLog.create({
      data: {
        businessId,
        actorUserId: actorUserId ?? undefined,
        action: "ORDER_CREATED",
        entity: "Order",
        entityId: created.id,
        meta: { orderNumber, source: actorUserId ? "ADMIN" : "WHATSAPP" },
      },
    });

    return created;
  });

  return getOrderOrThrow(businessId, order.id);
}

export async function transitionOrder(
  businessId: string,
  actorUserId: string,
  orderId: string,
  input: TransitionOrderInput,
) {
  const existing = await prisma.order.findFirst({
    where: { id: orderId, businessId },
    include: { items: true, payment: true },
  });
  if (!existing) {
    throw new AppError(404, "Order not found", "NOT_FOUND");
  }

  if (!canTransition(existing.status, input.status)) {
    throw new AppError(
      400,
      `Cannot transition from ${existing.status} to ${input.status}`,
      "INVALID_TRANSITION",
    );
  }

  if (input.status === "COMPLETED") {
    const paymentStatus = existing.payment?.status ?? existing.paymentStatus;
    if (paymentStatus !== "COLLECTED") {
      throw new AppError(
        400,
        "Mark COD as collected before completing the order",
        "PAYMENT_REQUIRED",
      );
    }
  }

  await prisma.$transaction(async (tx) => {
    let stockReserved = existing.stockReserved;
    let paymentStatus = existing.paymentStatus;

    if (shouldDeductInventory(existing.status, input.status)) {
      await applyInventoryDelta(
        tx,
        businessId,
        orderId,
        existing.items,
        "DEDUCT",
      );
      stockReserved = true;
    }

    if (
      shouldRestoreInventory(
        existing.status,
        input.status,
        existing.stockReserved,
      )
    ) {
      await applyInventoryDelta(
        tx,
        businessId,
        orderId,
        existing.items,
        "RESTORE",
      );
      stockReserved = false;
      paymentStatus = "CANCELLED";
      if (existing.payment) {
        await tx.payment.update({
          where: { id: existing.payment.id },
          data: { status: "CANCELLED" },
        });
      }
    }

    if (input.status === "CANCELLED" && !existing.stockReserved) {
      paymentStatus = "CANCELLED";
      if (existing.payment) {
        await tx.payment.update({
          where: { id: existing.payment.id },
          data: { status: "CANCELLED" },
        });
      }
    }

    await tx.order.update({
      where: { id: orderId },
      data: {
        status: input.status,
        stockReserved,
        paymentStatus,
      },
    });

    await tx.orderTimeline.create({
      data: {
        orderId,
        fromStatus: existing.status,
        toStatus: input.status,
        actorType: "USER",
        actorId: actorUserId,
        note: input.note ?? null,
      },
    });

    await tx.auditLog.create({
      data: {
        businessId,
        actorUserId,
        action: "ORDER_STATUS_CHANGED",
        entity: "Order",
        entityId: orderId,
        meta: {
          from: existing.status,
          to: input.status,
          note: input.note,
        },
      },
    });
  });

  enqueue("whatsapp.order_status", {
    businessId,
    orderId,
    orderNumber: existing.orderNumber,
    status: input.status,
    customerId: existing.customerId,
  });

  return getOrderOrThrow(businessId, orderId);
}

export async function updateOrderPayment(
  businessId: string,
  actorUserId: string,
  orderId: string,
  input: UpdatePaymentInput,
) {
  const existing = await prisma.order.findFirst({
    where: { id: orderId, businessId },
    include: { payment: true },
  });
  if (!existing) {
    throw new AppError(404, "Order not found", "NOT_FOUND");
  }
  if (!existing.payment) {
    throw new AppError(400, "Payment record missing", "PAYMENT_MISSING");
  }
  if (existing.status === "CANCELLED") {
    throw new AppError(400, "Cannot update payment on cancelled order", "INVALID");
  }

  await prisma.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: existing.payment!.id },
      data: {
        status: input.status,
        collectedAt: input.status === "COLLECTED" ? new Date() : null,
      },
    });
    await tx.order.update({
      where: { id: orderId },
      data: { paymentStatus: input.status },
    });
    await tx.auditLog.create({
      data: {
        businessId,
        actorUserId,
        action: "PAYMENT_UPDATED",
        entity: "Payment",
        entityId: existing.payment!.id,
        meta: { orderId, status: input.status },
      },
    });
  });

  return getOrderOrThrow(businessId, orderId);
}
