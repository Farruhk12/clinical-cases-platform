import pptxgenImport from "pptxgenjs";
import type { CaseDetail } from "../types/case-detail";
import type { BlockType } from "../types/db";
import { mergeConsecutiveNarratorCaseDivs } from "./case-html-merge-segments";

/** tsx/ESM отдаёт либо класс, либо `{ default: класс }` — иначе `new` падает. */
function getPptxGenCtor(): typeof import("pptxgenjs").default {
  const mod = pptxgenImport as unknown;
  if (typeof mod === "function") return mod as typeof import("pptxgenjs").default;
  const inner = (mod as { default?: unknown }).default;
  if (typeof inner === "function") return inner as typeof import("pptxgenjs").default;
  throw new Error("pptxgenjs: не удалось получить конструктор презентации");
}

const ACCENT = "2F6F6F";
const MUTED = "64748B";
const SLIDE_TITLE = "1E293B";

const blockAccent: Record<BlockType, { label: string | null; color: string }> =
  {
    PLAIN: { label: null, color: SLIDE_TITLE },
    PATIENT_SPEECH: { label: "Речь пациента", color: "B45309" },
    DOCTOR_NOTES: { label: "Наблюдения врача", color: "0369A1" },
    NARRATOR: { label: "Повествование", color: "6D28D9" },
    IMAGE_URL: { label: null, color: MUTED },
  };

const segmentLabel: Record<"narrator" | "doctor" | "patient", string> = {
  narrator: "Повествование",
  doctor: "Речь врача",
  patient: "Речь пациента",
};

/**
 * Убирает символы, из‑за которых OOXML / pptxgen падает при сборке пакета.
 * (управляющие + обрывки суррогатных пар из «битого» копипаста)
 */
function sanitizeForPptx(s: string): string {
  let out = "";
  for (const ch of s) {
    const c = ch.codePointAt(0)!;
    if (c >= 0xd800 && c <= 0xdfff) continue;
    if (
      c <= 8 ||
      c === 11 ||
      c === 12 ||
      (c >= 14 && c <= 31) ||
      c === 127
    ) {
      continue;
    }
    if (c === 0xfffe || c === 0xffff) continue;
    out += ch;
  }
  return out;
}

function blockMeta(bt: string): { label: string | null; color: string } {
  if (bt in blockAccent) {
    return blockAccent[bt as BlockType];
  }
  return { label: "Блок", color: SLIDE_TITLE };
}

function parseFormattedHtml(json: string | null): string | null {
  if (!json) return null;
  try {
    const o = JSON.parse(json) as { html?: string };
    const html = typeof o.html === "string" ? o.html.trim() : "";
    return html.length > 0 ? html : null;
  } catch {
    return null;
  }
}

function isSegmentedCaseHtml(html: string): boolean {
  return html.includes("data-case-part=");
}

function htmlToPlain(html: string): string {
  let t = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "");
  t = t
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#(\d+);/g, (_, n) => {
      const code = Number.parseInt(n, 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : _;
    })
    .replace(/&#x([\da-f]+);/gi, (_, h) => {
      const code = Number.parseInt(h, 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : _;
    });
  return sanitizeForPptx(t.replace(/\n{3,}/g, "\n\n").trim());
}

type Segment = { kind: "narrator" | "doctor" | "patient"; text: string };

function extractSegments(html: string): Segment[] | null {
  if (!isSegmentedCaseHtml(html)) return null;
  const parts: Segment[] = [];
  let remaining = html.trim();
  while (remaining.length > 0) {
    const m = remaining.match(
      /^\s*<div\s+data-case-part="(narrator|doctor|patient)">([\s\S]*?)<\/div>\s*/i,
    );
    if (!m) return parts.length > 0 ? parts : null;
    const kind = m[1].toLowerCase() as Segment["kind"];
    parts.push({ kind, text: htmlToPlain(m[2]) });
    remaining = remaining.slice(m[0].length);
  }
  return parts.length > 0 ? parts : null;
}

async function fetchImageDataUri(url: string): Promise<string | null> {
  if (!/^https?:\/\//i.test(url.trim())) return null;
  const trimmed = url.trim();
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 6000);
    let res: Response;
    try {
      res = await fetch(trimmed, {
        signal: ctrl.signal,
        headers: { Accept: "image/*,*/*" },
      });
    } finally {
      clearTimeout(t);
    }
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > 8_000_000) return null;
    const ct = (res.headers.get("content-type") || "image/png").split(";")[0]!.trim();
    const b64 = buf.toString("base64");
    return `data:${ct};base64,${b64}`;
  } catch {
    return null;
  }
}

function sortedStages(c: CaseDetail) {
  return [...c.stages].sort((a, b) => a.order - b.order);
}

function sortedBlocks(stage: CaseDetail["stages"][number]) {
  return [...stage.blocks].sort((a, b) => a.order - b.order);
}

/**
 * Строит презентацию: титул → этапы (цели) → слайды по блокам контента.
 */
export async function buildCasePptxBuffer(
  medicalCase: CaseDetail,
): Promise<Buffer> {
  const PptxCtor = getPptxGenCtor();
  const pptx = new PptxCtor();
  pptx.layout = "LAYOUT_16x9";
  pptx.author = "Клинические кейсы";
  pptx.title = sanitizeForPptx(medicalCase.title);
  pptx.subject = sanitizeForPptx(medicalCase.department.name);

  const W = 9.2;
  const X = 0.4;

  // ——— Титульный слайд ———
  const cover = pptx.addSlide();
  cover.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: 10,
    h: 5.625,
    fill: { color: "F0FDFA" },
    line: { color: "F0FDFA", width: 0.25 },
  });
  cover.addText(sanitizeForPptx(medicalCase.title), {
    x: X,
    y: 1.15,
    w: W,
    h: 1.2,
    fontSize: 28,
    bold: true,
    color: ACCENT,
    fontFace: "Calibri",
    valign: "middle",
  });
  const fac = sanitizeForPptx(
    medicalCase.caseFaculties.map((x) => x.faculty.name).join(", "),
  );
  const crs = sanitizeForPptx(
    medicalCase.caseCourseLevels
      .map((x) => x.courseLevel.name)
      .sort()
      .join(", "),
  );
  cover.addText(
    [
      {
        text: `${sanitizeForPptx(medicalCase.department.name)}\n`,
        options: { fontSize: 14, color: SLIDE_TITLE, breakLine: true },
      },
      {
        text: `Факультеты: ${fac || "—"}\n`,
        options: { fontSize: 12, color: MUTED, breakLine: true },
      },
      {
        text: `Курсы: ${crs || "—"}`,
        options: { fontSize: 12, color: MUTED },
      },
    ],
    { x: X, y: 2.55, w: W, h: 1.4, valign: "top" },
  );
  if (medicalCase.description?.trim()) {
    cover.addText(htmlToPlain(medicalCase.description), {
      x: X,
      y: 3.95,
      w: W,
      h: 1.35,
      fontSize: 11,
      color: SLIDE_TITLE,
      valign: "top",
      wrap: true,
    });
  }

  for (const stage of sortedStages(medicalCase)) {
    const stageSlide = pptx.addSlide();
    stageSlide.addShape(pptx.ShapeType.rect, {
      x: 0,
      y: 0,
      w: 10,
      h: 0.55,
      fill: { color: ACCENT },
      line: { color: ACCENT, width: 0.25 },
    });
    stageSlide.addText(`Этап ${stage.order}`, {
      x: X,
      y: 0.12,
      w: 3,
      h: 0.35,
      fontSize: 11,
      color: "FFFFFF",
      bold: true,
    });
    stageSlide.addText(sanitizeForPptx(stage.title), {
      x: X,
      y: 0.72,
      w: W,
      h: 0.85,
      fontSize: 22,
      bold: true,
      color: SLIDE_TITLE,
      valign: "top",
      wrap: true,
    });
    if (stage.isFinalReveal) {
      stageSlide.addText("Финальный этап (раскрытие)", {
        x: X,
        y: 1.55,
        w: W,
        h: 0.35,
        fontSize: 11,
        italic: true,
        color: ACCENT,
      });
    }
    if (stage.learningGoals?.trim()) {
      stageSlide.addText("Цели обучения", {
        x: X,
        y: stage.isFinalReveal ? 1.95 : 1.65,
        w: W,
        h: 0.3,
        fontSize: 12,
        bold: true,
        color: MUTED,
      });
      stageSlide.addText(htmlToPlain(stage.learningGoals), {
        x: X,
        y: stage.isFinalReveal ? 2.25 : 1.95,
        w: W,
        h: 3.1,
        fontSize: 13,
        color: SLIDE_TITLE,
        valign: "top",
        wrap: true,
      });
    }

    for (const block of sortedBlocks(stage)) {
      const meta = blockMeta(block.blockType);
      const slide = pptx.addSlide();

      slide.addShape(pptx.ShapeType.rect, {
        x: X,
        y: 0.35,
        w: 0.12,
        h: 4.85,
        fill: { color: meta.color },
        line: { color: meta.color, width: 0.25 },
      });

      const header =
        meta.label ??
        (block.blockType === "PLAIN" ? "Текст" : "Блок");
      slide.addText(sanitizeForPptx(header), {
        x: X + 0.35,
        y: 0.35,
        w: W - 0.35,
        h: 0.45,
        fontSize: 13,
        bold: true,
        color: meta.color,
        valign: "middle",
      });

      if (block.blockType === "IMAGE_URL" && block.imageUrl?.trim()) {
        const dataUri = await fetchImageDataUri(block.imageUrl);
        if (dataUri) {
          try {
            slide.addImage({
              data: dataUri,
              x: X + 0.35,
              y: 0.95,
              w: W - 0.35,
              h: 3.6,
              sizing: { type: "contain", w: W - 0.35, h: 3.6 },
            });
          } catch {
            slide.addText(
              sanitizeForPptx(
                `(Не удалось вставить изображение)\n${block.imageUrl}`,
              ),
              {
                x: X + 0.35,
                y: 0.95,
                w: W - 0.35,
                h: 3.5,
                fontSize: 11,
                color: MUTED,
                valign: "top",
                wrap: true,
              },
            );
          }
        } else {
          slide.addText(
            sanitizeForPptx(
              `Изображение (ссылка):\n${block.imageUrl}\n\n${block.imageAlt ? `Подпись: ${block.imageAlt}` : ""}`,
            ),
            {
              x: X + 0.35,
              y: 0.95,
              w: W - 0.35,
              h: 3.5,
              fontSize: 12,
              color: SLIDE_TITLE,
              valign: "top",
              wrap: true,
            },
          );
        }
        continue;
      }

      let html = parseFormattedHtml(block.formattedContent);
      if (html && isSegmentedCaseHtml(html)) {
        html = mergeConsecutiveNarratorCaseDivs(html);
      }
      const segments = html ? extractSegments(html) : null;

      type TextRun = {
        text: string;
        options: {
          fontSize?: number;
          bold?: boolean;
          color?: string;
          breakLine?: boolean;
          italic?: boolean;
        };
      };
      const runs: TextRun[] = [];

      if (segments && segments.length > 0) {
        for (const seg of segments) {
          const lab = segmentLabel[seg.kind];
          runs.push({
            text: `${lab}\n`,
            options: {
              fontSize: 12,
              bold: true,
              color: meta.color,
              breakLine: true,
            },
          });
          runs.push({
            text: `${sanitizeForPptx(seg.text || "—")}\n\n`,
            options: { fontSize: 14, color: SLIDE_TITLE, breakLine: true },
          });
        }
      } else {
        const plain = sanitizeForPptx(
          html
            ? htmlToPlain(html)
            : (block.rawText ?? "").trim() || "—",
        );
        runs.push({
          text: plain,
          options: { fontSize: 14, color: SLIDE_TITLE, breakLine: true },
        });
      }

      slide.addText(runs, {
        x: X + 0.35,
        y: 0.88,
        w: W - 0.35,
        h: 4.35,
        valign: "top",
        wrap: true,
        fontFace: "Calibri",
      });
    }
  }

  const out = await pptx.write({
    outputType: "nodebuffer",
  });
  if (Buffer.isBuffer(out)) return out;
  if (out instanceof Uint8Array) return Buffer.from(out);
  if (out instanceof ArrayBuffer) return Buffer.from(out);
  throw new Error(
    `pptx.write: неожиданный тип результата: ${typeof out}`,
  );
}
