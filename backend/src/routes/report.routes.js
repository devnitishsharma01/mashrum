"use strict";

const express = require("express");
const { reportRangeSchema } = require("../shared");
const { requireAuth, requirePermission, tenantId } = require("../middleware/auth");
const { getSalesReport } = require("../services/report.service");

const reportRouter = express.Router();

reportRouter.use(requireAuth);

reportRouter.get(
  "/sales",
  requirePermission("reports:read"),
  async (req, res, next) => {
    try {
      const range = reportRangeSchema.parse(req.query);
      const data = await getSalesReport(tenantId(req), range.from, range.to);
      res.json({ data });
    } catch (error) {
      next(error);
    }
  },
);

module.exports = { reportRouter };
