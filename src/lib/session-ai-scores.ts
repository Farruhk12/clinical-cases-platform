import { z } from "zod";

export const aiAnalysisResponseSchema = z.object({
  analysisMarkdown: z.string(),
  stageScores: z.array(
    z.object({
      stageOrder: z.number().int().positive(),
      stageTitle: z.string().optional(),
      score: z.number().min(0).max(100),
    }),
  ),
  averageScore: z.number().min(0).max(100),
});

export type AiAnalysisResponse = z.infer<typeof aiAnalysisResponseSchema>;

export type AiPreliminaryScoresPayload = {
  stageScores: {
    stageOrder: number;
    stageTitle?: string;
    score: number;
  }[];
  averageScore: number;
};

export function unwrapLlmJson(text: string) {
  let t = text.trim();
  if (t.startsWith("```")) {
    t = t.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "");
  }
  return t.trim();
}

/**
 * Модель иногда кладёт весь JSON ответа внутрь analysisMarkdown или сохраняется сырой JSON вместо текста.
 * Достаём реальный markdown (рекурсивно, с ограничением глубины).
 */
export function unwrapAnalysisMarkdownIfJsonWrapped(
  md: string,
  depth = 0,
): string {
  if (depth > 5) return md;
  const t = md.trim();
  if (!t.startsWith("{")) return md;
  try {
    const obj = JSON.parse(t) as Record<string, unknown>;
    if (typeof obj.analysisMarkdown === "string") {
      return unwrapAnalysisMarkdownIfJsonWrapped(
        obj.analysisMarkdown.trim(),
        depth + 1,
      );
    }
  } catch {
    return md;
  }
  return md;
}

export function parseAiAnalysisResponse(
  raw: string,
): { ok: true; data: AiAnalysisResponse } | { ok: false } {
  try {
    const parsed = JSON.parse(unwrapLlmJson(raw)) as unknown;
    const data = aiAnalysisResponseSchema.parse(parsed);
    return { ok: true, data };
  } catch {
    return { ok: false };
  }
}

/** Если полный zod-парсинг не прошёл, но JSON читается — достаём markdown и при возможности оценки. */
export function recoverAiAnalysisFromLooseJson(raw: string): {
  analysisMarkdown: string;
  scores: AiPreliminaryScoresPayload | null;
} | null {
  try {
    const parsed = JSON.parse(unwrapLlmJson(raw)) as Record<string, unknown>;
    if (typeof parsed.analysisMarkdown !== "string") return null;
    const md = unwrapAnalysisMarkdownIfJsonWrapped(parsed.analysisMarkdown.trim());
    const scored = aiAnalysisResponseSchema.safeParse(parsed);
    const scores = scored.success
      ? normalizeScores(scored.data)
      : parsePreliminaryScoresLoose(parsed);
    return { analysisMarkdown: md, scores };
  } catch {
    return null;
  }
}

/** Среднее по этапам; если модель ошиблась — пересчитываем. */
export function normalizeScores(
  data: AiAnalysisResponse,
): AiPreliminaryScoresPayload {
  const stages = data.stageScores;
  if (stages.length === 0) {
    return {
      stageScores: stages,
      averageScore: Math.round(
        Math.min(100, Math.max(0, data.averageScore)),
      ),
    };
  }
  const sum = stages.reduce((s, x) => s + x.score, 0);
  const avg = Math.round(sum / stages.length);
  return {
    stageScores: stages,
    averageScore: avg,
  };
}

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** Допускает числа из JSON/SQLite как number или string. */
export type StageWorkStats = {
  stageOrder: number;
  hypothesisCount: number;
  questionCount: number;
};

/**
 * Жёсткие потолки по фактическим данным этапа (не «милость» модели).
 * Пустой этап → 0; пара гипотез без вопросов → не выше 20 и т.д.
 */
export function enforceStrictStageScores(
  payload: AiPreliminaryScoresPayload,
  stageStats: StageWorkStats[],
): AiPreliminaryScoresPayload {
  const m = new Map(stageStats.map((s) => [s.stageOrder, s]));
  const adjusted = payload.stageScores.map((row) => {
    const st = m.get(row.stageOrder);
    if (!st) return row;
    const h = st.hypothesisCount;
    const q = st.questionCount;
    let s = row.score;

    if (h === 0 && q === 0) {
      s = 0;
    } else if (h >= 1 && h <= 2 && q === 0) {
      s = Math.min(s, 20);
    } else if (h >= 3 && q === 0) {
      s = Math.min(s, 40);
    } else if (h === 0 && q >= 1) {
      s = Math.min(s, 25);
    }

    return {
      ...row,
      score: Math.max(0, Math.min(100, Math.round(s))),
    };
  });
  const sum = adjusted.reduce((a, x) => a + x.score, 0);
  const averageScore = adjusted.length
    ? Math.round(sum / adjusted.length)
    : 0;
  return { stageScores: adjusted, averageScore };
}

/**
 * Баллы для UI: если в БД в aiAnalysis ошибочно лежит целый JSON ответа, берём stageScores оттуда
 * (иначе остаются старые aiPreliminaryScores после частичного сбоя сохранения).
 */
export function preliminaryScoresFromOutcome(outcome: {
  aiPreliminaryScores?: unknown | null;
  aiAnalysis?: string | null;
} | null | undefined): AiPreliminaryScoresPayload | null {
  if (!outcome) return null;
  const raw = outcome.aiAnalysis?.trim() ?? "";
  if (raw.startsWith("{")) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      const fromJson = parsePreliminaryScoresLoose(parsed);
      if (fromJson) return fromJson;
    } catch {
      /* ignore */
    }
  }
  return parsePreliminaryScoresLoose(outcome.aiPreliminaryScores ?? null);
}

export function parsePreliminaryScoresLoose(
  v: unknown,
): AiPreliminaryScoresPayload | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  const arr = o.stageScores;
  if (!Array.isArray(arr) || arr.length === 0) return null;
  const stageScores: AiPreliminaryScoresPayload["stageScores"] = [];
  for (const item of arr) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const it = item as Record<string, unknown>;
    const order = num(it.stageOrder);
    const score = num(it.score);
    if (order == null || score == null) continue;
    stageScores.push({
      stageOrder: Math.max(1, Math.floor(order)),
      stageTitle:
        typeof it.stageTitle === "string" ? it.stageTitle : undefined,
      score: Math.round(Math.min(100, Math.max(0, score))),
    });
  }
  if (stageScores.length === 0) return null;
  const sum = stageScores.reduce((s, x) => s + x.score, 0);
  const averageScore = Math.round(sum / stageScores.length);
  return { stageScores, averageScore };
}
