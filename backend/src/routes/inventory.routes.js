"use strict";

const express = require("express");
const { adjustInventorySchema, setInventorySchema } = require("../shared");
const { requireAuth, requirePermission, tenantId } = require("../middleware/auth");
const {
  listInventory,
  adjustInventory,
  setInventoryQuantity,
} = require("../services/inventory.service");

const inventoryRouter = express.Router();

inventoryRouter.use(requireAuth);

inventoryRouter.get(
  "/",
  requirePermission("inventory:read"),
  async (req, res, next) => {
    try {
      const data = await listInventory(tenantId(req));
      res.json({ data });
    } catch (error) {
      next(error);
    }
  },
);

inventoryRouter.post(
  "/adjust",
  requirePermission("inventory:write"),
  async (req, res, next) => {
    try {
      const input = adjustInventorySchema.parse(req.body);
      const data = await adjustInventory(tenantId(req), req.user.id, input);
      res.json({ data });
    } catch (error) {
      next(error);
    }
  },
);

inventoryRouter.post(
  "/set",
  requirePermission("inventory:write"),
  async (req, res, next) => {
    try {
      const input = setInventorySchema.parse(req.body);
      const data = await setInventoryQuantity(tenantId(req), req.user.id, input);
      res.json({ data });
    } catch (error) {
      next(error);
    }
  },
);

module.exports = { inventoryRouter };
