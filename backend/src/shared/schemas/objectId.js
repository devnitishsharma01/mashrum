"use strict";

const { z } = require("zod");

/** MongoDB ObjectId (24 hex chars) */
const objectIdSchema = z
  .string()
  .trim()
  .regex(/^[a-fA-F0-9]{24}$/, "Invalid id");

module.exports = { objectIdSchema };
