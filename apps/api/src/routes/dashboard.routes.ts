import { Router } from "express";
import {
  requireAuth,
  requirePermission,
  tenantId,
} from "../middleware/auth";
import { getDashboardSummary } from "../services/dashboard.service";

export const dashboardRouter = Router();

dashboardRouter.use(requireAuth);

dashboardRouter.get(
  "/summary",
  requirePermission("business:read"),
  async (req, res, next) => {
    try {
      const data = await getDashboardSummary(tenantId(req));
      res.json({ data });
    } catch (error) {
      next(error);
    }
  },
);
