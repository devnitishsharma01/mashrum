"use strict";

const mongoose = require("mongoose");
const { baseSchemaOptions } = require("./schema-common");

const refreshTokenSchema = new mongoose.Schema(
  {
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: "Business", required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
  },
  { ...baseSchemaOptions(), updatedAt: false },
);

module.exports = mongoose.model("RefreshToken", refreshTokenSchema);
