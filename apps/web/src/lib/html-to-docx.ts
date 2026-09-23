/**
 * Convert editor HTML into a real .docx Blob (browser).
 * Uses the `docx` package (OpenXML) — LibreOffice can reconvert this to PDF.
 */

import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from "docx";

type RunStyle = {
  bold?: boolean;
  italics?: boolean;
  underline?: boolean;
};

function collectRuns(
  node: Node,
  style: RunStyle = {}
): TextRun[] {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent ?? "";
    if (!text) return [];
    return [
      new TextRun({
        text,
        bold: style.bold,
        italics: style.italics,
        underline: style.underline ? {} : undefined,
      }),
    ];
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return [];
  const el = node as HTMLElement;
  const tag = el.tagName.toLowerCase();
  const next: RunStyle = { ...style };
  if (tag === "strong" || tag === "b") next.bold = true;
  if (tag === "em" || tag === "i") next.italics = true;
  if (tag === "u") next.underline = true;
  if (tag === "br") {
    return [new TextRun({ break: 1 })];
  }
  const runs: TextRun[] = [];
  for (const child of Array.from(el.childNodes)) {
    runs.push(...collectRuns(child, next));
  }
  return runs;
}

function paragraphFromElement(el: HTMLElement): Paragraph | null {
  const tag = el.tagName.toLowerCase();
  const runs = collectRuns(el);
  if (runs.length === 0) {
    // Preserve blank lines
    if (tag === "p" || tag === "div") {
      return new Paragraph({ children: [new TextRun("")] });
    }
    return null;
  }

  if (tag === "h1") {
    return new Paragraph({ heading: HeadingLevel.HEADING_1, children: runs });
  }
  if (tag === "h2") {
    return new Paragraph({ heading: HeadingLevel.HEADING_2, children: runs });
  }
  if (tag === "h3") {
    return new Paragraph({ heading: HeadingLevel.HEADING_3, children: runs });
  }
  if (tag === "li") {
    return new Paragraph({
      children: runs,
      bullet: { level: 0 },
    });
  }
  if (tag === "blockquote") {
    return new Paragraph({
      children: runs,
      indent: { left: 720 },
      alignment: AlignmentType.LEFT,
    });
  }
  return new Paragraph({ children: runs });
}

function walkToParagraphs(root: {
  childNodes: NodeListOf<ChildNode>;
}): Paragraph[] {
  const out: Paragraph[] = [];
  for (const child of Array.from(root.childNodes)) {
    if (child.nodeType !== Node.ELEMENT_NODE) {
      const text = child.textContent?.trim();
      if (text) {
        out.push(new Paragraph({ children: [new TextRun(text)] }));
      }
      continue;
    }
    const el = child as HTMLElement;
    const tag = el.tagName.toLowerCase();
    if (tag === "ul" || tag === "ol") {
      for (const li of Array.from(el.children)) {
        if ((li as HTMLElement).tagName.toLowerCase() !== "li") continue;
        const para = paragraphFromElement(li as HTMLElement);
        if (para) out.push(para);
      }
      continue;
    }
    if (
      tag === "p" ||
      tag === "div" ||
      tag === "h1" ||
      tag === "h2" ||
      tag === "h3" ||
      tag === "blockquote"
    ) {
      // Nested block containers: flatten children that are themselves blocks
      const hasBlockChild = Array.from(el.children).some((c) => {
        const t = c.tagName.toLowerCase();
        return (
          t === "p" ||
          t === "div" ||
          t === "ul" ||
          t === "ol" ||
          t === "h1" ||
          t === "h2" ||
          t === "h3"
        );
      });
      if (hasBlockChild && (tag === "div" || tag === "blockquote")) {
        out.push(...walkToParagraphs(el));
      } else {
        const para = paragraphFromElement(el);
        if (para) out.push(para);
      }
      continue;
    }
    if (tag === "table") {
      // Tables → one paragraph per cell row for round-trip fidelity
      for (const row of Array.from(el.querySelectorAll("tr"))) {
        const cells = Array.from(row.querySelectorAll("th,td"))
          .map((c) => (c.textContent ?? "").trim())
          .filter(Boolean);
        if (cells.length === 0) continue;
        out.push(
          new Paragraph({
            children: [new TextRun(cells.join(" | "))],
          })
        );
      }
      continue;
    }
    out.push(...walkToParagraphs(el));
  }
  return out;
}

/**
 * Build a .docx Blob from HTML produced by the Seal DocxEditor.
 */
export async function htmlToDocxBlob(html: string): Promise<Blob> {
  const parser = new DOMParser();
  const parsed = parser.parseFromString(
    `<div id="seal-docx-root">${html}</div>`,
    "text/html"
  );
  const root = parsed.getElementById("seal-docx-root");
  const children = root ? walkToParagraphs(root) : [];
  const document = new Document({
    sections: [
      {
        properties: {},
        children:
          children.length > 0
            ? children
            : [new Paragraph({ children: [new TextRun("")] })],
      },
    ],
  });
  return Packer.toBlob(document);
}

export async function htmlToDocxBase64(html: string): Promise<string> {
  const blob = await htmlToDocxBlob(html);
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export const DOCX_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
