import { Router } from "express";
import { updateBusinessSchema } from "@mashrum/shared";
import {
  requireAuth,
  requirePermission,
  tenantId,
} from "../middleware/auth";
import { getBusiness, updateBusiness } from "../services/business.service";

export const businessRouter = Router();

businessRouter.use(requireAuth);

businessRouter.get(
  "/me",
  requirePermission("business:read"),
  async (req, res, next) => {
    try {
      const business = await getBusiness(tenantId(req));
      res.json({ data: business });
    } catch (error) {
      next(error);
    }
  },
);

businessRouter.patch(
  "/me",
  requirePermission("business:write"),
  async (req, res, next) => {
    try {
      const input = updateBusinessSchema.parse(req.body);
      const business = await updateBusiness(
        tenantId(req),
        req.user!.id,
        input,
      );
      res.json({ data: business });
    } catch (error) {
      next(error);
    }
  },
);
