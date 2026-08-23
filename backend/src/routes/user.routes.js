"use strict";

const express = require("express");
const { createUserSchema, updateUserSchema } = require("../shared");
const { requireAuth, requirePermission, tenantId } = require("../middleware/auth");
const { listUsers, createUser, updateUser } = require("../services/user.service");

const userRouter = express.Router();

userRouter.use(requireAuth);

userRouter.get(
  "/",
  requirePermission("users:read"),
  async (req, res, next) => {
    try {
      const data = await listUsers(tenantId(req));
      res.json({ data });
    } catch (error) {
      next(error);
    }
  },
);

userRouter.post(
  "/",
  requirePermission("users:write"),
  async (req, res, next) => {
    try {
      const input = createUserSchema.parse(req.body);
      const data = await createUser(tenantId(req), req.user.id, input);
      res.status(201).json({ data });
    } catch (error) {
      next(error);
    }
  },
);

userRouter.patch(
  "/:id",
  requirePermission("users:write"),
  async (req, res, next) => {
    try {
      const input = updateUserSchema.parse(req.body);
      const data = await updateUser(
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

module.exports = { userRouter };
