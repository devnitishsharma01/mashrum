import { Router } from "express";
import { createUserSchema, updateUserSchema } from "@mashrum/shared";
import {
  requireAuth,
  requirePermission,
  tenantId,
} from "../middleware/auth";
import {
  createUser,
  listUsers,
  updateUser,
} from "../services/user.service";

export const userRouter = Router();

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
      const data = await createUser(tenantId(req), req.user!.id, input);
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
        req.user!.id,
        req.params.id,
        input,
      );
      res.json({ data });
    } catch (error) {
      next(error);
    }
  },
);
