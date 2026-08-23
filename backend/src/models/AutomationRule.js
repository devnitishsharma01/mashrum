"use strict";

const mongoose = require("mongoose");
const { baseSchemaOptions } = require("./schema-common");

const automationRuleSchema = new mongoose.Schema(
  {
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: "Business", required: true, index: true },
    event: { type: String, required: true },
    templateKey: { type: String, required: true },
    isEnabled: { type: Boolean, default: true },
  },
  baseSchemaOptions(),
);

automationRuleSchema.index({ businessId: 1, event: 1 }, { unique: true });

module.exports = mongoose.model("AutomationRule", automationRuleSchema);
