"use strict";

const ALL_PERMISSIONS = [
  "business:read",
  "business:write",
  "users:read",
  "users:write",
  "catalog:read",
  "catalog:write",
  "customers:read",
  "customers:write",
  "orders:read",
  "orders:write",
  "inventory:read",
  "inventory:write",
  "reports:read",
  "whatsapp:manage",
  "settings:write",
  "payments:write",
];

const ROLE_PERMISSIONS = {
  OWNER: ALL_PERMISSIONS,
  ADMIN: ALL_PERMISSIONS.filter((p) => p !== "users:write"),
  STAFF: [
    "business:read",
    "catalog:read",
    "customers:read",
    "customers:write",
    "orders:read",
    "orders:write",
    "inventory:read",
    "payments:write",
  ],
};

function getPermissionsForRole(role) {
  return ROLE_PERMISSIONS[role];
}

function hasPermission(role, permission) {
  return getPermissionsForRole(role).includes(permission);
}

module.exports = { getPermissionsForRole, hasPermission };
