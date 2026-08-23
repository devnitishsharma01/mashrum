"use strict";

const mongoose = require("mongoose");
const { baseSchemaOptions } = require("./schema-common");
const { USER_ROLES } = require("./enums");

const userSchema = new mongoose.Schema(
  {
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: "Business", required: true, index: true },
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    passwordHash: { type: String, required: true },
    name: { type: String, required: true },
    role: { type: String, enum: USER_ROLES, default: "OWNER" },
    isActive: { type: Boolean, default: true },
  },
  baseSchemaOptions(),
);

userSchema.index({ businessId: 1, email: 1 }, { unique: true });

module.exports = mongoose.model("User", userSchema);
