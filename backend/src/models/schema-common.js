"use strict";

const mongoose = require("mongoose");

function jsonTransform(_doc, ret) {
  ret.id = ret._id.toString();
  delete ret._id;
  delete ret.__v;
  return ret;
}

function baseSchemaOptions() {
  return {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: jsonTransform,
    },
    toObject: {
      virtuals: true,
      transform: jsonTransform,
    },
  };
}

function refId(value) {
  if (value == null) return value;
  if (value instanceof mongoose.Types.ObjectId) return value;
  return new mongoose.Types.ObjectId(value);
}

module.exports = {
  baseSchemaOptions,
  jsonTransform,
  refId,
};
