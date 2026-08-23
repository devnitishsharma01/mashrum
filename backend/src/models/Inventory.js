"use strict";

const mongoose = require("mongoose");
const { baseSchemaOptions } = require("./schema-common");

const inventorySchema = new mongoose.Schema(
  {
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: "Business", required: true, index: true },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    variantId: { type: mongoose.Schema.Types.ObjectId, ref: "ProductVariant", default: null },
    quantityOnHand: { type: Number, default: 0 },
  },
  baseSchemaOptions(),
);

inventorySchema.index({ businessId: 1, productId: 1, variantId: 1 }, { unique: true });

module.exports = mongoose.model("Inventory", inventorySchema);
