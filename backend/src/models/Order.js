"use strict";

const mongoose = require("mongoose");
const { baseSchemaOptions } = require("./schema-common");
const {
  ORDER_STATUSES,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  ACTOR_TYPES,
} = require("./enums");

const orderItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", default: null },
    variantId: { type: mongoose.Schema.Types.ObjectId, ref: "ProductVariant", default: null },
    nameSnapshot: { type: String, required: true },
    qty: { type: Number, required: true },
    unitPrice: { type: Number, required: true },
    lineTotal: { type: Number, required: true },
  },
);

const orderTimelineSchema = new mongoose.Schema(
  {
    fromStatus: { type: String, enum: ORDER_STATUSES, default: null },
    toStatus: { type: String, enum: ORDER_STATUSES, required: true },
    actorType: { type: String, enum: ACTOR_TYPES, required: true },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    note: { type: String, default: null },
    createdAt: { type: Date, default: Date.now },
  },
);

const orderSchema = new mongoose.Schema(
  {
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: "Business", required: true, index: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true, index: true },
    orderNumber: { type: String, required: true },
    status: { type: String, enum: ORDER_STATUSES, default: "NEW" },
    paymentMethod: { type: String, enum: PAYMENT_METHODS, default: "COD" },
    paymentStatus: { type: String, enum: PAYMENT_STATUSES, default: "PENDING" },
    subtotal: { type: Number, required: true },
    total: { type: Number, required: true },
    deliveryAddressSnapshot: { type: mongoose.Schema.Types.Mixed, default: null },
    notes: { type: String, default: null },
    stockReserved: { type: Boolean, default: false },
    items: { type: [orderItemSchema], default: [] },
    timeline: { type: [orderTimelineSchema], default: [] },
  },
  baseSchemaOptions(),
);

orderSchema.index({ businessId: 1, orderNumber: 1 }, { unique: true });
orderSchema.index({ businessId: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model("Order", orderSchema);
