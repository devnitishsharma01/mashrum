"use strict";

const mongoose = require("mongoose");
const { baseSchemaOptions } = require("./schema-common");

const productVariantSchema = new mongoose.Schema(
  {
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: "Business", required: true, index: true },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true, index: true },
    name: { type: String, required: true },
    sku: { type: String, default: null },
    price: { type: Number, required: true },
    isAvailable: { type: Boolean, default: true },
  },
  baseSchemaOptions(),
);

productVariantSchema.index({ businessId: 1, productId: 1 });
productVariantSchema.index({ businessId: 1, sku: 1 });

module.exports = mongoose.model("ProductVariant", productVariantSchema);
