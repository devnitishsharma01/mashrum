"use strict";

const mongoose = require("mongoose");
const { baseSchemaOptions } = require("./schema-common");

const productSchema = new mongoose.Schema(
  {
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: "Business", required: true, index: true },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: "Category", default: null, index: true },
    name: { type: String, required: true },
    description: { type: String, default: null },
    basePrice: { type: Number, required: true },
    isAvailable: { type: Boolean, default: true },
    isVisible: { type: Boolean, default: true },
    imageUrl: { type: String, default: null },
  },
  baseSchemaOptions(),
);

productSchema.index({ businessId: 1, categoryId: 1 });
productSchema.index({ businessId: 1, isVisible: 1 });

module.exports = mongoose.model("Product", productSchema);
