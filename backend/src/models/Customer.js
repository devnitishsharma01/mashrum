"use strict";

const mongoose = require("mongoose");
const { baseSchemaOptions } = require("./schema-common");

const customerSchema = new mongoose.Schema(
  {
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: "Business", required: true, index: true },
    waId: { type: String, required: true },
    name: { type: String, default: null },
    notes: { type: String, default: null },
    lastMessageAt: { type: Date, default: null },
  },
  baseSchemaOptions(),
);

customerSchema.index({ businessId: 1, waId: 1 }, { unique: true });

module.exports = mongoose.model("Customer", customerSchema);
