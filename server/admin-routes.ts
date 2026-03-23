import type { Express, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { z } from "zod";
import { getSql } from "../src/lib/db";
import { requireUser, sendAuth, errorResponse } from "../src/lib/api-auth";
import { routeParam } from "./param";

const loginSchema = z
  .string()
  .min(1)
  .max(128)
  .transform((s) => s.trim());

const createUserSchema = z.object({
  login: loginSchema,
  password: z.string().min(6),
  name: z.string().min(1).nullable().optional(),
  role: z.enum(["ADMIN", "TEACHER"]),
  departmentId: z.string().nullable().optional(),
});

const patchUserSchema = z.object({
  login: z
    .string()
    .min(1)
    .max(128)
    .transform((s) => s.trim())
    .optional(),
  password: z.string().min(6).optional(),
  name: z.string().nullable().optional(),
  role: z.enum(["ADMIN", "TEACHER"]).optional(),
  departmentId: z.string().nullable().optional(),
});

export function registerAdminRoutes(app: Express) {
  /* ───── список пользователей ───── */
  app.get("/api/admin/users", async (req: Request, res: Response) => {
    const a = await requireUser(req);
    if (sendAuth(res, a)) return;
    if (a.session.user.role !== "ADMIN") {
      return res.status(403).json({ error: "Forbidden" });
    }
    const sql = getSql();
    const rows = await sql<
      {
        id: string;
        login: string;
        name: string | null;
        role: string;
        departmentId: string | null;
        departmentName: string | null;
      }[]
    >`
      SELECT u.id, u.login, u.name, u.role, u."departmentId",
             d.name AS "departmentName"
      FROM "User" u
      LEFT JOIN "Department" d ON d.id = u."departmentId"
      ORDER BY u.login
    `;
    res.json({ users: rows });
  });

  /* ───── создание пользователя ───── */
  app.post("/api/admin/users", async (req: Request, res: Response) => {
    const a = await requireUser(req);
    if (sendAuth(res, a)) return;
    if (a.session.user.role !== "ADMIN") {
      return res.status(403).json({ error: "Forbidden" });
    }
    let body: z.infer<typeof createUserSchema>;
    try {
      body = createUserSchema.parse(req.body);
    } catch {
      return errorResponse(res, "Некорректные данные", 400);
    }
    const id = randomUUID();
    const hash = await bcrypt.hash(body.password, 10);
    const sql = getSql();
    try {
      await sql`
        INSERT INTO "User" (id, login, "passwordHash", name, role, "departmentId")
        VALUES (${id}, ${body.login}, ${hash}, ${body.name?.trim() ?? null}, ${body.role}, ${body.departmentId ?? null})
      `;
    } catch (e: unknown) {
      if (
        e &&
        typeof e === "object" &&
        "code" in e &&
        (e as { code: string }).code === "23505"
      ) {
        return errorResponse(
          res,
          "Пользователь с таким логином уже существует",
          409,
        );
      }
      throw e;
    }
    res.json({
      user: {
        id,
        login: body.login,
        name: body.name?.trim() ?? null,
        role: body.role,
        departmentId: body.departmentId ?? null,
      },
    });
  });

  /* ───── редактирование пользователя ───── */
  app.patch("/api/admin/users/:id", async (req: Request, res: Response) => {
    const a = await requireUser(req);
    if (sendAuth(res, a)) return;
    if (a.session.user.role !== "ADMIN") {
      return res.status(403).json({ error: "Forbidden" });
    }
    const userId = routeParam(req.params.id);
    if (!userId) return errorResponse(res, "Некорректный id", 400);

    let body: z.infer<typeof patchUserSchema>;
    try {
      body = patchUserSchema.parse(req.body);
    } catch {
      return errorResponse(res, "Некорректные данные", 400);
    }

    const sql = getSql();
    const existing = (
      await sql<
        {
          id: string;
          login: string;
          passwordHash: string;
          name: string | null;
          role: string;
          departmentId: string | null;
        }[]
      >`SELECT id, login, "passwordHash", name, role, "departmentId" FROM "User" WHERE id = ${userId}`
    )[0];
    if (!existing) return errorResponse(res, "Пользователь не найден", 404);

    const login = body.login ?? existing.login;
    const name = body.name !== undefined ? (body.name?.trim() ?? null) : existing.name;
    const role = body.role ?? existing.role;
    const departmentId =
      body.departmentId !== undefined ? body.departmentId : existing.departmentId;
    const passwordHash = body.password
      ? await bcrypt.hash(body.password, 10)
      : existing.passwordHash;

    try {
      await sql`
        UPDATE "User"
        SET login = ${login},
            "passwordHash" = ${passwordHash},
            name = ${name},
            role = ${role},
            "departmentId" = ${departmentId}
        WHERE id = ${userId}
      `;
    } catch (e: unknown) {
      if (
        e &&
        typeof e === "object" &&
        "code" in e &&
        (e as { code: string }).code === "23505"
      ) {
        return errorResponse(
          res,
          "Пользователь с таким логином уже существует",
          409,
        );
      }
      throw e;
    }
    res.json({
      user: { id: userId, login, name, role, departmentId },
    });
  });

  /* ───── удаление пользователя ───── */
  app.delete("/api/admin/users/:id", async (req: Request, res: Response) => {
    const a = await requireUser(req);
    if (sendAuth(res, a)) return;
    if (a.session.user.role !== "ADMIN") {
      return res.status(403).json({ error: "Forbidden" });
    }
    const userId = routeParam(req.params.id);
    if (!userId) return errorResponse(res, "Некорректный id", 400);
    if (a.session.user.id === userId) {
      return errorResponse(res, "Нельзя удалить собственный аккаунт", 400);
    }

    const sql = getSql();
    const existing = (
      await sql<{ id: string }[]>`SELECT id FROM "User" WHERE id = ${userId}`
    )[0];
    if (!existing) return errorResponse(res, "Пользователь не найден", 404);

    const sessions = (
      await sql<[{ c: number }]>`
        SELECT COUNT(*)::int AS c FROM "CaseSession" WHERE "leaderUserId" = ${userId}
      `
    )[0];
    if (sessions.c > 0) {
      return errorResponse(
        res,
        "Нельзя удалить пользователя — он является ведущим в сессиях",
        409,
      );
    }

    await sql`DELETE FROM "StudyGroupMember" WHERE "userId" = ${userId}`;
    await sql`DELETE FROM "User" WHERE id = ${userId}`;
    res.json({ ok: true });
  });
}
