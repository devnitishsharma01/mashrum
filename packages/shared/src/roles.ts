import type { UserRole } from "./constants";

export type Permission =
  | "business:read"
  | "business:write"
  | "users:read"
  | "users:write"
  | "catalog:read"
  | "catalog:write"
  | "customers:read"
  | "customers:write"
  | "orders:read"
  | "orders:write"
  | "inventory:read"
  | "inventory:write"
  | "reports:read"
  | "whatsapp:manage"
  | "settings:write"
  | "payments:write";

const ALL_PERMISSIONS: Permission[] = [
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

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
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

export function getPermissionsForRole(role: UserRole): Permission[] {
  return ROLE_PERMISSIONS[role];
}

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return getPermissionsForRole(role).includes(permission);
}
