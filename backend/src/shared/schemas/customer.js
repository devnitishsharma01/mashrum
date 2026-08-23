"use strict";

const { z } = require("zod");

const createCustomerSchema = z.object({
  waId: z
    .string()
    .trim()
    .min(8)
    .max(20)
    .regex(/^\+?[0-9]+$/, "WhatsApp number must be digits with optional +"),
  name: z.string().trim().min(1).max(120).optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
  address: z
    .object({
      line1: z.string().trim().min(1).max(255),
      landmark: z.string().trim().max(255).optional().nullable(),
      city: z.string().trim().max(120).optional().nullable(),
      isDefault: z.boolean().optional(),
    })
    .optional(),
});

const updateCustomerSchema = z.object({
  name: z.string().trim().min(1).max(120).optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
});

const createCustomerAddressSchema = z.object({
  line1: z.string().trim().min(1).max(255),
  landmark: z.string().trim().max(255).optional().nullable(),
  city: z.string().trim().max(120).optional().nullable(),
  isDefault: z.boolean().optional(),
});

const listCustomersQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
});

module.exports = {
  createCustomerSchema,
  updateCustomerSchema,
  createCustomerAddressSchema,
  listCustomersQuerySchema,
};
