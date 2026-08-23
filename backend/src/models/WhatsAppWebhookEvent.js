"use strict";

const mongoose = require("mongoose");
const { baseSchemaOptions } = require("./schema-common");
const { WEBHOOK_EVENT_STATUSES } = require("./enums");

const whatsAppWebhookEventSchema = new mongoose.Schema(
  {
    providerEventId: { type: String, required: true, unique: true },
    phoneNumberId: { type: String, default: null, index: true },
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: "Business", default: null, index: true },
    payload: { type: mongoose.Schema.Types.Mixed, required: true },
    status: { type: String, enum: WEBHOOK_EVENT_STATUSES, default: "RECEIVED" },
    error: { type: String, default: null },
    processedAt: { type: Date, default: null },
  },
  { ...baseSchemaOptions(), updatedAt: false },
);

module.exports = mongoose.model("WhatsAppWebhookEvent", whatsAppWebhookEventSchema);
