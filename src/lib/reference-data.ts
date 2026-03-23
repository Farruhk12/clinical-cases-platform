import { getSql } from "./db";

export async function fetchReferenceData(opts: {
  role: string;
  departmentId?: string | null;
}) {
  const pool = getSql();
  const departments =
    opts.role === "ADMIN"
      ? await pool<{ id: string; name: string }[]>`
          SELECT id, name FROM "Department" ORDER BY name ASC
        `
      : opts.departmentId
        ? await pool<{ id: string; name: string }[]>`
            SELECT id, name FROM "Department" WHERE id = ${opts.departmentId}
          `
        : [];
  const faculties = await pool<{ id: string; name: string }[]>`
    SELECT id, name FROM "Faculty" ORDER BY name ASC
  `;
  const courseLevels = await pool<{ id: string; name: string; sort: number }[]>`
    SELECT id, name, sort FROM "CourseLevel" ORDER BY sort ASC
  `;
  return { departments, faculties, courseLevels };
}

export type LeaderCandidateUser = {
  id: string;
  name: string | null;
  login: string;
  role: string;
  departmentId: string | null;
};

export async function fetchLeaderCandidates(opts: {
  role: string;
  departmentId: string | null;
}): Promise<LeaderCandidateUser[]> {
  const pool = getSql();
  if (opts.role === "ADMIN") {
    return pool<LeaderCandidateUser[]>`
      SELECT id, name, login, role, "departmentId" FROM "User"
      WHERE role IN ('ADMIN', 'TEACHER')
      ORDER BY login ASC
    `;
  }
  if (opts.role === "TEACHER") {
    if (!opts.departmentId) {
      return pool<LeaderCandidateUser[]>`
        SELECT id, name, login, role, "departmentId" FROM "User" WHERE role = 'ADMIN' ORDER BY login ASC
      `;
    }
    return pool<LeaderCandidateUser[]>`
      SELECT id, name, login, role, "departmentId" FROM "User"
      WHERE role = 'ADMIN' OR (role = 'TEACHER' AND "departmentId" = ${opts.departmentId})
      ORDER BY login ASC
    `;
  }
  return [];
}

export async function fetchStaffPickListForDepartment(
  departmentId: string,
): Promise<LeaderCandidateUser[]> {
  const pool = getSql();
  return pool<LeaderCandidateUser[]>`
    SELECT id, name, login, role, "departmentId" FROM "User"
    WHERE role IN ('ADMIN', 'TEACHER')
    AND (role = 'ADMIN' OR "departmentId" = ${departmentId})
    ORDER BY login ASC
  `;
}

export async function fetchStudyGroupsEnriched() {
  const pool = getSql();
  const groups = await pool<
    {
      id: string;
      name: string;
      facultyId: string;
      courseLevelId: string;
    }[]
  >`SELECT id, name, "facultyId", "courseLevelId" FROM "StudyGroup" ORDER BY name ASC`;
  return Promise.all(
    groups.map(async (g) => {
      const [f] = await pool<{ id: string; name: string }[]>`
        SELECT id, name FROM "Faculty" WHERE id = ${g.facultyId}
      `;
      const [cl] = await pool<{ id: string; name: string; sort: number }[]>`
        SELECT id, name, sort FROM "CourseLevel" WHERE id = ${g.courseLevelId}
      `;
      return {
        ...g,
        faculty: f!,
        courseLevel: cl!,
        members: [] as {
          userId: string;
          user: { id: string; name: string | null; login: string };
        }[],
      };
    }),
  );
}
