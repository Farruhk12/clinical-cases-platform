import type { AiPreliminaryScoresPayload } from "~lib/session-ai-scores";

export function AiPreliminaryScoresPanel({
  scores,
}: {
  scores: AiPreliminaryScoresPayload;
}) {
  return (
    <div className="rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50/90 to-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-violet-950">
        Предварительная оценка (ИИ, 100-балльная шкала)
      </h3>
      <p className="mt-1 text-xs leading-snug text-violet-900/85">
        Ориентир для преподавателя. Итоговую оценку и комментарий вы фиксируете
        ниже сами.
      </p>
      {scores.stageScores.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-2">
          {scores.stageScores.map((s) => (
            <li
              key={s.stageOrder}
              className="max-w-full rounded-lg border border-white/90 bg-white px-3 py-2 text-sm shadow-sm ring-1 ring-violet-100/80"
            >
              <span className="text-slate-600">Этап {s.stageOrder}</span>
              {s.stageTitle ? (
                <span
                  className="ml-1 max-w-[10rem] truncate align-bottom text-xs text-slate-500"
                  title={s.stageTitle}
                >
                  · {s.stageTitle}
                </span>
              ) : null}
              <span className="ml-2 font-semibold tabular-nums text-violet-800">
                {s.score}/100
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="mt-4 flex flex-wrap items-baseline gap-x-2 gap-y-1 border-t border-violet-200/70 pt-3">
        <span className="text-sm font-medium text-slate-700">
          Среднее по этапам:
        </span>
        <span className="text-2xl font-bold tabular-nums text-violet-700">
          {scores.averageScore}
        </span>
        <span className="text-sm text-slate-600">/ 100</span>
      </div>
    </div>
  );
}
