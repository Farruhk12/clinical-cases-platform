export type CaseHtmlPart = "narrator" | "doctor" | "patient";

/**
 * Подряд идущие сегменты с одним `data-case-part` (напр. несколько narrator)
 * дают лишние карточки в UI — склеиваем указанные типы.
 */
export function mergeAdjacentCasePartDivs(
  html: string,
  mergeConsecutive: readonly CaseHtmlPart[],
): string {
  const t = html.trim();
  if (!mergeConsecutive.length || !t.includes("data-case-part=")) return t;

  type Seg = { part: CaseHtmlPart; inner: string };
  const segments: Seg[] = [];
  let remaining = t;

  while (remaining.length > 0) {
    const m = remaining.match(
      /^\s*<div\s+data-case-part="(narrator|doctor|patient)">([\s\S]*?)<\/div>\s*/i,
    );
    if (!m) return t;

    const part = m[1].toLowerCase() as CaseHtmlPart;
    segments.push({ part, inner: m[2] });
    remaining = remaining.slice(m[0].length);
  }

  if (segments.length <= 1) return t;

  const mergeSet = new Set(mergeConsecutive);
  const out: Seg[] = [];
  for (const seg of segments) {
    const prev = out[out.length - 1];
    if (prev && prev.part === seg.part && mergeSet.has(seg.part)) {
      prev.inner = `${prev.inner.trimEnd()}\n${seg.inner.trimStart()}`;
    } else {
      out.push({ part: seg.part, inner: seg.inner });
    }
  }

  return out
    .map((s) => `<div data-case-part="${s.part}">${s.inner}</div>`)
    .join("");
}

/** Уже сохранённое оформление: один блок «Повествование» на непрерывный текст. */
export function mergeConsecutiveNarratorCaseDivs(html: string): string {
  return mergeAdjacentCasePartDivs(html, ["narrator"]);
}
