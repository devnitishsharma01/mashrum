"use strict";

const mongoose = require("mongoose");
const { baseSchemaOptions } = require("./schema-common");
const { CART_STATUSES } = require("./enums");

const cartItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    variantId: { type: mongoose.Schema.Types.ObjectId, ref: "ProductVariant", default: null },
    qty: { type: Number, required: true },
    unitPrice: { type: Number, required: true },
  },
  { timestamps: true },
);

const cartSchema = new mongoose.Schema(
  {
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: "Business", required: true, index: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true, index: true },
    status: { type: String, enum: CART_STATUSES, default: "ACTIVE" },
    items: { type: [cartItemSchema], default: [] },
  },
  baseSchemaOptions(),
);

cartSchema.index({ businessId: 1, customerId: 1, status: 1 });

module.exports = mongoose.model("Cart", cartSchema);
