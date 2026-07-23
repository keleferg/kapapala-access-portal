export type UserRole =
  | "user"
  | "admin"
  | "super_user"
  | "public_user"
  | "staff"
  | "gate_operator"
  | "read_only";

export const ADMIN_ROLES: UserRole[] = ["admin", "super_user"];

export function canAccessAdmin(role: string | null | undefined) {
  return role === "admin" || role === "super_user";
}

export function canManageSystem(role: string | null | undefined) {
  return role === "super_user";
}

export function canOperateGate(role: string | null | undefined) {
  return (
    role === "admin" ||
    role === "super_user" ||
    role === "gate_operator"
  );
}

export function canViewOwnPortal(role: string | null | undefined) {
  return Boolean(role);
}