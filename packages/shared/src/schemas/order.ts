import { z } from "zod";
import { ORDER_STATUSES, PAYMENT_STATUSES } from "../constants";

export const createOrderItemSchema = z.object({
  productId: z.string().cuid(),
  variantId: z.string().cuid().optional().nullable(),
  qty: z.coerce.number().int().positive().max(1000),
});

export const createOrderSchema = z.object({
  customerId: z.string().cuid(),
  notes: z.string().trim().max(1000).optional().nullable(),
  addressId: z.string().cuid().optional().nullable(),
  deliveryAddress: z
    .object({
      line1: z.string().trim().min(1).max(255),
      landmark: z.string().trim().max(255).optional().nullable(),
      city: z.string().trim().max(120).optional().nullable(),
    })
    .optional()
    .nullable(),
  items: z.array(createOrderItemSchema).min(1).max(100),
});

export const transitionOrderSchema = z.object({
  status: z.enum(ORDER_STATUSES),
  note: z.string().trim().max(500).optional().nullable(),
});

export const updatePaymentSchema = z.object({
  status: z.enum(PAYMENT_STATUSES),
});

export const listOrdersQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  status: z.enum(ORDER_STATUSES).optional(),
  paymentStatus: z.enum(PAYMENT_STATUSES).optional(),
  view: z.enum(["list", "kanban"]).optional(),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type TransitionOrderInput = z.infer<typeof transitionOrderSchema>;
export type UpdatePaymentInput = z.infer<typeof updatePaymentSchema>;

export const KANBAN_COLUMNS = [
  "NEW",
  "CONFIRMED",
  "PROCESSING",
  "READY",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "COMPLETED",
  "CANCELLED",
] as const;
