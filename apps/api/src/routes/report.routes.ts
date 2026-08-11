import { Router } from "express";
import { reportRangeSchema } from "@mashrum/shared";
import {
  requireAuth,
  requirePermission,
  tenantId,
} from "../middleware/auth";
import { getSalesReport } from "../services/report.service";

export const reportRouter = Router();

reportRouter.use(requireAuth);

reportRouter.get(
  "/sales",
  requirePermission("reports:read"),
  async (req, res, next) => {
    try {
      const range = reportRangeSchema.parse(req.query);
      const data = await getSalesReport(
        tenantId(req),
        range.from,
        range.to,
      );
      res.json({ data });
    } catch (error) {
      next(error);
    }
  },
);
