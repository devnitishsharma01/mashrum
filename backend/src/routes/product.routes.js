"use strict";

const express = require("express");
const {
  listProductsQuerySchema,
  createProductSchema,
  updateProductSchema,
  createVariantSchema,
  updateVariantSchema,
} = require("../shared");
const { requireAuth, requirePermission, tenantId } = require("../middleware/auth");
const {
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  createVariant,
  updateVariant,
  deleteVariant,
} = require("../services/product.service");

const productRouter = express.Router();

productRouter.use(requireAuth);

productRouter.get(
  "/",
  requirePermission("catalog:read"),
  async (req, res, next) => {
    try {
      const filters = listProductsQuerySchema.parse(req.query);
      const data = await listProducts(tenantId(req), filters);
      res.json({ data });
    } catch (error) {
      next(error);
    }
  },
);

productRouter.get(
  "/:id",
  requirePermission("catalog:read"),
  async (req, res, next) => {
    try {
      const data = await getProduct(tenantId(req), req.params.id);
      res.json({ data });
    } catch (error) {
      next(error);
    }
  },
);

productRouter.post(
  "/",
  requirePermission("catalog:write"),
  async (req, res, next) => {
    try {
      const input = createProductSchema.parse(req.body);
      const data = await createProduct(tenantId(req), req.user.id, input);
      res.status(201).json({ data });
    } catch (error) {
      next(error);
    }
  },
);

productRouter.patch(
  "/:id",
  requirePermission("catalog:write"),
  async (req, res, next) => {
    try {
      const input = updateProductSchema.parse(req.body);
      const data = await updateProduct(
        tenantId(req),
        req.user.id,
        req.params.id,
        input,
      );
      res.json({ data });
    } catch (error) {
      next(error);
    }
  },
);

productRouter.delete(
  "/:id",
  requirePermission("catalog:write"),
  async (req, res, next) => {
    try {
      const data = await deleteProduct(tenantId(req), req.user.id, req.params.id);
      res.json({ data });
    } catch (error) {
      next(error);
    }
  },
);

productRouter.post(
  "/:id/variants",
  requirePermission("catalog:write"),
  async (req, res, next) => {
    try {
      const input = createVariantSchema.parse(req.body);
      const data = await createVariant(
        tenantId(req),
        req.user.id,
        req.params.id,
        input,
      );
      res.status(201).json({ data });
    } catch (error) {
      next(error);
    }
  },
);

productRouter.patch(
  "/:id/variants/:variantId",
  requirePermission("catalog:write"),
  async (req, res, next) => {
    try {
      const input = updateVariantSchema.parse(req.body);
      const data = await updateVariant(
        tenantId(req),
        req.user.id,
        req.params.id,
        req.params.variantId,
        input,
      );
      res.json({ data });
    } catch (error) {
      next(error);
    }
  },
);

productRouter.delete(
  "/:id/variants/:variantId",
  requirePermission("catalog:write"),
  async (req, res, next) => {
    try {
      const data = await deleteVariant(
        tenantId(req),
        req.user.id,
        req.params.id,
        req.params.variantId,
      );
      res.json({ data });
    } catch (error) {
      next(error);
    }
  },
);

module.exports = { productRouter };
