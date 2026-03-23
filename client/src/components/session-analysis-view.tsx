"use client";

import type { ReactNode } from "react";
import type { Components } from "react-markdown";
import type { AiPreliminaryScoresPayload } from "~lib/session-ai-scores";
import { unwrapAnalysisMarkdownIfJsonWrapped } from "~lib/session-ai-scores";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

function nodeToPlainText(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(nodeToPlainText).join("");
  if (typeof node === "object" && "props" in node) {
    return nodeToPlainText(
      (node as { props?: { children?: ReactNode } }).props?.children,
    );
  }
  return "";
}

/** Делит ответ ИИ на карточки по заголовкам ## */
export function splitMarkdownByH2(md: string): { title: string; body: string }[] {
  const lines = md.split("\n");
  const blocks: { title: string; body: string }[] = [];
  let pendingTitle: string | null = null;
  let bodyLines: string[] = [];

  function flushPreamble() {
    const body = bodyLines.join("\n").trim();
    bodyLines = [];
    if (body) {
      blocks.push({ title: "Обзор", body });
    }
  }

  function flushSection() {
    if (pendingTitle === null) return;
    const body = bodyLines.join("\n").trim();
    bodyLines = [];
    blocks.push({ title: pendingTitle, body });
    pendingTitle = null;
  }

  for (const line of lines) {
    const hm = line.match(/^(#{1,2})\s+(.+)$/);
    if (hm) {
      if (pendingTitle !== null) {
        flushSection();
      } else {
        flushPreamble();
      }
      pendingTitle = hm[2].trim();
    } else {
      bodyLines.push(line);
    }
  }

  if (pendingTitle !== null) {
    flushSection();
  } else {
    flushPreamble();
  }

  if (blocks.length === 0 && md.trim()) {
    return [{ title: "Анализ", body: md.trim() }];
  }
  return blocks;
}

function extractStageOrderFromTitle(title: string): number | null {
  const m = title.match(/Этап\s*(\d+)/i);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

const mdComponents: Partial<Components> = {
  h1: ({ children }) => (
    <h4 className="mb-2 text-sm font-semibold text-slate-900">{children}</h4>
  ),
  h2: ({ children }) => (
    <h4 className="mb-2 mt-4 border-t border-slate-100 pt-3 text-sm font-semibold text-violet-900 first:mt-0 first:border-t-0 first:pt-0">
      {children}
    </h4>
  ),
  h3: ({ children }) => {
    const t = nodeToPlainText(children).trim().toLowerCase();
    if (t.includes("положительн")) {
      return (
        <h5 className="mb-2 mt-5 flex items-center gap-2 border-b-2 border-emerald-400/70 pb-2 text-sm font-semibold text-emerald-950 first:mt-0">
          <span
            className="inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500"
            aria-hidden
          />
          {children}
        </h5>
      );
    }
    if (t.includes("отрицательн")) {
      return (
        <h5 className="mb-2 mt-5 flex items-center gap-2 border-b-2 border-rose-400/70 pb-2 text-sm font-semibold text-rose-950">
          <span
            className="inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-rose-500"
            aria-hidden
          />
          {children}
        </h5>
      );
    }
    if (t.includes("рекомендац")) {
      return (
        <h5 className="mb-2 mt-5 flex items-center gap-2 border-b-2 border-sky-400/70 pb-2 text-sm font-semibold text-sky-950">
          <span
            className="inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-sky-500"
            aria-hidden
          />
          {children}
        </h5>
      );
    }
    return (
      <h5 className="mb-1.5 mt-4 text-sm font-medium text-slate-800">{children}</h5>
    );
  },
  p: ({ children }) => (
    <p className="my-2 text-sm leading-relaxed text-slate-700">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="my-2 list-disc space-y-1.5 pl-5 marker:text-violet-400">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="my-2 list-decimal space-y-1.5 pl-5 text-sm text-slate-700 marker:font-medium marker:text-violet-700">
      {children}
    </ol>
  ),
  li: ({ children }) => (
    <li className="text-sm leading-relaxed text-slate-700 [&_ol]:mt-2 [&_ul]:mt-2">
      {children}
    </li>
  ),
  strong: ({ children }) => {
    const t = nodeToPlainText(children).trim();
    const chip = t.length > 0 && t.length <= 80 && !t.includes("\n");
    if (chip) {
      return (
        <span className="mx-0.5 inline-flex max-w-full align-baseline break-words rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-950">
          {children}
        </span>
      );
    }
    return (
      <strong className="font-semibold text-slate-900">{children}</strong>
    );
  },
  em: ({ children }) => (
    <em className="text-violet-900/85">{children}</em>
  ),
  blockquote: ({ children }) => (
    <blockquote className="my-3 border-l-4 border-violet-200 bg-violet-50/50 py-2 pl-4 pr-2 text-sm text-slate-700">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-4 border-slate-200" />,
  a: ({ href, children }) => (
    <a
      href={href}
      className="font-medium text-teal-700 underline decoration-teal-300 underline-offset-2 hover:text-teal-900"
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </a>
  ),
  code: ({ children }) => (
    <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-800">
      {children}
    </code>
  ),
  pre: ({ children }) => (
    <pre className="my-3 overflow-x-auto rounded-lg border border-slate-200 bg-slate-900/95 p-3 text-xs text-slate-100">
      {children}
    </pre>
  ),
};

function MarkdownBody({ source }: { source: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
      {source}
    </ReactMarkdown>
  );
}

export function SessionAnalysisView({
  content,
  stageScores,
  averageScore,
}: {
  content: string;
  stageScores?: AiPreliminaryScoresPayload["stageScores"];
  averageScore?: number;
}) {
  const md = unwrapAnalysisMarkdownIfJsonWrapped(content);
  const blocks = splitMarkdownByH2(md);

  return (
    <div className="space-y-4">
      {blocks.length === 0 ? (
        <p className="text-sm text-slate-500">Текст анализа пуст</p>
      ) : (
        <div className="space-y-4">
          {blocks.map((block, i) => {
            const stageOrder = extractStageOrderFromTitle(block.title);
            const isGeneral =
              stageOrder == null &&
              /общ/i.test(block.title) &&
              /замечан/i.test(block.title);
            const stageScore =
              stageOrder != null && stageScores?.length
                ? (stageScores.find((s) => s.stageOrder === stageOrder)
                    ?.score ?? null)
                : null;
            const generalScore =
              isGeneral && typeof averageScore === "number"
                ? averageScore
                : null;
            const badge = stageScore ?? generalScore;

            return (
            <article
              key={`${block.title}-${i}`}
              className="overflow-hidden rounded-xl border border-slate-200/90 bg-gradient-to-b from-white to-slate-50/90 shadow-sm ring-1 ring-slate-100/80"
            >
              <header className="flex flex-wrap items-start justify-between gap-3 border-b border-violet-100 bg-gradient-to-r from-violet-50/90 to-white px-4 py-3">
                <h3 className="min-w-0 flex-1 text-sm font-semibold tracking-tight text-violet-950">
                  {block.title}
                </h3>
                {badge != null ? (
                  <span
                    className="shrink-0 rounded-lg bg-violet-600 px-2.5 py-1 text-xs font-bold tabular-nums text-white shadow-sm"
                    title="Предварительная оценка ИИ по 100-балльной шкале"
                  >
                    {isGeneral ? "Среднее" : "Балл"}: {badge}/100
                  </span>
                ) : null}
              </header>
              <div className="px-4 py-3">
                {block.body ? (
                  <MarkdownBody source={block.body} />
                ) : (
                  <p className="text-sm text-slate-500">Нет содержимого</p>
                )}
              </div>
            </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
