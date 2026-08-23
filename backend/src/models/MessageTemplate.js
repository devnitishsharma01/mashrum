"use strict";

const mongoose = require("mongoose");
const { baseSchemaOptions } = require("./schema-common");

const messageTemplateSchema = new mongoose.Schema(
  {
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: "Business", required: true, index: true },
    key: { type: String, required: true },
    name: { type: String, default: null },
    body: { type: String, required: true },
    metaTemplateName: { type: String, default: null },
    isActive: { type: Boolean, default: true },
  },
  baseSchemaOptions(),
);

messageTemplateSchema.index({ businessId: 1, key: 1 }, { unique: true });

module.exports = mongoose.model("MessageTemplate", messageTemplateSchema);
