import { prisma } from "@mashrum/database";
import { AppError } from "../lib/errors";
import { toNumber } from "../lib/money";

export async function getOrCreateActiveCart(
  businessId: string,
  customerId: string,
) {
  const existing = await prisma.cart.findFirst({
    where: { businessId, customerId, status: "ACTIVE" },
    include: {
      items: {
        include: {
          product: { select: { id: true, name: true } },
          variant: { select: { id: true, name: true } },
        },
      },
    },
  });
  if (existing) return existing;

  return prisma.cart.create({
    data: { businessId, customerId, status: "ACTIVE" },
    include: {
      items: {
        include: {
          product: { select: { id: true, name: true } },
          variant: { select: { id: true, name: true } },
        },
      },
    },
  });
}

export async function addToCart(params: {
  businessId: string;
  customerId: string;
  productId: string;
  variantId?: string | null;
  qty: number;
}) {
  const product = await prisma.product.findFirst({
    where: {
      id: params.productId,
      businessId: params.businessId,
      isAvailable: true,
      isVisible: true,
    },
  });
  if (!product) {
    throw new AppError(400, "Product unavailable", "PRODUCT_UNAVAILABLE");
  }

  let unitPrice = toNumber(product.basePrice);
  const variantId = params.variantId ?? null;
  if (variantId) {
    const variant = await prisma.productVariant.findFirst({
      where: {
        id: variantId,
        businessId: params.businessId,
        productId: product.id,
        isAvailable: true,
      },
    });
    if (!variant) {
      throw new AppError(400, "Variant unavailable", "VARIANT_UNAVAILABLE");
    }
    unitPrice = toNumber(variant.price);
  }

  const inventory = await prisma.inventory.findFirst({
    where: {
      businessId: params.businessId,
      productId: product.id,
      variantId,
    },
  });
  if (!inventory || inventory.quantityOnHand < params.qty) {
    throw new AppError(400, "Insufficient stock", "INSUFFICIENT_STOCK");
  }

  const cart = await getOrCreateActiveCart(params.businessId, params.customerId);
  const existingItem = await prisma.cartItem.findFirst({
    where: {
      cartId: cart.id,
      productId: product.id,
      variantId,
    },
  });

  if (existingItem) {
    const nextQty = existingItem.qty + params.qty;
    if (inventory.quantityOnHand < nextQty) {
      throw new AppError(400, "Insufficient stock", "INSUFFICIENT_STOCK");
    }
    await prisma.cartItem.update({
      where: { id: existingItem.id },
      data: { qty: nextQty, unitPrice },
    });
  } else {
    await prisma.cartItem.create({
      data: {
        cartId: cart.id,
        productId: product.id,
        variantId,
        qty: params.qty,
        unitPrice,
      },
    });
  }

  return getOrCreateActiveCart(params.businessId, params.customerId);
}

export function formatCartText(
  cart: Awaited<ReturnType<typeof getOrCreateActiveCart>>,
  currency = "INR",
): string {
  if (cart.items.length === 0) {
    return "Your cart is empty. Reply *menu* to browse products.";
  }

  const lines = cart.items.map((item, index) => {
    const name = item.variant
      ? `${item.product.name} · ${item.variant.name}`
      : item.product.name;
    const lineTotal = toNumber(item.unitPrice) * item.qty;
    return `${index + 1}. ${name} x${item.qty} = ${currency} ${lineTotal.toFixed(2)}`;
  });
  const total = cart.items.reduce(
    (sum, item) => sum + toNumber(item.unitPrice) * item.qty,
    0,
  );

  return [
    "*Your cart*",
    ...lines,
    "",
    `Total: ${currency} ${total.toFixed(2)}`,
    "",
    "Reply *checkout* to place order, or *menu* to add more.",
  ].join("\n");
}

export async function clearCart(businessId: string, customerId: string) {
  const cart = await prisma.cart.findFirst({
    where: { businessId, customerId, status: "ACTIVE" },
  });
  if (!cart) return;
  await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
}

export async function markCartConverted(cartId: string) {
  await prisma.cart.update({
    where: { id: cartId },
    data: { status: "CONVERTED" },
  });
}
