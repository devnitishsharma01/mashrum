"use strict";

const { z } = require("zod");

const connectWhatsAppSchema = z.object({
  phoneNumberId: z.string().trim().min(5).max(64),
  accessToken: z.string().trim().min(20).max(5000),
  webhookVerifyToken: z.string().trim().min(8).max(256),
  wabaId: z.string().trim().max(64).optional().nullable(),
  displayPhone: z.string().trim().max(32).optional().nullable(),
});

const simulateInboundSchema = z.object({
  from: z
    .string()
    .trim()
    .min(8)
    .max(20)
    .regex(/^\+?[0-9]+$/),
  text: z.string().trim().min(1).max(1000),
  contactName: z.string().trim().max(120).optional(),
});

const BOT_STATES = [
  "IDLE",
  "BROWSING_CATEGORIES",
  "BROWSING_PRODUCTS",
  "AWAITING_QTY",
  "CART_REVIEW",
  "AWAITING_ADDRESS",
  "AWAITING_CONFIRM",
];

module.exports = {
  connectWhatsAppSchema,
  simulateInboundSchema,
  BOT_STATES,
};
