"use strict";

const ALLOWED_TRANSITIONS = {
  NEW: ["CONFIRMED", "CANCELLED", "CUSTOMER_NOT_REACHABLE"],
  CONFIRMED: ["PROCESSING", "CANCELLED", "CUSTOMER_NOT_REACHABLE"],
  PROCESSING: ["READY", "CANCELLED", "CUSTOMER_NOT_REACHABLE"],
  READY: ["OUT_FOR_DELIVERY", "CANCELLED", "CUSTOMER_NOT_REACHABLE"],
  OUT_FOR_DELIVERY: [
    "DELIVERED",
    "DELIVERY_FAILED",
    "CUSTOMER_NOT_REACHABLE",
    "CANCELLED",
  ],
  DELIVERED: ["COMPLETED", "RETURNED"],
  COMPLETED: [],
  CANCELLED: [],
  DELIVERY_FAILED: ["OUT_FOR_DELIVERY", "CANCELLED", "RETURNED"],
  RETURNED: [],
  CUSTOMER_NOT_REACHABLE: [
    "CONFIRMED",
    "PROCESSING",
    "READY",
    "OUT_FOR_DELIVERY",
    "CANCELLED",
  ],
};

function canTransition(from, to) {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

function getAllowedTransitions(from) {
  return ALLOWED_TRANSITIONS[from] ?? [];
}

/** Inventory is deducted when moving into CONFIRMED. */
function shouldDeductInventory(from, to) {
  return from === "NEW" && to === "CONFIRMED";
}

/**
 * Inventory is restored on cancel/return only if stock was previously reserved.
 * Callers should also check Order.stockReserved.
 */
function shouldRestoreInventory(from, to, stockReserved = true) {
  if (!stockReserved) return false;
  if (to !== "CANCELLED" && to !== "RETURNED") return false;
  return from !== "NEW" && from !== "CANCELLED" && from !== "RETURNED";
}

module.exports = {
  canTransition,
  getAllowedTransitions,
  shouldDeductInventory,
  shouldRestoreInventory,
};
