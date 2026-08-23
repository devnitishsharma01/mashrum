"use strict";

function toNumber(value) {
  if (typeof value === "number") return value;
  return Number(value);
}

module.exports = { toNumber };
