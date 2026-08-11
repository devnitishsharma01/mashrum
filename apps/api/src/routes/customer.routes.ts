import { Router } from "express";
import {
  createCustomerAddressSchema,
  createCustomerSchema,
  listCustomersQuerySchema,
  updateCustomerSchema,
} from "@mashrum/shared";
import {
  requireAuth,
  requirePermission,
  tenantId,
} from "../middleware/auth";
import {
  addCustomerAddress,
  createCustomer,
  getCustomer,
  listCustomers,
  updateCustomer,
} from "../services/customer.service";

export const customerRouter = Router();

customerRouter.use(requireAuth);

customerRouter.get(
  "/",
  requirePermission("customers:read"),
  async (req, res, next) => {
    try {
      const query = listCustomersQuerySchema.parse(req.query);
      const data = await listCustomers(tenantId(req), query.q);
      res.json({ data });
    } catch (error) {
      next(error);
    }
  },
);

customerRouter.get(
  "/:id",
  requirePermission("customers:read"),
  async (req, res, next) => {
    try {
      const data = await getCustomer(tenantId(req), req.params.id);
      res.json({ data });
    } catch (error) {
      next(error);
    }
  },
);

customerRouter.post(
  "/",
  requirePermission("customers:write"),
  async (req, res, next) => {
    try {
      const input = createCustomerSchema.parse(req.body);
      const data = await createCustomer(tenantId(req), req.user!.id, input);
      res.status(201).json({ data });
    } catch (error) {
      next(error);
    }
  },
);

customerRouter.patch(
  "/:id",
  requirePermission("customers:write"),
  async (req, res, next) => {
    try {
      const input = updateCustomerSchema.parse(req.body);
      const data = await updateCustomer(
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

customerRouter.post(
  "/:id/addresses",
  requirePermission("customers:write"),
  async (req, res, next) => {
    try {
      const input = createCustomerAddressSchema.parse(req.body);
      const data = await addCustomerAddress(
        tenantId(req),
        req.user!.id,
        req.params.id,
        input,
      );
      res.status(201).json({ data });
    } catch (error) {
      next(error);
    }
  },
);
