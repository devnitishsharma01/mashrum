"use strict";

const { z } = require("zod");
const { USER_ROLES } = require("../constants");

const createUserSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(128),
  role: z.enum(["ADMIN", "STAFF"]),
});

const updateUserSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  role: z.enum(USER_ROLES).optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(8).max(128).optional(),
});

module.exports = { createUserSchema, updateUserSchema };
