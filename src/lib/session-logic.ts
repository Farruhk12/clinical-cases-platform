import { asTransactionSql, getSql } from "./db";
import { loadCaseDetail } from "./case-detail";
import { randomUUID } from "crypto";

export type DraftItem = { text: string; lineageId?: string };

export async function updateSessionDraft(
  sessionId: string,
  items: { hypotheses: DraftItem[]; questions: DraftItem[] },
) {
  const pool = getSql();
  const sessRows = await pool<
    { id: string; status: string; currentStageOrder: number; caseId: string }[]
  >`
    SELECT id, status, "currentStageOrder", "caseId" FROM "CaseSession" WHERE id = ${sessionId}
  `;
  const session = sessRows[0];
  if (!session) throw new Error("SESSION_NOT_FOUND");
  if (session.status !== "IN_PROGRESS") throw new Error("SESSION_CLOSED");

  const caseFull = await loadCaseDetail(session.caseId);
  if (!caseFull) throw new Error("SESSION_NOT_FOUND");

  const currentStage = caseFull.stages.find(
    (s) => s.order === session.currentStageOrder,
  );
  if (!currentStage) throw new Error("STAGE_NOT_FOUND");

  const subRows = await pool<{ id: string; submittedAt: Date | null }[]>`
    SELECT id, "submittedAt" FROM "StageSubmission"
    WHERE "caseSessionId" = ${session.id} AND "caseStageId" = ${currentStage.id}
    LIMIT 1
  `;
  const submission = subRows[0];
  if (!submission) throw new Error("SUBMISSION_NOT_FOUND");
  if (submission.submittedAt) throw new Error("STAGE_ALREADY_SUBMITTED");

  await pool.begin(async (txn) => {
    const sql = asTransactionSql(pool, txn);
    await sql`DELETE FROM "Hypothesis" WHERE "stageSubmissionId" = ${submission.id}`;
    await sql`DELETE FROM "StudentQuestion" WHERE "stageSubmissionId" = ${submission.id}`;
    for (let i = 0; i < items.hypotheses.length; i++) {
      const h = items.hypotheses[i];
      await sql`
        INSERT INTO "Hypothesis" (id, "stageSubmissionId", text, "lineageId", sort)
        VALUES (${randomUUID()}, ${submission.id}, ${h.text}, ${h.lineageId ?? randomUUID()}, ${i})
      `;
    }
    for (let i = 0; i < items.questions.length; i++) {
      const q = items.questions[i];
      await sql`
        INSERT INTO "StudentQuestion" (id, "stageSubmissionId", text, "lineageId", sort)
        VALUES (${randomUUID()}, ${submission.id}, ${q.text}, ${q.lineageId ?? randomUUID()}, ${i})
      `;
    }
  });

  return { ok: true as const };
}

export async function advanceSession(sessionId: string) {
  const pool = getSql();
  const sessRows = await pool<
    { id: string; status: string; currentStageOrder: number; caseId: string }[]
  >`
    SELECT id, status, "currentStageOrder", "caseId" FROM "CaseSession" WHERE id = ${sessionId}
  `;
  const session = sessRows[0];
  if (!session) throw new Error("SESSION_NOT_FOUND");
  if (session.status !== "IN_PROGRESS") throw new Error("SESSION_CLOSED");

  const caseFull = await loadCaseDetail(session.caseId);
  if (!caseFull) throw new Error("SESSION_NOT_FOUND");

  const stages = caseFull.stages;
  const currentStage = stages.find((s) => s.order === session.currentStageOrder);
  if (!currentStage) throw new Error("STAGE_NOT_FOUND");

  const now = new Date();

  const subRows = await pool<
    { id: string; submittedAt: Date | null }[]
  >`
    SELECT id, "submittedAt" FROM "StageSubmission"
    WHERE "caseSessionId" = ${session.id} AND "caseStageId" = ${currentStage.id}
    LIMIT 1
  `;
  const currentSubmission = subRows[0];
  if (!currentSubmission) throw new Error("SUBMISSION_NOT_FOUND");
  if (currentSubmission.submittedAt) throw new Error("STAGE_ALREADY_SUBMITTED");

  const hypRows = await pool<
    { id: string; text: string; lineageId: string; sort: number }[]
  >`
    SELECT id, text, "lineageId", sort FROM "Hypothesis"
    WHERE "stageSubmissionId" = ${currentSubmission.id} ORDER BY sort
  `;
  const qRows = await pool<
    { id: string; text: string; lineageId: string; sort: number }[]
  >`
    SELECT id, text, "lineageId", sort FROM "StudentQuestion"
    WHERE "stageSubmissionId" = ${currentSubmission.id} ORDER BY sort
  `;

  const idx = stages.findIndex((s) => s.id === currentStage.id);
  const nextStage = stages[idx + 1];

  await pool`UPDATE "StageSubmission" SET "submittedAt" = ${now} WHERE id = ${currentSubmission.id}`;

  if (!nextStage) {
    await pool`
      UPDATE "CaseSession" SET status = 'COMPLETED', "completedAt" = ${now} WHERE id = ${session.id}
    `;
    const oid = randomUUID();
    await pool`
      INSERT INTO "SessionOutcome" (id, "caseSessionId")
      VALUES (${oid}, ${session.id})
      ON CONFLICT ("caseSessionId") DO NOTHING
    `;
    return { completed: true as const };
  }

  await pool`
    UPDATE "CaseSession" SET "currentStageOrder" = ${nextStage.order} WHERE id = ${session.id}
  `;

  const newSubId = randomUUID();
  await pool.begin(async (txn) => {
    const sql = asTransactionSql(pool, txn);
    await sql`
      INSERT INTO "StageSubmission" (id, "caseSessionId", "caseStageId", "openedAt")
      VALUES (${newSubId}, ${session.id}, ${nextStage.id}, ${now})
    `;
    for (let i = 0; i < hypRows.length; i++) {
      const h = hypRows[i];
      await sql`
        INSERT INTO "Hypothesis" (id, "stageSubmissionId", text, "lineageId", sort)
        VALUES (${randomUUID()}, ${newSubId}, ${h.text}, ${h.lineageId}, ${i})
      `;
    }
    for (let i = 0; i < qRows.length; i++) {
      const q = qRows[i];
      await sql`
        INSERT INTO "StudentQuestion" (id, "stageSubmissionId", text, "lineageId", sort)
        VALUES (${randomUUID()}, ${newSubId}, ${q.text}, ${q.lineageId}, ${i})
      `;
    }
  });

  return { completed: false as const, nextStageOrder: nextStage.order };
}

export async function forceCompleteSession(sessionId: string) {
  const pool = getSql();
  const sessRows = await pool<
    { id: string; status: string; currentStageOrder: number; caseId: string }[]
  >`
    SELECT id, status, "currentStageOrder", "caseId" FROM "CaseSession" WHERE id = ${sessionId}
  `;
  const session = sessRows[0];
  if (!session) throw new Error("SESSION_NOT_FOUND");
  if (session.status !== "IN_PROGRESS") throw new Error("SESSION_CLOSED");

  const caseFull = await loadCaseDetail(session.caseId);
  if (!caseFull) throw new Error("SESSION_NOT_FOUND");

  const currentStage = caseFull.stages.find(
    (s) => s.order === session.currentStageOrder,
  );
  if (!currentStage) throw new Error("STAGE_NOT_FOUND");

  const now = new Date();

  const subRows = await pool<{ id: string; submittedAt: Date | null }[]>`
    SELECT id, "submittedAt" FROM "StageSubmission"
    WHERE "caseSessionId" = ${session.id} AND "caseStageId" = ${currentStage.id}
    LIMIT 1
  `;
  const currentSubmission = subRows[0];
  if (!currentSubmission) throw new Error("SUBMISSION_NOT_FOUND");
  if (!currentSubmission.submittedAt) {
    await pool`
      UPDATE "StageSubmission" SET "submittedAt" = ${now} WHERE id = ${currentSubmission.id}
    `;
  }

  await pool`
    UPDATE "CaseSession" SET status = 'COMPLETED', "completedAt" = ${now} WHERE id = ${session.id}
  `;
  const oid = randomUUID();
  await pool`
    INSERT INTO "SessionOutcome" (id, "caseSessionId")
    VALUES (${oid}, ${session.id})
    ON CONFLICT ("caseSessionId") DO NOTHING
  `;

  return { completed: true as const };
}
