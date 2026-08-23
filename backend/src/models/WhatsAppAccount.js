"use strict";

const mongoose = require("mongoose");
const { baseSchemaOptions } = require("./schema-common");
const { WHATSAPP_ACCOUNT_STATUSES } = require("./enums");

const whatsAppAccountSchema = new mongoose.Schema(
  {
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: "Business", required: true, unique: true },
    wabaId: { type: String, default: null },
    phoneNumberId: { type: String, required: true, unique: true },
    displayPhone: { type: String, default: null },
    accessTokenEncrypted: { type: String, required: true },
    webhookVerifyTokenHash: { type: String, required: true },
    status: { type: String, enum: WHATSAPP_ACCOUNT_STATUSES, default: "DISCONNECTED" },
    lastError: { type: String, default: null },
    connectedAt: { type: Date, default: null },
  },
  baseSchemaOptions(),
);

module.exports = mongoose.model("WhatsAppAccount", whatsAppAccountSchema);
