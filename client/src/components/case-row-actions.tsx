import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";

export function CaseRowActions({
  caseId,
  title,
  sessionCount,
}: {
  caseId: string;
  title: string;
  sessionCount: number;
}) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function deleteCase() {
    setError(null);
    const extra =
      sessionCount > 0
        ? `\n\nСейчас у кейса ${sessionCount} сесс. Пока они есть, сервер не даст удалить кейс — сначала в редакторе нажмите «Закрыть и удалить все сессии этого кейса».`
        : "";
    const ok = window.confirm(
      `Удалить кейс «${title}» безвозвратно (этапы, блоки, данные)?${extra}`,
    );
    if (!ok) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/cases/${caseId}`, { method: "DELETE" });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(
          typeof j.error === "string"
            ? j.error
            : "Не удалось удалить кейс",
        );
        return;
      }
      navigate(0);
    } catch {
      setError("Сеть недоступна или запрос прерван.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex flex-wrap gap-2">
        <Link
          to={`/cases/${caseId}/edit`}
          className="rounded-xl border border-slate-200 px-3.5 py-1.5 text-sm text-slate-600 transition hover:bg-slate-50"
        >
          Редактировать
        </Link>
        <button
          type="button"
          disabled={busy}
          onClick={() => void deleteCase()}
          className="rounded-xl border border-red-200 px-3.5 py-1.5 text-sm text-red-600 transition hover:bg-red-50 disabled:opacity-60"
        >
          {busy ? "Удаление..." : "Удалить"}
        </button>
        <Link
          to={`/sessions/new?caseId=${caseId}`}
          className="rounded-xl bg-slate-900 px-3.5 py-1.5 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800"
        >
          Запустить сессию
        </Link>
      </div>
      {error ? (
        <p className="max-w-xs text-right text-xs text-red-600">{error}</p>
      ) : null}
    </div>
  );
}
