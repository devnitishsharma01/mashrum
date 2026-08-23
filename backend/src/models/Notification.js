"use strict";

const mongoose = require("mongoose");
const { baseSchemaOptions } = require("./schema-common");

const notificationSchema = new mongoose.Schema(
  {
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: "Business", required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: { type: String, required: true },
    title: { type: String, required: true },
    body: { type: String, default: null },
    payload: { type: mongoose.Schema.Types.Mixed, default: null },
    readAt: { type: Date, default: null },
  },
  { ...baseSchemaOptions(), updatedAt: false },
);

notificationSchema.index({ userId: 1, readAt: 1 });

module.exports = mongoose.model("Notification", notificationSchema);
