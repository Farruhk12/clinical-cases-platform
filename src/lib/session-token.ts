import { SignJWT, jwtVerify } from "jose";
import type { Role } from "../types/db";

export const SESSION_COOKIE_NAME = "clinical_session";

export type SessionClaims = {
  sub: string;
  login: string;
  name: string | null;
  role: Role;
  departmentId: string | null;
};

function key() {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is not set");
  return new TextEncoder().encode(s);
}

export async function createSessionToken(p: SessionClaims): Promise<string> {
  return new SignJWT({
    login: p.login,
    name: p.name ?? "",
    role: p.role,
    departmentId: p.departmentId ?? "",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(p.sub)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(key());
}

export async function readSessionToken(
  token: string,
): Promise<SessionClaims | null> {
  try {
    const { payload } = await jwtVerify(token, key());
    const sub = payload.sub;
    if (!sub) return null;
    const loginRaw = payload.login ?? payload.email;
    const role = payload.role;
    if (typeof loginRaw !== "string" || typeof role !== "string") return null;
    const nameRaw = payload.name;
    const depRaw = payload.departmentId;
    return {
      sub,
      login: loginRaw,
      name:
        typeof nameRaw === "string" && nameRaw.length > 0 ? nameRaw : null,
      departmentId:
        typeof depRaw === "string" && depRaw.length > 0 ? depRaw : null,
      role: role as Role,
    };
  } catch {
    return null;
  }
}
