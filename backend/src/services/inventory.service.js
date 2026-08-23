"use strict";

const { docToObject, withTransaction, sessionOpts, toId } = require("../db");
const {
  Product,
  ProductVariant,
  Inventory,
  InventoryMovement,
  AuditLog,
} = require("../models");
const { getStockStatus } = require("../shared");
const { AppError } = require("../lib/errors");

async function syncAvailability(businessId, productId, variantId, quantity) {
  if (variantId) {
    await ProductVariant.updateOne(
      { _id: toId(variantId), businessId: toId(businessId), productId: toId(productId) },
      { isAvailable: quantity > 0 },
    );
    return;
  }

  await Product.updateOne(
    { _id: toId(productId), businessId: toId(businessId) },
    { isAvailable: quantity > 0 },
  );
}

async function getOrCreateInventory(businessId, productId, variantId) {
  const product = await Product.findOne({
    _id: toId(productId),
    businessId: toId(businessId),
  })
    .select("_id")
    .lean();
  if (!product) {
    throw new AppError(404, "Product not found", "NOT_FOUND");
  }

  if (variantId) {
    const variant = await ProductVariant.findOne({
      _id: toId(variantId),
      businessId: toId(businessId),
      productId: toId(productId),
    })
      .select("_id")
      .lean();
    if (!variant) {
      throw new AppError(404, "Variant not found", "NOT_FOUND");
    }
  }

  const query = {
    businessId: toId(businessId),
    productId: toId(productId),
    variantId: variantId ? toId(variantId) : null,
  };

  let existing = await Inventory.findOne(query);
  if (existing) return docToObject(existing);

  existing = await Inventory.create({
    businessId: toId(businessId),
    productId: toId(productId),
    variantId: variantId ? toId(variantId) : null,
    quantityOnHand: 0,
  });
  return docToObject(existing);
}

function serializeInventory(row, product, variant) {
  return {
    id: row.id,
    productId: row.productId,
    variantId: row.variantId,
    quantityOnHand: row.quantityOnHand,
    stockStatus: getStockStatus(row.quantityOnHand),
    product: product
      ? {
          id: product.id,
          name: product.name,
          isAvailable: product.isAvailable,
          isVisible: product.isVisible,
        }
      : null,
    variant: variant
      ? {
          id: variant.id,
          name: variant.name,
          sku: variant.sku,
          isAvailable: variant.isAvailable,
        }
      : null,
  };
}

async function loadInventoryRow(inventoryId) {
  const invDoc = await Inventory.findById(toId(inventoryId));
  if (!invDoc) {
    throw new AppError(404, "Inventory not found", "NOT_FOUND");
  }

  const [productDoc, variantDoc] = await Promise.all([
    Product.findById(invDoc.productId).select("name isAvailable isVisible"),
    invDoc.variantId
      ? ProductVariant.findById(invDoc.variantId).select("name sku isAvailable")
      : null,
  ]);

  const inv = docToObject(invDoc);
  return serializeInventory(
    inv,
    productDoc ? docToObject(productDoc) : null,
    variantDoc ? docToObject(variantDoc) : null,
  );
}

async function listInventory(businessId) {
  const rows = await Inventory.find({ businessId: toId(businessId) }).lean();
  const productIds = [...new Set(rows.map((r) => r.productId.toString()))];
  const variantIds = rows.filter((r) => r.variantId).map((r) => r.variantId);

  const [products, variants] = await Promise.all([
    Product.find({ _id: { $in: productIds.map(toId) } })
      .select("name isAvailable isVisible")
      .lean(),
    variantIds.length
      ? ProductVariant.find({ _id: { $in: variantIds } })
          .select("name sku isAvailable")
          .lean()
      : [],
  ]);

  const productMap = new Map(products.map((p) => [p._id.toString(), p]));
  const variantMap = new Map(variants.map((v) => [v._id.toString(), v]));

  return rows
    .map((row) => {
      const inv = {
        id: row._id.toString(),
        productId: row.productId.toString(),
        variantId: row.variantId ? row.variantId.toString() : null,
        quantityOnHand: row.quantityOnHand,
      };
      const product = productMap.get(row.productId.toString());
      const variant = row.variantId ? variantMap.get(row.variantId.toString()) : null;
      return serializeInventory(
        inv,
        product
          ? {
              id: product._id.toString(),
              name: product.name,
              isAvailable: product.isAvailable,
              isVisible: product.isVisible,
            }
          : null,
        variant
          ? {
              id: variant._id.toString(),
              name: variant.name,
              sku: variant.sku,
              isAvailable: variant.isAvailable,
            }
          : null,
      );
    })
    .sort((a, b) => (a.product?.name || "").localeCompare(b.product?.name || ""));
}

async function adjustInventory(businessId, actorUserId, input) {
  if (input.delta === 0) {
    throw new AppError(400, "Delta cannot be zero", "INVALID_DELTA");
  }

  const variantId = input.variantId ?? null;
  const inventory = await getOrCreateInventory(businessId, input.productId, variantId);
  const nextQty = inventory.quantityOnHand + input.delta;

  if (nextQty < 0) {
    throw new AppError(400, "Insufficient stock", "INSUFFICIENT_STOCK");
  }

  await withTransaction(async (session) => {
    const opts = sessionOpts(session);
    await Inventory.updateOne({ _id: toId(inventory.id) }, { quantityOnHand: nextQty }, opts);
    await InventoryMovement.create(
      [
        {
          businessId: toId(businessId),
          inventoryId: toId(inventory.id),
          delta: input.delta,
          reason: "ADJUSTMENT",
          note: input.note ?? null,
        },
      ],
      opts,
    );
    await AuditLog.create(
      [
        {
          businessId: toId(businessId),
          actorUserId: toId(actorUserId),
          action: "INVENTORY_ADJUSTED",
          entity: "Inventory",
          entityId: toId(inventory.id),
          meta: {
            productId: input.productId,
            variantId,
            delta: input.delta,
            quantityOnHand: nextQty,
          },
        },
      ],
      opts,
    );
  });

  await syncAvailability(businessId, input.productId, variantId, nextQty);
  return loadInventoryRow(inventory.id);
}

async function setInventoryQuantity(businessId, actorUserId, input) {
  const variantId = input.variantId ?? null;
  const inventory = await getOrCreateInventory(businessId, input.productId, variantId);
  const delta = input.quantity - inventory.quantityOnHand;

  await withTransaction(async (session) => {
    const opts = sessionOpts(session);
    await Inventory.updateOne({ _id: toId(inventory.id) }, { quantityOnHand: input.quantity }, opts);

    if (delta !== 0) {
      await InventoryMovement.create(
        [
          {
            businessId: toId(businessId),
            inventoryId: toId(inventory.id),
            delta,
            reason: "MANUAL_SET",
            note: input.note ?? null,
          },
        ],
        opts,
      );
    }

    await AuditLog.create(
      [
        {
          businessId: toId(businessId),
          actorUserId: toId(actorUserId),
          action: "INVENTORY_SET",
          entity: "Inventory",
          entityId: toId(inventory.id),
          meta: { productId: input.productId, variantId, quantity: input.quantity },
        },
      ],
      opts,
    );
  });

  await syncAvailability(businessId, input.productId, variantId, input.quantity);
  return loadInventoryRow(inventory.id);
}

async function ensureInventoryRecord(businessId, productId, variantId, initialStock) {
  const inv = await Inventory.create({
    businessId: toId(businessId),
    productId: toId(productId),
    variantId: variantId ? toId(variantId) : null,
    quantityOnHand: initialStock,
  });

  if (initialStock !== 0) {
    await InventoryMovement.create({
      businessId: toId(businessId),
      inventoryId: inv._id,
      delta: initialStock,
      reason: "MANUAL_SET",
      note: "Initial stock",
    });
  }

  return docToObject(inv);
}

module.exports = {
  listInventory,
  adjustInventory,
  setInventoryQuantity,
  ensureInventoryRecord,
};
