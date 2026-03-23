import type { Express, Request, Response } from "express";
import { randomUUID } from "crypto";
import { z } from "zod";
import { getSql } from "../src/lib/db";
import { requireUser, sendAuth, errorResponse } from "../src/lib/api-auth";
import { isStaff, canManageCase } from "../src/lib/authz";
import {
  fetchReferenceData,
  fetchStudyGroupsEnriched,
  fetchLeaderCandidates,
} from "../src/lib/reference-data";
import type { BlockType } from "../src/types/db";
import { computeFormattedBlock } from "../src/lib/format-block-compute";
import { sanitizeStoredFormattedContent } from "../src/lib/sanitize-case-html";

const adminBodySchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("department"), name: z.string().min(1) }),
  z.object({ kind: z.literal("faculty"), name: z.string().min(1) }),
  z.object({
    kind: z.literal("courseLevel"),
    name: z.string().min(1),
    sort: z.number().int().optional(),
  }),
]);

const refKindParam = z.enum(["department", "faculty", "courseLevel"]);

const patchRefBodySchema = z.object({
  name: z.string().min(1),
  sort: z.number().int().optional(),
});

const formatBlockSchema = z.object({
  blockId: z.string(),
  previewOnly: z.boolean().optional(),
  rawText: z.string().nullable().optional(),
  commit: z
    .object({
      blockType: z.enum([
        "PLAIN",
        "PATIENT_SPEECH",
        "DOCTOR_NOTES",
        "NARRATOR",
        "IMAGE_URL",
      ]),
      formattedContent: z.string(),
    })
    .optional(),
});

export function registerMiscRoutes(app: Express) {
  app.get("/api/study-groups", async (req: Request, res: Response) => {
    const a = await requireUser(req);
    if (sendAuth(res, a)) return;
    const { session } = a;
    if (!isStaff(session.user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    const studyGroups = await fetchStudyGroupsEnriched();
    const leaderCandidates = await fetchLeaderCandidates({
      role: session.user.role,
      departmentId: session.user.departmentId,
    });
    res.json({ studyGroups, leaderCandidates });
  });

  app.get("/api/reference", async (req: Request, res: Response) => {
    const a = await requireUser(req);
    if (sendAuth(res, a)) return;
    const { session } = a;
    if (!isStaff(session.user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    const { departments, faculties, courseLevels } = await fetchReferenceData({
      role: session.user.role,
      departmentId: session.user.departmentId,
    });
    const studyGroups = await fetchStudyGroupsEnriched();
    res.json({ departments, faculties, courseLevels, studyGroups });
  });

  app.post("/api/admin/reference", async (req: Request, res: Response) => {
    const a = await requireUser(req);
    if (sendAuth(res, a)) return;
    const { session } = a;
    if (session.user.role !== "ADMIN") {
      return res.status(403).json({ error: "Forbidden" });
    }
    let body: z.infer<typeof adminBodySchema>;
    try {
      body = adminBodySchema.parse(req.body);
    } catch {
      return errorResponse(res, "Некорректные данные", 400);
    }
    const pool = getSql();
    if (body.kind === "department") {
      const id = randomUUID();
      await pool`
        INSERT INTO "Department" (id, name) VALUES (${id}, ${body.name.trim()})
      `;
      const [row] = await pool<{ id: string; name: string }[]>`
        SELECT id, name FROM "Department" WHERE id = ${id}
      `;
      return res.json({ item: row });
    }
    if (body.kind === "faculty") {
      const id = randomUUID();
      await pool`INSERT INTO "Faculty" (id, name) VALUES (${id}, ${body.name.trim()})`;
      const [row] = await pool<{ id: string; name: string }[]>`
        SELECT id, name FROM "Faculty" WHERE id = ${id}
      `;
      return res.json({ item: row });
    }
    const maxRows = await pool<[{ m: number | null }]>`
      SELECT MAX("sort") AS m FROM "CourseLevel"
    `;
    const nextSort =
      body.sort ?? (maxRows[0]?.m != null ? maxRows[0].m! + 1 : 0);
    const id = randomUUID();
    await pool`
      INSERT INTO "CourseLevel" (id, name, sort) VALUES (${id}, ${body.name.trim()}, ${nextSort})
    `;
    const [row] = await pool<{ id: string; name: string; sort: number }[]>`
      SELECT id, name, sort FROM "CourseLevel" WHERE id = ${id}
    `;
    res.json({ item: row });
  });

  app.patch(
    "/api/admin/reference/:kind/:id",
    async (req: Request, res: Response) => {
      const a = await requireUser(req);
      if (sendAuth(res, a)) return;
      const { session } = a;
      if (session.user.role !== "ADMIN") {
        return res.status(403).json({ error: "Forbidden" });
      }
      let kind: z.infer<typeof refKindParam>;
      try {
        kind = refKindParam.parse(req.params.kind);
      } catch {
        return errorResponse(res, "Некорректный тип справочника", 400);
      }
      const id = req.params.id;
      if (!id) return errorResponse(res, "Не указан id", 400);
      let body: z.infer<typeof patchRefBodySchema>;
      try {
        body = patchRefBodySchema.parse(req.body);
      } catch {
        return errorResponse(res, "Некорректные данные", 400);
      }
      const name = body.name.trim();
      const pool = getSql();
      if (kind === "department") {
        if (body.sort !== undefined) {
          return errorResponse(res, "Поле sort не применимо к кафедре", 400);
        }
        const rows = await pool<{ id: string; name: string }[]>`
          UPDATE "Department"
          SET name = ${name}
          WHERE id = ${id}
          RETURNING id, name
        `;
        const row = rows[0];
        if (!row) return errorResponse(res, "Кафедра не найдена", 404);
        return res.json({ item: row });
      }
      if (kind === "faculty") {
        if (body.sort !== undefined) {
          return errorResponse(res, "Поле sort не применимо к факультету", 400);
        }
        const rows = await pool<{ id: string; name: string }[]>`
          UPDATE "Faculty"
          SET name = ${name}
          WHERE id = ${id}
          RETURNING id, name
        `;
        const row = rows[0];
        if (!row) return errorResponse(res, "Факультет не найден", 404);
        return res.json({ item: row });
      }
      const [existing] = await pool<
        { id: string; name: string; sort: number }[]
      >`SELECT id, name, sort FROM "CourseLevel" WHERE id = ${id}`;
      if (!existing) {
        return errorResponse(res, "Уровень курса не найден", 404);
      }
      const nextSort =
        body.sort !== undefined ? body.sort : existing.sort;
      const rows = await pool<{ id: string; name: string; sort: number }[]>`
        UPDATE "CourseLevel"
        SET name = ${name}, sort = ${nextSort}
        WHERE id = ${id}
        RETURNING id, name, sort
      `;
      const row = rows[0]!;
      return res.json({ item: row });
    },
  );

  app.delete(
    "/api/admin/reference/:kind/:id",
    async (req: Request, res: Response) => {
      const a = await requireUser(req);
      if (sendAuth(res, a)) return;
      const { session } = a;
      if (session.user.role !== "ADMIN") {
        return res.status(403).json({ error: "Forbidden" });
      }
      let kind: z.infer<typeof refKindParam>;
      try {
        kind = refKindParam.parse(req.params.kind);
      } catch {
        return errorResponse(res, "Некорректный тип справочника", 400);
      }
      const id = req.params.id;
      if (!id) return errorResponse(res, "Не указан id", 400);
      const pool = getSql();
      if (kind === "department") {
        const [{ blocked }] = await pool<[{ blocked: boolean }]>`
          SELECT EXISTS(SELECT 1 FROM "Case" WHERE "departmentId" = ${id}) AS blocked
        `;
        if (blocked) {
          return errorResponse(
            res,
            "Нельзя удалить кафедру: к ней привязаны кейсы",
            409,
          );
        }
        const deleted = await pool`
          DELETE FROM "Department" WHERE id = ${id}
        `;
        if (deleted.count === 0) {
          return errorResponse(res, "Кафедра не найдена", 404);
        }
        return res.status(204).end();
      }
      if (kind === "faculty") {
        const [{ blocked }] = await pool<[{ blocked: boolean }]>`
          SELECT EXISTS(SELECT 1 FROM "StudyGroup" WHERE "facultyId" = ${id}) AS blocked
        `;
        if (blocked) {
          return errorResponse(
            res,
            "Нельзя удалить факультет: есть учебные группы с этим факультетом",
            409,
          );
        }
        const deleted = await pool`
          DELETE FROM "Faculty" WHERE id = ${id}
        `;
        if (deleted.count === 0) {
          return errorResponse(res, "Факультет не найден", 404);
        }
        return res.status(204).end();
      }
      const [{ blocked }] = await pool<[{ blocked: boolean }]>`
        SELECT EXISTS(SELECT 1 FROM "StudyGroup" WHERE "courseLevelId" = ${id}) AS blocked
      `;
      if (blocked) {
        return errorResponse(
          res,
          "Нельзя удалить уровень курса: есть учебные группы с этим уровнем",
          409,
        );
      }
      const deleted = await pool`
        DELETE FROM "CourseLevel" WHERE id = ${id}
      `;
      if (deleted.count === 0) {
        return errorResponse(res, "Уровень курса не найден", 404);
      }
      return res.status(204).end();
    },
  );

  app.post("/api/ai/format-block", async (req: Request, res: Response) => {
    const a = await requireUser(req);
    if (sendAuth(res, a)) return;
    const { session } = a;
    if (!isStaff(session.user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    let body: z.infer<typeof formatBlockSchema>;
    try {
      body = formatBlockSchema.parse(req.body);
    } catch {
      return errorResponse(res, "Некорректные данные", 400);
    }
    if (body.commit && body.previewOnly) {
      return errorResponse(res, "Нельзя одновременно commit и previewOnly", 400);
    }
    const pool = getSql();
    const blockRows = await pool<
      {
        id: string;
        caseStageId: string;
        blockType: BlockType;
        rawText: string | null;
        formattedContent: string | null;
        imageUrl: string | null;
        imageAlt: string | null;
        caseId: string;
        departmentId: string;
      }[]
    >`
      SELECT sb.id, sb."caseStageId", sb."blockType", sb."rawText", sb."formattedContent", sb."imageUrl", sb."imageAlt",
             cs."caseId" as "caseId", c."departmentId" as "departmentId"
      FROM "StageBlock" sb
      JOIN "CaseStage" cs ON cs.id = sb."caseStageId"
      JOIN "Case" c ON c.id = cs."caseId"
      WHERE sb.id = ${body.blockId}
      LIMIT 1
    `;
    const block = blockRows[0];
    if (!block) return errorResponse(res, "Блок не найден", 404);
    if (!canManageCase(session, block.departmentId)) {
      return errorResponse(res, "Нет доступа", 403);
    }
    if (body.commit) {
      const safeContent = sanitizeStoredFormattedContent(
        body.commit.formattedContent,
      );
      if (body.rawText !== undefined) {
        await pool`
          UPDATE "StageBlock"
          SET "blockType" = ${body.commit.blockType},
              "formattedContent" = ${safeContent},
              "rawText" = ${body.rawText}
          WHERE id = ${block.id}
        `;
      } else {
        await pool`
          UPDATE "StageBlock"
          SET "blockType" = ${body.commit.blockType},
              "formattedContent" = ${safeContent}
          WHERE id = ${block.id}
        `;
      }
      await pool`
        UPDATE "Case" SET "caseVersion" = "caseVersion" + 1 WHERE id = ${block.caseId}
      `;
      const updatedRows = await pool<
        {
          id: string;
          caseStageId: string;
          order: number;
          blockType: BlockType;
          rawText: string | null;
          formattedContent: string | null;
          imageUrl: string | null;
          imageAlt: string | null;
        }[]
      >`
        SELECT id, "caseStageId", "order", "blockType", "rawText", "formattedContent", "imageUrl", "imageAlt"
        FROM "StageBlock" WHERE id = ${block.id}
      `;
      return res.json({ block: updatedRows[0] });
    }
    const rawForFormat =
      body.rawText !== undefined
        ? (body.rawText ?? "")
        : (block.rawText ?? "");
    const { blockType, formattedContent, hint } = await computeFormattedBlock(
      rawForFormat,
      block,
    );
    if (body.previewOnly) {
      return res.json({
        preview: { blockType, formattedContent },
        hint: hint ?? null,
      });
    }
    await pool`
      UPDATE "StageBlock"
      SET "blockType" = ${blockType}, "formattedContent" = ${formattedContent}
      WHERE id = ${block.id}
    `;
    await pool`
      UPDATE "Case" SET "caseVersion" = "caseVersion" + 1 WHERE id = ${block.caseId}
    `;
    const updatedRows = await pool<
      {
        id: string;
        caseStageId: string;
        order: number;
        blockType: BlockType;
        rawText: string | null;
        formattedContent: string | null;
        imageUrl: string | null;
        imageAlt: string | null;
      }[]
    >`
      SELECT id, "caseStageId", "order", "blockType", "rawText", "formattedContent", "imageUrl", "imageAlt"
      FROM "StageBlock" WHERE id = ${block.id}
    `;
    res.json({ block: updatedRows[0] });
  });
}
