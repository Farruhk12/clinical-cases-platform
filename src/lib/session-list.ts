import { getSql } from "./db";
import type { Role } from "../types/db";
import {
  loadCaseSessionBrief,
  type CaseSessionBrief,
} from "./session-detail";

export async function fetchSessionsList(opts: {
  role: Role;
  userId: string;
  departmentId?: string | null;
  caseId?: string;
  limit?: number;
}): Promise<CaseSessionBrief[]> {
  const pool = getSql();
  const limit = opts.limit ?? 50;
  const caseId = opts.caseId;

  let idRows: { id: string }[];
  if (opts.role === "ADMIN") {
    idRows = caseId
      ? await pool<{ id: string }[]>`
          SELECT id FROM "CaseSession" WHERE "caseId" = ${caseId}
          ORDER BY "startedAt" DESC LIMIT ${limit}
        `
      : await pool<{ id: string }[]>`
          SELECT id FROM "CaseSession" ORDER BY "startedAt" DESC LIMIT ${limit}
        `;
  } else if (opts.role === "TEACHER") {
    const dept = opts.departmentId;
    if (!dept) return [];
    idRows = caseId
      ? await pool<{ id: string }[]>`
          SELECT cs.id FROM "CaseSession" cs
          JOIN "Case" c ON c.id = cs."caseId"
          WHERE c."departmentId" = ${dept} AND cs."caseId" = ${caseId}
          ORDER BY cs."startedAt" DESC LIMIT ${limit}
        `
      : await pool<{ id: string }[]>`
          SELECT cs.id FROM "CaseSession" cs
          JOIN "Case" c ON c.id = cs."caseId"
          WHERE c."departmentId" = ${dept}
          ORDER BY cs."startedAt" DESC LIMIT ${limit}
        `;
  } else {
    return [];
  }

  const sessions = (
    await Promise.all(idRows.map((r) => loadCaseSessionBrief(r.id)))
  ).filter((s): s is CaseSessionBrief => s != null);
  return sessions;
}
