import { Router } from "express";
import {
  createOrderSchema,
  listOrdersQuerySchema,
  transitionOrderSchema,
  updatePaymentSchema,
} from "@mashrum/shared";
import {
  requireAuth,
  requirePermission,
  tenantId,
} from "../middleware/auth";
import {
  createOrder,
  getOrder,
  listOrders,
  transitionOrder,
  updateOrderPayment,
} from "../services/order.service";

export const orderRouter = Router();

orderRouter.use(requireAuth);

orderRouter.get(
  "/",
  requirePermission("orders:read"),
  async (req, res, next) => {
    try {
      const filters = listOrdersQuerySchema.parse(req.query);
      const data = await listOrders(tenantId(req), filters);
      res.json({ data });
    } catch (error) {
      next(error);
    }
  },
);

orderRouter.get(
  "/:id",
  requirePermission("orders:read"),
  async (req, res, next) => {
    try {
      const data = await getOrder(tenantId(req), req.params.id);
      res.json({ data });
    } catch (error) {
      next(error);
    }
  },
);

orderRouter.post(
  "/",
  requirePermission("orders:write"),
  async (req, res, next) => {
    try {
      const input = createOrderSchema.parse(req.body);
      const data = await createOrder(tenantId(req), req.user!.id, input);
      res.status(201).json({ data });
    } catch (error) {
      next(error);
    }
  },
);

orderRouter.post(
  "/:id/transition",
  requirePermission("orders:write"),
  async (req, res, next) => {
    try {
      const input = transitionOrderSchema.parse(req.body);
      const data = await transitionOrder(
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

orderRouter.post(
  "/:id/payment",
  requirePermission("payments:write"),
  async (req, res, next) => {
    try {
      const input = updatePaymentSchema.parse(req.body);
      const data = await updateOrderPayment(
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
