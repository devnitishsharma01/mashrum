"use strict";

const mongoose = require("mongoose");
const { baseSchemaOptions } = require("./schema-common");
const { BUSINESS_STATUSES } = require("./enums");

const businessSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    timezone: { type: String, default: "Asia/Kolkata" },
    currency: { type: String, default: "INR" },
    phone: { type: String, default: null },
    address: { type: String, default: null },
    status: { type: String, enum: BUSINESS_STATUSES, default: "ACTIVE" },
    codEnabled: { type: Boolean, default: true },
    workingHours: { type: mongoose.Schema.Types.Mixed, required: true },
  },
  baseSchemaOptions(),
);

module.exports = mongoose.model("Business", businessSchema);
