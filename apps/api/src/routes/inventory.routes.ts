import { Router } from "express";
import {
  adjustInventorySchema,
  setInventorySchema,
} from "@mashrum/shared";
import {
  requireAuth,
  requirePermission,
  tenantId,
} from "../middleware/auth";
import {
  adjustInventory,
  listInventory,
  setInventoryQuantity,
} from "../services/inventory.service";

export const inventoryRouter = Router();

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
      const data = await adjustInventory(tenantId(req), req.user!.id, input);
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
      const data = await setInventoryQuantity(
        tenantId(req),
        req.user!.id,
        input,
      );
      res.json({ data });
    } catch (error) {
      next(error);
    }
  },
);
