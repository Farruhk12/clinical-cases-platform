import sanitizeHtml from "sanitize-html";
import { mergeAdjacentCasePartDivs } from "./case-html-merge-segments";

const CASE_PART_VALUES = ["narrator", "doctor", "patient"] as const;

type CasePart = (typeof CASE_PART_VALUES)[number];

function isCasePart(v: string | undefined): v is CasePart {
  return (
    v !== undefined &&
    (CASE_PART_VALUES as readonly string[]).includes(v)
  );
}

/**
 * Чистит HTML от ИИ и нормализует сегменты `data-case-part`.
 */
export function sanitizeCaseFormattedHtml(html: string): string {
  const cleaned = sanitizeHtml(html, {
    allowedTags: [
      "div",
      "p",
      "br",
      "strong",
      "em",
      "b",
      "i",
      "ul",
      "ol",
      "li",
      "blockquote",
    ],
    allowedAttributes: {
      div: ["data-case-part"],
    },
    transformTags: {
      b: () => ({ tagName: "strong", attribs: {} }),
      i: () => ({ tagName: "em", attribs: {} }),
      div: (_tag, attribs) => {
        const raw = attribs["data-case-part"];
        const part: CasePart = isCasePart(raw) ? raw : "narrator";
        return {
          tagName: "div",
          attribs: { "data-case-part": part },
        };
      },
    },
  });
  const segmented = ensureSegmented(cleaned);
  return mergeAdjacentCasePartDivs(segmented, ["narrator"]);
}

/** Один общий блок повествования, если модель вернула только <p> без сегментов. */
function ensureSegmented(html: string): string {
  const t = html.trim();
  if (!t) return `<div data-case-part="narrator"><p></p></div>`;
  if (t.includes("data-case-part=")) return t;
  return `<div data-case-part="narrator">${t}</div>`;
}

/** Повторная очистка при сохранении предпросмотра с клиента. */
export function sanitizeStoredFormattedContent(jsonStr: string): string {
  try {
    const o = JSON.parse(jsonStr) as Record<string, unknown>;
    if (typeof o.html === "string") {
      o.html = sanitizeCaseFormattedHtml(o.html);
    }
    return JSON.stringify(o);
  } catch {
    return jsonStr;
  }
}
