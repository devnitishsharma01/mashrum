"use strict";

const express = require("express");
const {
  createCategorySchema,
  updateCategorySchema,
} = require("../shared");
const { requireAuth, requirePermission, tenantId } = require("../middleware/auth");
const {
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} = require("../services/category.service");

const categoryRouter = express.Router();

categoryRouter.use(requireAuth);

categoryRouter.get(
  "/",
  requirePermission("catalog:read"),
  async (req, res, next) => {
    try {
      const data = await listCategories(tenantId(req));
      res.json({ data });
    } catch (error) {
      next(error);
    }
  },
);

categoryRouter.post(
  "/",
  requirePermission("catalog:write"),
  async (req, res, next) => {
    try {
      const input = createCategorySchema.parse(req.body);
      const data = await createCategory(tenantId(req), req.user.id, input);
      res.status(201).json({ data });
    } catch (error) {
      next(error);
    }
  },
);

categoryRouter.patch(
  "/:id",
  requirePermission("catalog:write"),
  async (req, res, next) => {
    try {
      const input = updateCategorySchema.parse(req.body);
      const data = await updateCategory(
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

categoryRouter.delete(
  "/:id",
  requirePermission("catalog:write"),
  async (req, res, next) => {
    try {
      const data = await deleteCategory(tenantId(req), req.user.id, req.params.id);
      res.json({ data });
    } catch (error) {
      next(error);
    }
  },
);

module.exports = { categoryRouter };
