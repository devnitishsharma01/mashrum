"use strict";

const mongoose = require("mongoose");
const { baseSchemaOptions } = require("./schema-common");

const categorySchema = new mongoose.Schema(
  {
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: "Business", required: true, index: true },
    name: { type: String, required: true },
    slug: { type: String, required: true },
    sortOrder: { type: Number, default: 0 },
    isVisible: { type: Boolean, default: true },
  },
  baseSchemaOptions(),
);

categorySchema.index({ businessId: 1, slug: 1 }, { unique: true });
categorySchema.index({ businessId: 1, sortOrder: 1 });

module.exports = mongoose.model("Category", categorySchema);
