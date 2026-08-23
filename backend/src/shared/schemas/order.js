"use strict";

const { z } = require("zod");
const { ORDER_STATUSES, PAYMENT_STATUSES } = require("../constants");
const { objectIdSchema } = require("./objectId");

const createOrderItemSchema = z.object({
  productId: objectIdSchema,
  variantId: objectIdSchema.optional().nullable(),
  qty: z.coerce.number().int().positive().max(1000),
});

const createOrderSchema = z.object({
  customerId: objectIdSchema,
  notes: z.string().trim().max(1000).optional().nullable(),
  addressId: objectIdSchema.optional().nullable(),
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

const transitionOrderSchema = z.object({
  status: z.enum(ORDER_STATUSES),
  note: z.string().trim().max(500).optional().nullable(),
});

const updatePaymentSchema = z.object({
  status: z.enum(PAYMENT_STATUSES),
});

const listOrdersQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  status: z.enum(ORDER_STATUSES).optional(),
  paymentStatus: z.enum(PAYMENT_STATUSES).optional(),
  view: z.enum(["list", "kanban"]).optional(),
});

const KANBAN_COLUMNS = [
  "NEW",
  "CONFIRMED",
  "PROCESSING",
  "READY",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "COMPLETED",
  "CANCELLED",
];

module.exports = {
  createOrderItemSchema,
  createOrderSchema,
  transitionOrderSchema,
  updatePaymentSchema,
  listOrdersQuerySchema,
  KANBAN_COLUMNS,
};
