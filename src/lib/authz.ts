import type { AppSession } from "../types/session";
import type { Role } from "../types/db";

export function isStaff(role: Role) {
  return role === "ADMIN" || role === "TEACHER";
}

export function canManageCase(session: AppSession, departmentId: string) {
  const u = session.user;
  if (u.role === "ADMIN") return true;
  if (u.role === "TEACHER") {
    return u.departmentId === departmentId;
  }
  return false;
}
