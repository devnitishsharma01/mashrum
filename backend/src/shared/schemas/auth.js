"use strict";

const { z } = require("zod");

const registerSchema = z.object({
  businessName: z.string().trim().min(2).max(120),
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(128),
  timezone: z.string().trim().min(1).max(64).default("Asia/Kolkata"),
  currency: z.string().trim().length(3).default("INR"),
});

const loginSchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(1).max(128),
});

module.exports = { registerSchema, loginSchema };
