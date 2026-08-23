"use strict";

const express = require("express");
const { updateBusinessSchema } = require("../shared");
const { requireAuth, requirePermission, tenantId } = require("../middleware/auth");
const { getBusiness, updateBusiness } = require("../services/business.service");

const businessRouter = express.Router();

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
      const business = await updateBusiness(tenantId(req), req.user.id, input);
      res.json({ data: business });
    } catch (error) {
      next(error);
    }
  },
);

module.exports = { businessRouter };
