"use strict";

const express = require("express");
const { requireAuth, requirePermission, tenantId } = require("../middleware/auth");
const { getDashboardSummary } = require("../services/dashboard.service");

const dashboardRouter = express.Router();

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

module.exports = { dashboardRouter };
