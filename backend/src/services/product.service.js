"use strict";

const { docToObject, withTransaction, sessionOpts, toId } = require("../db");
const {
  Category,
  Product,
  ProductVariant,
  Inventory,
  InventoryMovement,
  Order,
  AuditLog,
} = require("../models");
const { getStockStatus } = require("../shared");
const { AppError } = require("../lib/errors");
const { toNumber } = require("../lib/money");

function serializeProduct(product, inventoryRows, variants) {
  const productInventory = inventoryRows.filter(
    (i) => i.productId === product.id && i.variantId === null,
  );
  const baseInventory =
    productInventory[0]?.quantityOnHand ??
    inventoryRows
      .filter((i) => i.productId === product.id)
      .reduce((sum, i) => sum + i.quantityOnHand, 0);

  const quantityOnHand = baseInventory ?? 0;

  return {
    ...product,
    basePrice: toNumber(product.basePrice),
    quantityOnHand,
    stockStatus: getStockStatus(quantityOnHand),
    variants: variants.map((variant) => {
      const inv = inventoryRows.find(
        (i) => i.productId === product.id && i.variantId === variant.id,
      );
      const qty = inv?.quantityOnHand ?? 0;
      return {
        ...variant,
        price: toNumber(variant.price),
        quantityOnHand: qty,
        stockStatus: getStockStatus(qty),
        inventory: inv ? [{ quantityOnHand: qty }] : [],
      };
    }),
    inventory: inventoryRows
      .filter((i) => i.productId === product.id)
      .map((i) => ({ quantityOnHand: i.quantityOnHand, variantId: i.variantId })),
  };
}

async function loadInventoryForProducts(businessId, productIds) {
  if (productIds.length === 0) return [];
  const rows = await Inventory.find({
    businessId: toId(businessId),
    productId: { $in: productIds.map(toId) },
  }).lean();

  return rows.map((r) => ({
    productId: r.productId.toString(),
    variantId: r.variantId ? r.variantId.toString() : null,
    quantityOnHand: r.quantityOnHand,
  }));
}

async function loadVariantsForProducts(businessId, productIds) {
  if (productIds.length === 0) return new Map();
  const rows = await ProductVariant.find({
    businessId: toId(businessId),
    productId: { $in: productIds.map(toId) },
  })
    .sort({ createdAt: 1 })
    .lean();

  const map = new Map();
  for (const row of rows) {
    const variant = {
      id: row._id.toString(),
      businessId: row.businessId.toString(),
      productId: row.productId.toString(),
      name: row.name,
      sku: row.sku,
      price: row.price,
      isAvailable: row.isAvailable,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
    if (!map.has(variant.productId)) map.set(variant.productId, []);
    map.get(variant.productId).push(variant);
  }
  return map;
}

async function assertCategory(businessId, categoryId) {
  if (!categoryId) return;
  const category = await Category.findOne({
    _id: toId(categoryId),
    businessId: toId(businessId),
  })
    .select("_id")
    .lean();
  if (!category) {
    throw new AppError(400, "Category not found", "INVALID_CATEGORY");
  }
}

function buildProductQuery(businessId, filters) {
  const query = { businessId: toId(businessId) };
  if (filters.categoryId) query.categoryId = toId(filters.categoryId);
  if (filters.isVisible !== undefined) query.isVisible = filters.isVisible;
  if (filters.isAvailable !== undefined) query.isAvailable = filters.isAvailable;
  if (filters.q) {
    const regex = new RegExp(filters.q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    query.$or = [{ name: regex }, { description: regex }];
  }
  return query;
}

async function mapProductsWithRelations(businessId, productDocs) {
  const products = productDocs.map((p) => {
    const product = docToObject(p);
    return product;
  });

  const productIds = products.map((p) => p.id);
  const categoryIds = [...new Set(products.map((p) => p.categoryId).filter(Boolean))];
  const categories = categoryIds.length
    ? await Category.find({ _id: { $in: categoryIds.map(toId) } })
        .select("name")
        .lean()
    : [];
  const categoryMap = new Map(categories.map((c) => [c._id.toString(), { id: c._id.toString(), name: c.name }]));

  for (const product of products) {
    product.category = product.categoryId ? categoryMap.get(product.categoryId) || null : null;
  }

  const [inventoryRows, variantMap] = await Promise.all([
    loadInventoryForProducts(businessId, productIds),
    loadVariantsForProducts(businessId, productIds),
  ]);

  return products.map((p) =>
    serializeProduct(p, inventoryRows, variantMap.get(p.id) ?? []),
  );
}

async function listProducts(businessId, filters) {
  const productDocs = await Product.find(buildProductQuery(businessId, filters)).sort({
    createdAt: -1,
  });
  return mapProductsWithRelations(businessId, productDocs);
}

async function getProduct(businessId, productId) {
  const productDoc = await Product.findOne({
    _id: toId(productId),
    businessId: toId(businessId),
  });
  if (!productDoc) {
    throw new AppError(404, "Product not found", "NOT_FOUND");
  }
  const [product] = await mapProductsWithRelations(businessId, [productDoc]);
  return product;
}

async function createProduct(businessId, actorUserId, input) {
  await assertCategory(businessId, input.categoryId);

  const initialStock = input.initialStock ?? 0;
  const isAvailable = input.isAvailable !== undefined ? input.isAvailable : initialStock > 0;

  const productId = await withTransaction(async (session) => {
    const opts = sessionOpts(session);
    const product = await Product.create(
      [
        {
          businessId: toId(businessId),
          categoryId: input.categoryId ? toId(input.categoryId) : null,
          name: input.name,
          description: input.description ?? null,
          basePrice: input.basePrice,
          isAvailable,
          isVisible: input.isVisible ?? true,
          imageUrl: input.imageUrl ?? null,
        },
      ],
      opts,
    ).then((docs) => docs[0]);

    const inventory = await Inventory.create(
      [
        {
          businessId: toId(businessId),
          productId: product._id,
          variantId: null,
          quantityOnHand: initialStock,
        },
      ],
      opts,
    ).then((docs) => docs[0]);

    if (initialStock > 0) {
      await InventoryMovement.create(
        [
          {
            businessId: toId(businessId),
            inventoryId: inventory._id,
            delta: initialStock,
            reason: "MANUAL_SET",
            note: input.sku ? `Initial stock (SKU: ${input.sku})` : "Initial stock",
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
          action: "PRODUCT_CREATED",
          entity: "Product",
          entityId: product._id,
          meta: { sku: input.sku, initialStock },
        },
      ],
      opts,
    );

    return product._id.toString();
  });

  return getProduct(businessId, productId);
}

async function updateProduct(businessId, actorUserId, productId, input) {
  const existing = await Product.findOne({
    _id: toId(productId),
    businessId: toId(businessId),
  });
  if (!existing) {
    throw new AppError(404, "Product not found", "NOT_FOUND");
  }

  if (input.categoryId !== undefined) {
    await assertCategory(businessId, input.categoryId);
    existing.categoryId = input.categoryId ? toId(input.categoryId) : null;
  }
  if (input.name != null) existing.name = input.name;
  if (input.description !== undefined) existing.description = input.description;
  if (input.basePrice != null) existing.basePrice = input.basePrice;
  if (input.isAvailable != null) existing.isAvailable = input.isAvailable;
  if (input.isVisible != null) existing.isVisible = input.isVisible;
  if (input.imageUrl !== undefined) existing.imageUrl = input.imageUrl;

  await existing.save();

  await AuditLog.create({
    businessId: toId(businessId),
    actorUserId: toId(actorUserId),
    action: "PRODUCT_UPDATED",
    entity: "Product",
    entityId: existing._id,
    meta: input,
  });

  return getProduct(businessId, productId);
}

async function deleteProduct(businessId, actorUserId, productId) {
  const existing = await Product.findOne({
    _id: toId(productId),
    businessId: toId(businessId),
  });
  if (!existing) {
    throw new AppError(404, "Product not found", "NOT_FOUND");
  }

  const orderItemCount = await Order.countDocuments({
    businessId: toId(businessId),
    "items.productId": existing._id,
  });

  if (orderItemCount > 0) {
    existing.isVisible = false;
    existing.isAvailable = false;
    await existing.save();
    await AuditLog.create({
      businessId: toId(businessId),
      actorUserId: toId(actorUserId),
      action: "PRODUCT_ARCHIVED",
      entity: "Product",
      entityId: existing._id,
    });
    return { success: true, archived: true };
  }

  await Product.deleteOne({ _id: existing._id });
  await AuditLog.create({
    businessId: toId(businessId),
    actorUserId: toId(actorUserId),
    action: "PRODUCT_DELETED",
    entity: "Product",
    entityId: existing._id,
  });
  return { success: true, archived: false };
}

async function createVariant(businessId, actorUserId, productId, input) {
  const product = await Product.findOne({
    _id: toId(productId),
    businessId: toId(businessId),
  })
    .select("_id")
    .lean();
  if (!product) {
    throw new AppError(404, "Product not found", "NOT_FOUND");
  }

  const initialStock = input.initialStock ?? 0;

  const variantId = await withTransaction(async (session) => {
    const opts = sessionOpts(session);
    let isAvailable = input.isAvailable ?? (initialStock > 0 || input.isAvailable === true);

    const variant = await ProductVariant.create(
      [
        {
          businessId: toId(businessId),
          productId: toId(productId),
          name: input.name,
          sku: input.sku ?? null,
          price: input.price,
          isAvailable,
        },
      ],
      opts,
    ).then((docs) => docs[0]);

    const inventory = await Inventory.create(
      [
        {
          businessId: toId(businessId),
          productId: toId(productId),
          variantId: variant._id,
          quantityOnHand: initialStock,
        },
      ],
      opts,
    ).then((docs) => docs[0]);

    if (initialStock > 0) {
      await InventoryMovement.create(
        [
          {
            businessId: toId(businessId),
            inventoryId: inventory._id,
            delta: initialStock,
            reason: "MANUAL_SET",
            note: "Initial variant stock",
          },
        ],
        opts,
      );
    }

    if (initialStock === 0 && input.isAvailable === undefined) {
      variant.isAvailable = false;
      await variant.save(opts);
    }

    await AuditLog.create(
      [
        {
          businessId: toId(businessId),
          actorUserId: toId(actorUserId),
          action: "VARIANT_CREATED",
          entity: "ProductVariant",
          entityId: variant._id,
          meta: { productId, initialStock },
        },
      ],
      opts,
    );

    return variant._id.toString();
  });

  const p = await getProduct(businessId, productId);
  return { product: p, variantId };
}

async function updateVariant(businessId, actorUserId, productId, variantId, input) {
  const existing = await ProductVariant.findOne({
    _id: toId(variantId),
    businessId: toId(businessId),
    productId: toId(productId),
  });
  if (!existing) {
    throw new AppError(404, "Variant not found", "NOT_FOUND");
  }

  if (input.name != null) existing.name = input.name;
  if (input.sku !== undefined) existing.sku = input.sku;
  if (input.price != null) existing.price = input.price;
  if (input.isAvailable != null) existing.isAvailable = input.isAvailable;

  await existing.save();

  await AuditLog.create({
    businessId: toId(businessId),
    actorUserId: toId(actorUserId),
    action: "VARIANT_UPDATED",
    entity: "ProductVariant",
    entityId: existing._id,
    meta: input,
  });

  return getProduct(businessId, productId);
}

async function deleteVariant(businessId, actorUserId, productId, variantId) {
  const existing = await ProductVariant.findOne({
    _id: toId(variantId),
    businessId: toId(businessId),
    productId: toId(productId),
  });
  if (!existing) {
    throw new AppError(404, "Variant not found", "NOT_FOUND");
  }

  const orderItemCount = await Order.countDocuments({
    businessId: toId(businessId),
    "items.variantId": existing._id,
  });

  if (orderItemCount > 0) {
    existing.isAvailable = false;
    await existing.save();
    await AuditLog.create({
      businessId: toId(businessId),
      actorUserId: toId(actorUserId),
      action: "VARIANT_ARCHIVED",
      entity: "ProductVariant",
      entityId: existing._id,
    });
    return getProduct(businessId, productId);
  }

  await ProductVariant.deleteOne({ _id: existing._id });
  await AuditLog.create({
    businessId: toId(businessId),
    actorUserId: toId(actorUserId),
    action: "VARIANT_DELETED",
    entity: "ProductVariant",
    entityId: existing._id,
  });

  return getProduct(businessId, productId);
}

module.exports = {
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  createVariant,
  updateVariant,
  deleteVariant,
};
