"use strict";

const mongoose = require("mongoose");
const { baseSchemaOptions } = require("./schema-common");
const { MESSAGE_DIRECTIONS, MESSAGE_STATUSES } = require("./enums");

const whatsAppMessageSchema = new mongoose.Schema(
  {
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: "Business", required: true, index: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", default: null },
    direction: { type: String, enum: MESSAGE_DIRECTIONS, required: true },
    waMessageId: { type: String, default: null, unique: true, sparse: true },
    type: { type: String, required: true },
    body: { type: String, default: null },
    status: { type: String, enum: MESSAGE_STATUSES, default: "QUEUED" },
    error: { type: String, default: null },
    rawPayload: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  baseSchemaOptions(),
);

whatsAppMessageSchema.index({ businessId: 1, customerId: 1, createdAt: -1 });

module.exports = mongoose.model("WhatsAppMessage", whatsAppMessageSchema);
