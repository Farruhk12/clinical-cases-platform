import { getSql } from "./db";

type OutcomeLike = Record<string, unknown> & { id?: string };

function hasUsableScoresJson(v: unknown): boolean {
  if (v == null || typeof v !== "object" || Array.isArray(v)) return false;
  const o = v as Record<string, unknown>;
  return Array.isArray(o.stageScores) && o.stageScores.length > 0;
}

export async function mergeAiPreliminaryScoresFromDb<T extends OutcomeLike | null>(
  outcome: T,
): Promise<T> {
  if (!outcome || typeof outcome.id !== "string") return outcome;
  if (hasUsableScoresJson(outcome.aiPreliminaryScores)) {
    return outcome;
  }
  try {
    const pool = getSql();
    const rows = await pool<{ v: unknown }[]>`
      SELECT "aiPreliminaryScores" AS v FROM "SessionOutcome" WHERE id = ${outcome.id} LIMIT 1
    `;
    const raw = rows[0]?.v;
    if (raw == null || raw === "") return outcome;
    let parsed: unknown;
    if (typeof raw === "string") {
      parsed = JSON.parse(raw) as unknown;
    } else if (typeof raw === "object") {
      parsed = raw;
    } else {
      return outcome;
    }
    if (!hasUsableScoresJson(parsed)) return outcome;
    return { ...outcome, aiPreliminaryScores: parsed } as T;
  } catch {
    return outcome;
  }
}
