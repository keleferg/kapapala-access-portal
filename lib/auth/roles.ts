export type UserRole =
  | "admin"
  | "staff"
  | "public_user"
  | "gate_operator"
  | "read_only";

export const ADMIN_ROLES: UserRole[] = ["admin", "staff"];

export function canAccessAdmin(role: string | null | undefined) {
  return role === "admin" || role === "staff";
}

export function canManageSystem(role: string | null | undefined) {
  return role === "admin";
}

export function canOperateGate(role: string | null | undefined) {
  return role === "admin" || role === "staff" || role === "gate_operator";
}

export function canViewOwnPortal(role: string | null | undefined) {
  return Boolean(role);
}