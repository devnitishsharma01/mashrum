"use strict";

const { z } = require("zod");
const { objectIdSchema } = require("./objectId");

const LOW_STOCK_THRESHOLD = 5;

const createCategorySchema = z.object({
  name: z.string().trim().min(1).max(120),
  sortOrder: z.number().int().min(0).max(9999).optional(),
  isVisible: z.boolean().optional(),
});

const updateCategorySchema = createCategorySchema.partial();

const createProductSchema = z.object({
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(2000).optional().nullable(),
  categoryId: objectIdSchema.optional().nullable(),
  basePrice: z.coerce.number().positive().max(1000000),
  isAvailable: z.boolean().optional(),
  isVisible: z.boolean().optional(),
  imageUrl: z.preprocess(
    (v) => (v === "" || v === undefined ? null : v),
    z.string().url().max(500).nullable().optional(),
  ),
  sku: z.string().trim().max(64).optional().nullable(),
  initialStock: z.coerce.number().int().min(0).max(1000000).optional(),
});

const updateProductSchema = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  description: z.string().trim().max(2000).optional().nullable(),
  categoryId: objectIdSchema.optional().nullable(),
  basePrice: z.coerce.number().positive().max(1000000).optional(),
  isAvailable: z.boolean().optional(),
  isVisible: z.boolean().optional(),
  imageUrl: z.preprocess(
    (v) => (v === "" || v === undefined ? null : v),
    z.string().url().max(500).nullable().optional(),
  ),
});

const createVariantSchema = z.object({
  name: z.string().trim().min(1).max(120),
  sku: z.string().trim().max(64).optional().nullable(),
  price: z.coerce.number().positive().max(1000000),
  isAvailable: z.boolean().optional(),
  initialStock: z.coerce.number().int().min(0).max(1000000).optional(),
});

const updateVariantSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  sku: z.string().trim().max(64).optional().nullable(),
  price: z.coerce.number().positive().max(1000000).optional(),
  isAvailable: z.boolean().optional(),
});

const adjustInventorySchema = z.object({
  productId: objectIdSchema,
  variantId: objectIdSchema.optional().nullable(),
  delta: z.coerce.number().int().min(-1000000).max(1000000),
  note: z.string().trim().max(500).optional(),
});

const setInventorySchema = z.object({
  productId: objectIdSchema,
  variantId: objectIdSchema.optional().nullable(),
  quantity: z.coerce.number().int().min(0).max(1000000),
  note: z.string().trim().max(500).optional(),
});

const listProductsQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  categoryId: objectIdSchema.optional(),
  isVisible: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
  isAvailable: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
});

function getStockStatus(quantity, lowStockThreshold = LOW_STOCK_THRESHOLD) {
  if (quantity <= 0) return "OUT_OF_STOCK";
  if (quantity <= lowStockThreshold) return "LOW_STOCK";
  return "AVAILABLE";
}

module.exports = {
  LOW_STOCK_THRESHOLD,
  createCategorySchema,
  updateCategorySchema,
  createProductSchema,
  updateProductSchema,
  createVariantSchema,
  updateVariantSchema,
  adjustInventorySchema,
  setInventorySchema,
  listProductsQuerySchema,
  getStockStatus,
};
