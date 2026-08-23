"use strict";

const mongoose = require("mongoose");
const { baseSchemaOptions } = require("./schema-common");

const conversationSessionSchema = new mongoose.Schema(
  {
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: "Business", required: true, index: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true },
    state: { type: String, default: "IDLE" },
    context: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  baseSchemaOptions(),
);

conversationSessionSchema.index({ businessId: 1, customerId: 1 }, { unique: true });

module.exports = mongoose.model("ConversationSession", conversationSessionSchema);
