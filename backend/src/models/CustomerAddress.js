"use strict";

const mongoose = require("mongoose");
const { baseSchemaOptions } = require("./schema-common");

const customerAddressSchema = new mongoose.Schema(
  {
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: "Business", required: true, index: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true, index: true },
    line1: { type: String, required: true },
    landmark: { type: String, default: null },
    city: { type: String, default: null },
    isDefault: { type: Boolean, default: false },
  },
  baseSchemaOptions(),
);

module.exports = mongoose.model("CustomerAddress", customerAddressSchema);
