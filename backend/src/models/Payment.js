"use strict";

const mongoose = require("mongoose");
const { baseSchemaOptions } = require("./schema-common");
const { PAYMENT_METHODS, PAYMENT_STATUSES } = require("./enums");

const paymentSchema = new mongoose.Schema(
  {
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: "Business", required: true, index: true },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true, unique: true },
    method: { type: String, enum: PAYMENT_METHODS, default: "COD" },
    status: { type: String, enum: PAYMENT_STATUSES, default: "PENDING" },
    amount: { type: Number, required: true },
    collectedAt: { type: Date, default: null },
  },
  baseSchemaOptions(),
);

paymentSchema.index({ businessId: 1, status: 1 });

module.exports = mongoose.model("Payment", paymentSchema);
