import { z } from "zod";

export const LOW_STOCK_THRESHOLD = 5;

export const createCategorySchema = z.object({
  name: z.string().trim().min(1).max(120),
  sortOrder: z.number().int().min(0).max(9999).optional(),
  isVisible: z.boolean().optional(),
});

export const updateCategorySchema = createCategorySchema.partial();

export const createProductSchema = z.object({
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(2000).optional().nullable(),
  categoryId: z.string().cuid().optional().nullable(),
  basePrice: z.coerce.number().positive().max(1_000_000),
  isAvailable: z.boolean().optional(),
  isVisible: z.boolean().optional(),
  imageUrl: z.preprocess(
    (v) => (v === "" || v === undefined ? null : v),
    z.string().url().max(500).nullable().optional(),
  ),
  sku: z.string().trim().max(64).optional().nullable(),
  initialStock: z.coerce.number().int().min(0).max(1_000_000).optional(),
});

export const updateProductSchema = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  description: z.string().trim().max(2000).optional().nullable(),
  categoryId: z.string().cuid().optional().nullable(),
  basePrice: z.coerce.number().positive().max(1_000_000).optional(),
  isAvailable: z.boolean().optional(),
  isVisible: z.boolean().optional(),
  imageUrl: z.preprocess(
    (v) => (v === "" || v === undefined ? null : v),
    z.string().url().max(500).nullable().optional(),
  ),
});

export const createVariantSchema = z.object({
  name: z.string().trim().min(1).max(120),
  sku: z.string().trim().max(64).optional().nullable(),
  price: z.coerce.number().positive().max(1_000_000),
  isAvailable: z.boolean().optional(),
  initialStock: z.coerce.number().int().min(0).max(1_000_000).optional(),
});

export const updateVariantSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  sku: z.string().trim().max(64).optional().nullable(),
  price: z.coerce.number().positive().max(1_000_000).optional(),
  isAvailable: z.boolean().optional(),
});

export const adjustInventorySchema = z.object({
  productId: z.string().cuid(),
  variantId: z.string().cuid().optional().nullable(),
  delta: z.coerce.number().int().min(-1_000_000).max(1_000_000),
  note: z.string().trim().max(500).optional(),
});

export const setInventorySchema = z.object({
  productId: z.string().cuid(),
  variantId: z.string().cuid().optional().nullable(),
  quantity: z.coerce.number().int().min(0).max(1_000_000),
  note: z.string().trim().max(500).optional(),
});

export const listProductsQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  categoryId: z.string().cuid().optional(),
  isVisible: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
  isAvailable: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type CreateVariantInput = z.infer<typeof createVariantSchema>;
export type UpdateVariantInput = z.infer<typeof updateVariantSchema>;
export type AdjustInventoryInput = z.infer<typeof adjustInventorySchema>;
export type SetInventoryInput = z.infer<typeof setInventorySchema>;

export type StockStatus = "AVAILABLE" | "LOW_STOCK" | "OUT_OF_STOCK";

export function getStockStatus(
  quantity: number,
  lowStockThreshold = LOW_STOCK_THRESHOLD,
): StockStatus {
  if (quantity <= 0) return "OUT_OF_STOCK";
  if (quantity <= lowStockThreshold) return "LOW_STOCK";
  return "AVAILABLE";
}
