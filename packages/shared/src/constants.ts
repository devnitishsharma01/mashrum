export const APP_NAME = "Mashrum";

export const ORDER_STATUSES = [
  "NEW",
  "CONFIRMED",
  "PROCESSING",
  "READY",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "COMPLETED",
  "CANCELLED",
  "DELIVERY_FAILED",
  "RETURNED",
  "CUSTOMER_NOT_REACHABLE",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const PAYMENT_METHODS = ["COD"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_STATUSES = [
  "PENDING",
  "COLLECTED",
  "FAILED",
  "CANCELLED",
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const USER_ROLES = ["OWNER", "ADMIN", "STAFF"] as const;
export type UserRole = (typeof USER_ROLES)[number];
