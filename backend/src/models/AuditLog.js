"use strict";

const mongoose = require("mongoose");
const { baseSchemaOptions } = require("./schema-common");

const auditLogSchema = new mongoose.Schema(
  {
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: "Business", required: true, index: true },
    actorUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    action: { type: String, required: true },
    entity: { type: String, required: true },
    entityId: { type: mongoose.Schema.Types.ObjectId, default: null },
    meta: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { ...baseSchemaOptions(), updatedAt: false },
);

auditLogSchema.index({ businessId: 1, createdAt: -1 });

module.exports = mongoose.model("AuditLog", auditLogSchema);
