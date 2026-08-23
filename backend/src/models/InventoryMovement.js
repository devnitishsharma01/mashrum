"use strict";

const mongoose = require("mongoose");
const { baseSchemaOptions } = require("./schema-common");
const { INVENTORY_MOVEMENT_REASONS } = require("./enums");

const inventoryMovementSchema = new mongoose.Schema(
  {
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: "Business", required: true, index: true },
    inventoryId: { type: mongoose.Schema.Types.ObjectId, ref: "Inventory", required: true, index: true },
    delta: { type: Number, required: true },
    reason: { type: String, enum: INVENTORY_MOVEMENT_REASONS, required: true },
    refType: { type: String, default: null },
    refId: { type: mongoose.Schema.Types.ObjectId, default: null },
    note: { type: String, default: null },
  },
  { ...baseSchemaOptions(), updatedAt: false },
);

inventoryMovementSchema.index({ businessId: 1, createdAt: -1 });

module.exports = mongoose.model("InventoryMovement", inventoryMovementSchema);
