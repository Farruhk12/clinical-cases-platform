import { loadCaseDetail, type CaseDetail } from "./case-detail";
import { getSql } from "./db";
import { fetchStaffPickListForDepartment } from "./reference-data";
import type { SessionStatus } from "../types/db";

export type SessionOutcomeRow = {
  id: string;
  caseSessionId: string;
  aiAnalysis: string | null;
  aiModel: string | null;
  aiPromptVersion: string | null;
  aiPreliminaryScores: unknown;
  teacherGrade: string | null;
  teacherComment: string | null;
  finalizedAt: Date | null;
};

export type CaseSessionDetail = {
  id: string;
  caseId: string;
  studyGroupId: string;
  leaderUserId: string;
  status: SessionStatus;
  currentStageOrder: number;
  caseVersionSnapshot: number;
  startedAt: Date;
  completedAt: Date | null;
  case: CaseDetail;
  studyGroup: {
    id: string;
    name: string;
    facultyId: string;
    courseLevelId: string;
    faculty: { id: string; name: string };
    courseLevel: { id: string; name: string; sort: number };
    members: { userId: string; user: { id: string; name: string | null; login: string } }[];
  };
  leader: { id: string; name: string | null; login: string };
  submissions: {
    id: string;
    caseSessionId: string;
    caseStageId: string;
    submittedAt: Date | null;
    openedAt: Date | null;
    stage: {
      id: string;
      caseId: string;
      order: number;
      title: string;
      isFinalReveal: boolean;
      learningGoals: string | null;
    };
    hypotheses: { id: string; text: string; lineageId: string; sort: number }[];
    questions: { id: string; text: string; lineageId: string; sort: number }[];
  }[];
  outcome: SessionOutcomeRow | null;
};

export async function loadCaseSessionDetail(
  sessionId: string,
): Promise<CaseSessionDetail | null> {
  const pool = getSql();
  const sessRows = await pool<
    {
      id: string;
      caseId: string;
      studyGroupId: string;
      leaderUserId: string;
      status: SessionStatus;
      currentStageOrder: number;
      caseVersionSnapshot: number;
      startedAt: Date;
      completedAt: Date | null;
    }[]
  >`
    SELECT id, "caseId", "studyGroupId", "leaderUserId", status, "currentStageOrder",
      "caseVersionSnapshot", "startedAt", "completedAt"
    FROM "CaseSession" WHERE id = ${sessionId}
  `;
  const row = sessRows[0];
  if (!row) return null;

  const caseFull = await loadCaseDetail(row.caseId);
  if (!caseFull) return null;

  const [sg] = await pool<
    {
      id: string;
      name: string;
      facultyId: string;
      courseLevelId: string;
    }[]
  >`SELECT id, name, "facultyId", "courseLevelId" FROM "StudyGroup" WHERE id = ${row.studyGroupId}`;
  if (!sg) return null;

  const [faculty] = await pool<{ id: string; name: string }[]>`
    SELECT id, name FROM "Faculty" WHERE id = ${sg.facultyId}
  `;
  const [courseLevel] = await pool<{ id: string; name: string; sort: number }[]>`
    SELECT id, name, sort FROM "CourseLevel" WHERE id = ${sg.courseLevelId}
  `;
  if (!faculty || !courseLevel) return null;

  const pickList = await fetchStaffPickListForDepartment(caseFull.departmentId);
  const members = pickList.map((u) => ({
    userId: u.id,
    user: { id: u.id, name: u.name, login: u.login },
  }));

  const [leader] = await pool<{ id: string; name: string | null; login: string }[]>`
    SELECT id, name, login FROM "User" WHERE id = ${row.leaderUserId}
  `;
  if (!leader) return null;

  const subRows = await pool<
    {
      id: string;
      caseSessionId: string;
      caseStageId: string;
      submittedAt: Date | null;
      openedAt: Date | null;
    }[]
  >`
    SELECT id, "caseSessionId", "caseStageId", "submittedAt", "openedAt"
    FROM "StageSubmission"
    WHERE "caseSessionId" = ${sessionId}
  `;

  const submissions = await Promise.all(
    subRows.map(async (sub) => {
      const [stage] = await pool<
        {
          id: string;
          caseId: string;
          order: number;
          title: string;
          isFinalReveal: boolean;
          learningGoals: string | null;
        }[]
      >`
        SELECT id, "caseId", "order", title, "isFinalReveal", "learningGoals"
        FROM "CaseStage" WHERE id = ${sub.caseStageId}
      `;
      if (!stage) throw new Error("STAGE_MISSING");
      const hypotheses = await pool<
        { id: string; text: string; lineageId: string; sort: number }[]
      >`
        SELECT id, text, "lineageId", sort FROM "Hypothesis"
        WHERE "stageSubmissionId" = ${sub.id} ORDER BY sort ASC
      `;
      const questions = await pool<
        { id: string; text: string; lineageId: string; sort: number }[]
      >`
        SELECT id, text, "lineageId", sort FROM "StudentQuestion"
        WHERE "stageSubmissionId" = ${sub.id} ORDER BY sort ASC
      `;
      return {
        ...sub,
        stage,
        hypotheses,
        questions,
      };
    }),
  );

  const [outcome] = await pool<SessionOutcomeRow[]>`
    SELECT id, "caseSessionId", "aiAnalysis", "aiModel", "aiPromptVersion",
      "aiPreliminaryScores", "teacherGrade", "teacherComment", "finalizedAt"
    FROM "SessionOutcome" WHERE "caseSessionId" = ${sessionId}
  `;

  return {
    ...row,
    case: caseFull,
    studyGroup: {
      ...sg,
      faculty,
      courseLevel,
      members,
    },
    leader,
    submissions,
    outcome: outcome ?? null,
  };
}

export type CaseSessionBrief = {
  id: string;
  caseId: string;
  studyGroupId: string;
  leaderUserId: string;
  status: SessionStatus;
  currentStageOrder: number;
  caseVersionSnapshot: number;
  startedAt: Date;
  completedAt: Date | null;
  case: {
    id: string;
    title: string;
    departmentId: string;
    published: boolean;
    teacherKey: string | null;
  };
  studyGroup: {
    id: string;
    name: string;
    faculty: { id: string; name: string };
    courseLevel: { id: string; name: string; sort: number };
  };
  leader: { id: string; name: string | null; login: string };
  outcome: SessionOutcomeRow | null;
};

export async function loadCaseSessionBrief(
  sessionId: string,
): Promise<CaseSessionBrief | null> {
  const pool = getSql();
  const sessRows = await pool<
    {
      id: string;
      caseId: string;
      studyGroupId: string;
      leaderUserId: string;
      status: SessionStatus;
      currentStageOrder: number;
      caseVersionSnapshot: number;
      startedAt: Date;
      completedAt: Date | null;
    }[]
  >`
    SELECT id, "caseId", "studyGroupId", "leaderUserId", status, "currentStageOrder",
      "caseVersionSnapshot", "startedAt", "completedAt"
    FROM "CaseSession" WHERE id = ${sessionId}
  `;
  const row = sessRows[0];
  if (!row) return null;

  const [c] = await pool<
    {
      id: string;
      title: string;
      departmentId: string;
      published: boolean;
      teacherKey: string | null;
    }[]
  >`
    SELECT id, title, "departmentId", published, "teacherKey" FROM "Case" WHERE id = ${row.caseId}
  `;
  if (!c) return null;

  const [sg] = await pool<
    { id: string; name: string; facultyId: string; courseLevelId: string }[]
  >`SELECT id, name, "facultyId", "courseLevelId" FROM "StudyGroup" WHERE id = ${row.studyGroupId}`;
  if (!sg) return null;

  const [faculty] = await pool<{ id: string; name: string }[]>`
    SELECT id, name FROM "Faculty" WHERE id = ${sg.facultyId}
  `;
  const [courseLevel] = await pool<{ id: string; name: string; sort: number }[]>`
    SELECT id, name, sort FROM "CourseLevel" WHERE id = ${sg.courseLevelId}
  `;
  if (!faculty || !courseLevel) return null;

  const [leader] = await pool<{ id: string; name: string | null; login: string }[]>`
    SELECT id, name, login FROM "User" WHERE id = ${row.leaderUserId}
  `;
  if (!leader) return null;

  const [outcome] = await pool<SessionOutcomeRow[]>`
    SELECT id, "caseSessionId", "aiAnalysis", "aiModel", "aiPromptVersion",
      "aiPreliminaryScores", "teacherGrade", "teacherComment", "finalizedAt"
    FROM "SessionOutcome" WHERE "caseSessionId" = ${sessionId}
  `;

  return {
    ...row,
    case: c,
    studyGroup: {
      id: sg.id,
      name: sg.name,
      faculty,
      courseLevel,
    },
    leader,
    outcome: outcome ?? null,
  };
}

export type CaseSessionForPatch = {
  id: string;
  status: SessionStatus;
  leaderUserId: string;
  case: { departmentId: string };
};

export async function loadCaseSessionForPatch(
  sessionId: string,
): Promise<CaseSessionForPatch | null> {
  const pool = getSql();
  const sessRows = await pool<
    { id: string; status: SessionStatus; leaderUserId: string; caseId: string; studyGroupId: string }[]
  >`
    SELECT id, status, "leaderUserId", "caseId", "studyGroupId" FROM "CaseSession" WHERE id = ${sessionId}
  `;
  const s = sessRows[0];
  if (!s) return null;
  const [c] = await pool<{ departmentId: string }[]>`
    SELECT "departmentId" FROM "Case" WHERE id = ${s.caseId}
  `;
  if (!c) return null;
  return {
    id: s.id,
    status: s.status,
    leaderUserId: s.leaderUserId,
    case: c,
  };
}
