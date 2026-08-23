"use strict";

const { docToObject, toId } = require("../db");
const { Cart, Product, ProductVariant, Inventory } = require("../models");
const { AppError } = require("../lib/errors");
const { toNumber } = require("../lib/money");

async function enrichCartItems(items) {
  if (items.length === 0) return [];

  const productIds = [...new Set(items.map((i) => i.productId.toString()))];
  const variantIds = items.filter((i) => i.variantId).map((i) => i.variantId);

  const [products, variants] = await Promise.all([
    Product.find({ _id: { $in: productIds.map(toId) } })
      .select("name")
      .lean(),
    variantIds.length
      ? ProductVariant.find({ _id: { $in: variantIds } })
          .select("name")
          .lean()
      : [],
  ]);

  const productMap = new Map(products.map((p) => [p._id.toString(), p.name]));
  const variantMap = new Map(variants.map((v) => [v._id.toString(), v.name]));

  return items.map((item) => {
    const productId = item.productId.toString();
    const variantId = item.variantId ? item.variantId.toString() : null;
    return {
      id: item._id?.toString(),
      productId,
      variantId,
      qty: item.qty,
      unitPrice: item.unitPrice,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      product: { id: productId, name: productMap.get(productId) || "" },
      variant: variantId ? { id: variantId, name: variantMap.get(variantId) || "" } : null,
    };
  });
}

async function formatCart(cartDoc) {
  const cart = docToObject(cartDoc);
  cart.items = await enrichCartItems(cartDoc.items || []);
  return cart;
}

async function getOrCreateActiveCart(businessId, customerId) {
  let cartDoc = await Cart.findOne({
    businessId: toId(businessId),
    customerId: toId(customerId),
    status: "ACTIVE",
  });

  if (!cartDoc) {
    cartDoc = await Cart.create({
      businessId: toId(businessId),
      customerId: toId(customerId),
      status: "ACTIVE",
      items: [],
    });
  }

  return formatCart(cartDoc);
}

async function addToCart(params) {
  const productDoc = await Product.findOne({
    _id: toId(params.productId),
    businessId: toId(params.businessId),
    isAvailable: true,
    isVisible: true,
  });
  if (!productDoc) {
    throw new AppError(400, "Product unavailable", "PRODUCT_UNAVAILABLE");
  }

  let unitPrice = toNumber(productDoc.basePrice);
  const variantId = params.variantId ?? null;

  if (variantId) {
    const variantDoc = await ProductVariant.findOne({
      _id: toId(variantId),
      businessId: toId(params.businessId),
      productId: productDoc._id,
      isAvailable: true,
    });
    if (!variantDoc) {
      throw new AppError(400, "Variant unavailable", "VARIANT_UNAVAILABLE");
    }
    unitPrice = toNumber(variantDoc.price);
  }

  const inventoryQuery = {
    businessId: toId(params.businessId),
    productId: productDoc._id,
    variantId: variantId ? toId(variantId) : null,
  };
  const inventory = await Inventory.findOne(inventoryQuery);

  if (!inventory || inventory.quantityOnHand < params.qty) {
    throw new AppError(400, "Insufficient stock", "INSUFFICIENT_STOCK");
  }

  const cart = await getOrCreateActiveCart(params.businessId, params.customerId);
  const cartDoc = await Cart.findById(toId(cart.id));

  const existingItem = cartDoc.items.find(
    (item) =>
      item.productId.toString() === productDoc._id.toString() &&
      (item.variantId?.toString() || null) === (variantId ? toId(variantId).toString() : null),
  );

  if (existingItem) {
    const nextQty = existingItem.qty + params.qty;
    if (inventory.quantityOnHand < nextQty) {
      throw new AppError(400, "Insufficient stock", "INSUFFICIENT_STOCK");
    }
    existingItem.qty = nextQty;
    existingItem.unitPrice = unitPrice;
  } else {
    cartDoc.items.push({
      productId: productDoc._id,
      variantId: variantId ? toId(variantId) : null,
      qty: params.qty,
      unitPrice,
    });
  }

  await cartDoc.save();
  return getOrCreateActiveCart(params.businessId, params.customerId);
}

function formatCartText(cart, currency = "INR") {
  if (cart.items.length === 0) {
    return "Your cart is empty. Reply with *menu* to browse products.";
  }

  const lines = cart.items.map((item, index) => {
    const name = item.variant
      ? `${item.product.name} · ${item.variant.name}`
      : item.product.name;
    const lineTotal = toNumber(item.unitPrice) * item.qty;
    return `${index + 1}. ${name} x${item.qty} = ${currency} ${lineTotal.toFixed(2)}`;
  });

  const total = cart.items.reduce((sum, item) => sum + toNumber(item.unitPrice) * item.qty, 0);

  return [
    "*Your cart*",
    ...lines,
    "",
    `Total: ${currency} ${total.toFixed(2)}`,
    "",
    "Reply *checkout* to place order, or *menu* to add more.",
  ].join("\n");
}

async function clearCart(businessId, customerId) {
  const cartDoc = await Cart.findOne({
    businessId: toId(businessId),
    customerId: toId(customerId),
    status: "ACTIVE",
  });
  if (!cartDoc) return;
  cartDoc.items = [];
  await cartDoc.save();
}

async function markCartConverted(cartId) {
  await Cart.updateOne({ _id: toId(cartId) }, { status: "CONVERTED" });
}

module.exports = {
  getOrCreateActiveCart,
  addToCart,
  formatCartText,
  clearCart,
  markCartConverted,
};
