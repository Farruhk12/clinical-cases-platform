import type { Request, Response } from "express";
import type { AppSession } from "../types/session";
import { readSessionToken, SESSION_COOKIE_NAME } from "./session-token";

export type AuthResult =
  | { ok: true; session: AppSession }
  | { ok: false; status: number; body: { error: string } };

export async function requireUser(req: Request): Promise<AuthResult> {
  const raw = req.cookies?.[SESSION_COOKIE_NAME];
  if (!raw) {
    return { ok: false, status: 401, body: { error: "Unauthorized" } };
  }
  const claims = await readSessionToken(raw);
  if (!claims) {
    return { ok: false, status: 401, body: { error: "Unauthorized" } };
  }
  return {
    ok: true,
    session: {
      user: {
        id: claims.sub,
        login: claims.login,
        name: claims.name,
        role: claims.role,
        departmentId: claims.departmentId,
      },
    },
  };
}

export function sendAuth(
  res: Response,
  a: AuthResult,
): a is { ok: false; status: number; body: { error: string } } {
  if (a.ok) return false;
  res.status(a.status).json(a.body);
  return true;
}

export function errorResponse(res: Response, message: string, status: number) {
  res.status(status).json({ error: message });
}

export function mapSessionError(code: string, res: Response) {
  switch (code) {
    case "SESSION_NOT_FOUND":
      return errorResponse(res, "Сессия не найдена", 404);
    case "FORBIDDEN":
      return errorResponse(res, "Недостаточно прав", 403);
    case "SESSION_CLOSED":
      return errorResponse(res, "Сессия завершена", 409);
    case "STAGE_NOT_FOUND":
      return errorResponse(res, "Этап не найден", 404);
    case "SUBMISSION_NOT_FOUND":
      return errorResponse(res, "Черновик этапа не найден", 404);
    case "STAGE_ALREADY_SUBMITTED":
      return errorResponse(res, "Этап уже отправлен", 409);
    default:
      return errorResponse(res, "Не удалось выполнить операцию", 400);
  }
}
