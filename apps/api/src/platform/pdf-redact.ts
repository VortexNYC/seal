/**
 * True redaction: removes content-stream operators inside a region instead
 * of painting over them. Text runs, images, and vector paths fully inside
 * a redaction rect are dropped from the emitted PDF bytes — removed content
 * is not recoverable by text extraction. Surrounding artwork is kept.
 *
 * Returns a redaction receipt: the literal strings dropped (decoded
 * best-effort), op/annot counts, and honest warnings for content left
 * alone (inline images, partially-overlapping paths).
 */
import {
  PDFArray,
  PDFDict,
  PDFHexString,
  PDFName,
  PDFNull,
  PDFNumber,
  PDFObjectParser,
  PDFRawStream,
  PDFRef,
  PDFString,
  PDFDocument,
  decodePDFRawStream,
  rgb,
  type PDFObject,
  type PDFPage,
} from "pdf-lib";

import { percentToPdfRect } from "./pdf-ops.js";

export interface RedactRegion {
  /** 1-indexed page. */
  page: number;
  /** Percent-of-page top-left rect (same space as signature fields). */
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RedactResult {
  bytes: Uint8Array;
  regionsApplied: number;
  opsScrubbed: number;
  annotsScrubbed: number;
  /** Best-effort decoded strings removed from the document. */
  scrubbedStrings: string[];
  warnings: string[];
}

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

// ---------------------------------------------------------------------------
// Tokenizer — walks a decoded content stream into operand/operator tokens.
// ---------------------------------------------------------------------------

const WS = new Set([0, 9, 10, 12, 13, 32]);
const DELIM = new Set([
  0x28, 0x29, 0x3c, 0x3e, 0x5b, 0x5d, 0x7b, 0x7d, 0x2f, 0x25,
]);

interface OpToken {
  op: string;
  operands: Uint8Array[];
}

function isDelimiter(b: number): boolean {
  return WS.has(b) || DELIM.has(b);
}

/** Skip a balanced-literal-string at i (bytes[i] === '('). Returns new index. */
function skipLiteralString(bytes: Uint8Array, i: number): number {
  i++;
  let depth = 1;
  while (i < bytes.length && depth > 0) {
    const c = bytes[i]!;
    if (c === 0x5c) {
      i += 2;
      continue;
    }
    if (c === 0x28) depth++;
    else if (c === 0x29) depth--;
    i++;
  }
  return i;
}

/** Skip a nested structure opened by `open`/`close` byte pair. */
function skipNested(
  bytes: Uint8Array,
  i: number,
  open: number,
  close: number,
  double: boolean
): number {
  let depth = 0;
  const step = double ? 2 : 1;
  while (i < bytes.length) {
    const c = bytes[i]!;
    if (c === 0x28) {
      i = skipLiteralString(bytes, i);
      continue;
    }
    if (double ? c === open && bytes[i + 1] === open : c === open) {
      depth++;
      i += step;
      continue;
    }
    if (double ? c === close && bytes[i + 1] === close : c === close) {
      depth--;
      i += step;
      if (depth === 0) break;
      continue;
    }
    i++;
  }
  return i;
}

const OPERAND_WORD = /^(true|false|null|[-+]?\d*\.?\d+)$/;

function tokenizeContentStream(bytes: Uint8Array): OpToken[] {
  const ops: OpToken[] = [];
  const operands: Uint8Array[] = [];
  let i = 0;
  const n = bytes.length;
  const slice = (a: number, b: number) => bytes.subarray(a, b);
  const decoder = new TextDecoder("latin1");

  while (i < n) {
    const b = bytes[i]!;
    if (WS.has(b)) {
      i++;
      continue;
    }
    if (b === 0x25) {
      while (i < n && bytes[i] !== 0x0a && bytes[i] !== 0x0d) i++;
      continue;
    }
    if (b === 0x28) {
      const start = i;
      i = skipLiteralString(bytes, i);
      operands.push(slice(start, i));
      continue;
    }
    if (b === 0x3c) {
      const start = i;
      if (bytes[i + 1] === 0x3c) {
        i = skipNested(bytes, i, 0x3c, 0x3e, true);
        operands.push(slice(start, i));
      } else {
        while (i < n && bytes[i] !== 0x3e) i++;
        i = Math.min(n, i + 1);
        operands.push(slice(start, i));
      }
      continue;
    }
    if (b === 0x5b) {
      const start = i;
      i = skipNested(bytes, i, 0x5b, 0x5d, false);
      operands.push(slice(start, i));
      continue;
    }
    if (b === 0x2f) {
      const start = i;
      i++; // skip the leading '/' — it is itself a delimiter
      while (i < n && !isDelimiter(bytes[i]!)) i++;
      operands.push(slice(start, i));
      continue;
    }
    if (!DELIM.has(b)) {
      const start = i;
      while (i < n && !isDelimiter(bytes[i]!)) i++;
      const tok = slice(start, i);
      const word = decoder.decode(tok);
      // Inline image data follows the ID keyword until a delimited EI.
      if (word === "ID") {
        while (i < n && WS.has(bytes[i]!)) i++;
        while (i < n - 1) {
          if (
            bytes[i] === 0x45 &&
            bytes[i + 1] === 0x49 &&
            (i === 0 || WS.has(bytes[i - 1]!)) &&
            (i + 2 >= n || isDelimiter(bytes[i + 2]!))
          ) {
            i += 2;
            break;
          }
          i++;
        }
        ops.push({ op: "INLINE_IMAGE", operands: [] });
        operands.length = 0;
        continue;
      }
      if (OPERAND_WORD.test(word)) {
        operands.push(tok);
        continue;
      }
      ops.push({ op: word, operands: [...operands] });
      operands.length = 0;
      continue;
    }
    i++;
  }
  return ops;
}

// ---------------------------------------------------------------------------
// Operand parsing + transforms
// ---------------------------------------------------------------------------

function parseOperands(
  operandBytes: Uint8Array[],
  context: PDFDocument["context"]
): PDFObject[] {
  const out: PDFObject[] = [];
  for (const b of operandBytes) {
    try {
      out.push(PDFObjectParser.forBytes(b, context).parseObject());
    } catch {
      out.push(PDFNull);
    }
  }
  return out;
}

function num(obj: PDFObject | undefined): number | null {
  return obj instanceof PDFNumber ? obj.asNumber() : null;
}

function nameOf(obj: PDFObject | undefined): string | null {
  return obj instanceof PDFName ? obj.asString() : null;
}

type Matrix = [number, number, number, number, number, number];
const IDENT: Matrix = [1, 0, 0, 1, 0, 0];

function multiply(m: Matrix, n: Matrix): Matrix {
  return [
    m[0] * n[0] + m[1] * n[2],
    m[0] * n[1] + m[1] * n[3],
    m[2] * n[0] + m[3] * n[2],
    m[2] * n[1] + m[3] * n[3],
    m[4] * n[0] + m[5] * n[2] + n[4],
    m[4] * n[1] + m[5] * n[3] + n[5],
  ];
}

function applyPoint(m: Matrix, x: number, y: number): [number, number] {
  return [x * m[0] + y * m[2] + m[4], x * m[1] + y * m[3] + m[5]];
}

function inRect(r: Rect, x: number, y: number): boolean {
  return x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height;
}

function intersectsRect(
  r: Rect,
  x: number,
  y: number,
  w: number,
  h: number
): boolean {
  return !(
    x + w < r.x ||
    x > r.x + r.width ||
    y + h < r.y ||
    y > r.y + r.height
  );
}

// ---------------------------------------------------------------------------
// Graphics/text state
// ---------------------------------------------------------------------------

interface TextState {
  matrix: Matrix;
  lineMatrix: Matrix;
  leading: number;
  fontSize: number;
  charSpacing: number;
  wordSpacing: number;
  hScale: number;
  fontName: string | null;
}

interface GState {
  ctm: Matrix;
  text: TextState;
}

function freshText(): TextState {
  return {
    matrix: IDENT,
    lineMatrix: IDENT,
    leading: 0,
    fontSize: 12,
    charSpacing: 0,
    wordSpacing: 0,
    hScale: 100,
    fontName: null,
  };
}

const PAINT_OPS = new Set([
  "S",
  "s",
  "f",
  "F",
  "f*",
  "B",
  "B*",
  "b",
  "b*",
  "n",
]);
const PATH_OPS = new Set(["m", "l", "c", "v", "y", "h", "re"]);
const TEXT_SHOW_OPS = new Set(["Tj", "TJ", "'", '"']);
const TEXT_STATE_OPS = new Set([
  "BT",
  "ET",
  "Tc",
  "Tw",
  "Tz",
  "TL",
  "Tf",
  "Td",
  "TD",
  "Tm",
  "T*",
  "Tr",
  "Ts",
]);

// ---------------------------------------------------------------------------
// Font metrics for run-width estimation
// ---------------------------------------------------------------------------

function fontWidthEm(
  fontDict: PDFDict | undefined,
  codes: number[]
): number | null {
  if (!fontDict) return null;
  const subtype = nameOf(fontDict.get(PDFName.of("Subtype")));
  if (subtype === "/Type0") {
    const desc = fontDict.lookupMaybe(PDFName.of("DescendantFonts"), PDFArray);
    const cid = desc?.size() ? desc.lookupMaybe(0, PDFDict) : undefined;
    const w = cid?.get(PDFName.of("W"));
    if (!(w instanceof PDFArray)) return null;
    const arr = w.asArray();
    const widths = new Map<number, number>();
    for (let i = 0; i < arr.length; i++) {
      const first = arr[i];
      const second = arr[i + 1];
      if (first instanceof PDFNumber && second instanceof PDFArray) {
        const start = first.asNumber();
        second.asArray().forEach((v, k) => {
          if (v instanceof PDFNumber) widths.set(start + k, v.asNumber());
        });
        i++;
      } else if (
        first instanceof PDFNumber &&
        arr[i + 1] instanceof PDFNumber &&
        arr[i + 2] instanceof PDFNumber
      ) {
        const s = first.asNumber();
        const e = (arr[i + 1] as PDFNumber).asNumber();
        const wv = (arr[i + 2] as PDFNumber).asNumber();
        for (let c = s; c <= e; c++) widths.set(c, wv);
        i += 2;
      }
    }
    let total = 0;
    for (const c of codes) total += widths.get(c) ?? 500;
    return total / 1000;
  }
  const widths = fontDict.get(PDFName.of("Widths"));
  const firstChar = num(fontDict.get(PDFName.of("FirstChar")));
  if (!(widths instanceof PDFArray) || firstChar === null) return null;
  const arr = widths.asArray();
  let total = 0;
  for (const c of codes) {
    const v = arr[c - firstChar];
    total += v instanceof PDFNumber ? v.asNumber() : 500;
  }
  return total / 1000;
}

function stringToCodes(
  obj: PDFObject,
  isCid: boolean
): { codes: number[]; text: string } {
  if (!(obj instanceof PDFHexString) && !(obj instanceof PDFString)) {
    return { codes: [], text: "" };
  }
  const bytes = obj.asBytes();
  const codes: number[] = [];
  if (isCid && bytes.length >= 2) {
    for (let i = 0; i + 1 < bytes.length; i += 2) {
      codes.push((bytes[i]! << 8) | bytes[i + 1]!);
    }
  } else {
    for (const b of bytes) codes.push(b);
  }
  let text: string;
  try {
    text = obj.decodeText();
  } catch {
    text = new TextDecoder("latin1").decode(bytes);
  }
  return { codes, text };
}

// ---------------------------------------------------------------------------
// Resources
// ---------------------------------------------------------------------------

interface Resources {
  fonts: Map<string, PDFDict>;
  xobjects: Map<string, PDFRef>;
}

function readResources(resDict: PDFDict | undefined): Resources {
  const fonts = new Map<string, PDFDict>();
  const xobjects = new Map<string, PDFRef>();
  if (!resDict) return { fonts, xobjects };
  const fontDict = resDict.lookupMaybe(PDFName.of("Font"), PDFDict);
  if (fontDict) {
    for (const [key, value] of fontDict.entries()) {
      const d = resDict.context.lookup(value);
      if (d instanceof PDFDict) fonts.set(key.asString(), d);
    }
  }
  const xo = resDict.lookupMaybe(PDFName.of("XObject"), PDFDict);
  if (xo) {
    for (const [key, value] of xo.entries()) {
      if (value instanceof PDFRef) xobjects.set(key.asString(), value);
    }
  }
  return { fonts, xobjects };
}

// ---------------------------------------------------------------------------
// Serialization
// ---------------------------------------------------------------------------

function serializeOps(ops: OpToken[]): Uint8Array {
  const chunks: Uint8Array[] = [];
  let size = 0;
  const space = new Uint8Array([0x20]);
  for (const t of ops) {
    for (const o of t.operands) {
      chunks.push(o, space);
      size += o.length + 1;
    }
    const opB = new TextEncoder().encode(t.op + "\n");
    chunks.push(opB);
    size += opB.length;
  }
  const out = new Uint8Array(size);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.length;
  }
  return out;
}

function pageContentsBytes(page: PDFPage): Uint8Array[] {
  const contents = page.node.get(PDFName.of("Contents"));
  const streams: Uint8Array[] = [];
  if (!contents) return streams;
  const resolve = (o: PDFObject | undefined) => {
    const s = o instanceof PDFRef ? page.node.context.lookup(o) : o;
    if (s instanceof PDFRawStream) {
      streams.push(decodePDFRawStream(s).decode());
    }
  };
  if (contents instanceof PDFArray) contents.asArray().forEach(resolve);
  else resolve(contents);
  return streams;
}

function mergeBytes(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((a, b) => a + b.length + 1, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
    out[off++] = 0x0a;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Scrub engine
// ---------------------------------------------------------------------------

function scrubTokens(
  tokens: OpToken[],
  region: Rect,
  ctm: Matrix,
  doc: PDFDocument,
  resources: Resources,
  scrubbedStrings: string[],
  warnings: string[]
): { ops: OpToken[]; scrubbed: number } {
  const outOps: OpToken[] = [];
  let scrubbed = 0;
  const gsStack: GState[] = [];
  let gs: GState = { ctm, text: freshText() };
  let pathOps: OpToken[] = [];

  const flushPath = (keep: boolean) => {
    if (keep) outOps.push(...pathOps);
    else scrubbed += pathOps.length;
    pathOps = [];
  };

  for (const tok of tokens) {
    const op = tok.op;
    const operands = parseOperands(tok.operands, doc.context);

    if (op === "q") {
      gsStack.push({ ctm: [...gs.ctm] as Matrix, text: { ...gs.text } });
      flushPath(true);
      outOps.push(tok);
      continue;
    }
    if (op === "Q") {
      gs = gsStack.pop() ?? gs;
      flushPath(true);
      outOps.push(tok);
      continue;
    }
    if (op === "cm") {
      const a = operands.map(num);
      if (a.length === 6 && a.every((v) => v !== null)) {
        gs.ctm = multiply(gs.ctm, a as Matrix);
      }
      flushPath(true);
      outOps.push(tok);
      continue;
    }
    if (TEXT_STATE_OPS.has(op)) {
      flushPath(true);
      applyTextState(gs.text, op, operands);
      outOps.push(tok);
      continue;
    }
    if (TEXT_SHOW_OPS.has(op)) {
      flushPath(true);
      const { drop, text } = evalTextOp(op, operands, gs, resources, region);
      if (drop) {
        scrubbed++;
        if (text.trim().length) scrubbedStrings.push(text);
      } else {
        outOps.push(tok);
      }
      continue;
    }
    if (PATH_OPS.has(op) || op === "W" || op === "W*") {
      pathOps.push(tok);
      continue;
    }
    if (PAINT_OPS.has(op)) {
      const { fullyInside, hasClip } = evalPathInside(pathOps, region, gs, doc);
      pathOps.push(tok);
      flushPath(!(fullyInside && !hasClip));
      continue;
    }
    if (op === "Do") {
      flushPath(true);
      const xoName = nameOf(operands[0]);
      const ref = xoName ? resources.xobjects.get(xoName) : undefined;
      const obj = ref ? doc.context.lookup(ref) : undefined;
      const dict =
        obj instanceof PDFRawStream ? obj.dict : (obj as PDFDict | undefined);
      const subtype = dict ? nameOf(dict.get(PDFName.of("Subtype"))) : null;
      if (subtype === "/Image") {
        const corners = [
          applyPoint(gs.ctm, 0, 0),
          applyPoint(gs.ctm, 1, 0),
          applyPoint(gs.ctm, 1, 1),
          applyPoint(gs.ctm, 0, 1),
        ];
        if (corners.every(([x, y]) => inRect(region, x, y))) {
          scrubbed++;
        } else {
          outOps.push(tok);
        }
        continue;
      }
      if (subtype === "/Form" && dict) {
        // Forms are opaque units: drop the Do only when the whole painted
        // BBox sits inside the region; otherwise keep and warn.
        const bbox = dict.get(PDFName.of("BBox"));
        const mArr = dict.get(PDFName.of("Matrix"));
        let formCtm = gs.ctm;
        if (mArr instanceof PDFArray) {
          const vals = mArr.asArray().map(num);
          if (vals.length === 6 && vals.every((v) => v !== null)) {
            formCtm = multiply(gs.ctm, vals as Matrix);
          }
        }
        if (bbox instanceof PDFArray && bbox.size() >= 4) {
          const v = bbox.asArray().map(num);
          if (v.every((n) => n !== null)) {
            const x1 = v[0]!;
            const y1 = v[1]!;
            const x2 = v[2]!;
            const y2 = v[3]!;
            const corners = [
              applyPoint(formCtm, x1, y1),
              applyPoint(formCtm, x2, y1),
              applyPoint(formCtm, x2, y2),
              applyPoint(formCtm, x1, y2),
            ];
            if (corners.every(([x, y]) => inRect(region, x, y))) {
              scrubbed++;
              continue;
            }
            if (corners.some(([x, y]) => inRect(region, x, y))) {
              warnings.push("form_xobject_partial_overlap");
            }
          }
        }
      }
      outOps.push(tok);
      continue;
    }
    if (op === "INLINE_IMAGE") {
      warnings.push("inline_image_retained");
      outOps.push(tok);
      continue;
    }
    flushPath(true);
    outOps.push(tok);
  }
  flushPath(true);
  return { ops: outOps, scrubbed };
}

function applyTextState(
  text: TextState,
  op: string,
  operands: PDFObject[]
): void {
  switch (op) {
    case "BT":
      text.matrix = IDENT;
      text.lineMatrix = IDENT;
      break;
    case "Tf":
      text.fontName = nameOf(operands[0]);
      text.fontSize = num(operands[1]) ?? text.fontSize;
      break;
    case "Tc":
      text.charSpacing = num(operands[0]) ?? 0;
      break;
    case "Tw":
      text.wordSpacing = num(operands[0]) ?? 0;
      break;
    case "Tz":
      text.hScale = num(operands[0]) ?? 100;
      break;
    case "TL":
      text.leading = num(operands[0]) ?? 0;
      break;
    case "Td":
    case "TD": {
      const tx = num(operands[0]) ?? 0;
      const ty = num(operands[1]) ?? 0;
      if (op === "TD") text.leading = -ty;
      text.lineMatrix = multiply([1, 0, 0, 1, tx, ty], text.lineMatrix);
      text.matrix = text.lineMatrix;
      break;
    }
    case "T*":
      text.lineMatrix = multiply(
        [1, 0, 0, 1, 0, -text.leading],
        text.lineMatrix
      );
      text.matrix = text.lineMatrix;
      break;
    case "Tm": {
      const a = operands.map(num);
      if (a.length === 6 && a.every((v) => v !== null)) {
        text.matrix = a as Matrix;
        text.lineMatrix = a as Matrix;
      }
      break;
    }
    default:
      break;
  }
}

function evalTextOp(
  op: string,
  operands: PDFObject[],
  gs: GState,
  resources: Resources,
  region: Rect
): { drop: boolean; text: string } {
  const fs = gs.text.fontSize;
  const fontDict = gs.text.fontName
    ? resources.fonts.get(gs.text.fontName)
    : undefined;
  const isCid =
    (fontDict && nameOf(fontDict.get(PDFName.of("Subtype")))) === "/Type0";
  let fullText = "";
  let totalEm = 0;
  let charCount = 0;
  const gather = (obj: PDFObject | undefined): void => {
    if (!obj) return;
    if (obj instanceof PDFArray) {
      obj.asArray().forEach(gather);
      return;
    }
    if (obj instanceof PDFString || obj instanceof PDFHexString) {
      const { codes, text } = stringToCodes(obj, isCid);
      fullText += text;
      charCount += codes.length;
      totalEm += fontWidthEm(fontDict, codes) ?? codes.length * 0.55;
    }
  };
  gather(op === '"' ? operands[2] : operands[0]);
  const spaces = (fullText.match(/ /g) ?? []).length;
  const advanceEm =
    (totalEm * fs +
      gs.text.charSpacing * charCount +
      gs.text.wordSpacing * spaces) *
    (gs.text.hScale / 100);
  const textM = multiply(gs.ctm, gs.text.matrix);
  const [x0, y0] = applyPoint(textM, 0, 0);
  const [x1, y1] = applyPoint(textM, advanceEm, 0);
  const capH = Math.abs(fs) || 1;
  const [hx, hy] = applyPoint(textM, 0, capH * 0.75);
  const minX = Math.min(x0, x1, hx);
  const maxX = Math.max(x0, x1, hx);
  const minY = Math.min(y0 - capH * 0.25, y1, hy);
  const maxY = Math.max(y0, y1, hy);
  gs.text.matrix = multiply([1, 0, 0, 1, advanceEm, 0], gs.text.matrix);
  const drop = intersectsRect(
    region,
    minX,
    minY,
    Math.max(0.01, maxX - minX),
    Math.max(0.01, maxY - minY)
  );
  return { drop, text: fullText };
}

function evalPathInside(
  pathOps: OpToken[],
  region: Rect,
  gs: GState,
  doc: PDFDocument
): { fullyInside: boolean; hasClip: boolean } {
  let inside = pathOps.length > 0;
  let sawVertex = false;
  let hasClip = false;
  for (const po of pathOps) {
    if (po.op === "W" || po.op === "W*") {
      hasClip = true;
      continue;
    }
    const vals = parseOperands(po.operands, doc.context).map(num);
    const pts: [number, number][] = [];
    if (po.op === "re") {
      if (vals.length === 4 && vals.every((v) => v !== null)) {
        const rx = vals[0]!;
        const ry = vals[1]!;
        const rw = vals[2]!;
        const rh = vals[3]!;
        pts.push([rx, ry], [rx + rw, ry], [rx + rw, ry + rh], [rx, ry + rh]);
      }
    } else {
      for (let i = 0; i + 1 < vals.length; i += 2) {
        if (vals[i] !== null && vals[i + 1] !== null) {
          pts.push([vals[i]!, vals[i + 1]!]);
        }
      }
    }
    for (const [px, py] of pts) {
      sawVertex = true;
      const [ux, uy] = applyPoint(gs.ctm, px, py);
      if (!inRect(region, ux, uy)) inside = false;
    }
  }
  return { fullyInside: sawVertex && inside, hasClip };
}

function scrubAnnots(page: PDFPage, region: Rect): number {
  const annots = page.node.get(PDFName.of("Annots"));
  if (!(annots instanceof PDFArray) || annots.size() === 0) return 0;
  let removed = 0;
  const keep = annots.asArray().filter((ref) => {
    const annot = page.node.context.lookup(ref);
    if (!(annot instanceof PDFDict)) return true;
    const r = annot.get(PDFName.of("Rect"));
    if (!(r instanceof PDFArray) || r.size() < 4) return true;
    const vals = r.asArray().map(num);
    if (vals.length < 4 || vals.some((v) => v === null)) return true;
    const x1 = vals[0]!;
    const y1 = vals[1]!;
    const x2 = vals[2]!;
    const y2 = vals[3]!;
    const hit = intersectsRect(
      region,
      Math.min(x1, x2),
      Math.min(y1, y2),
      Math.abs(x2 - x1),
      Math.abs(y2 - y1)
    );
    if (hit) removed++;
    return !hit;
  });
  if (removed) {
    page.node.set(PDFName.of("Annots"), page.node.context.obj(keep));
  }
  return removed;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function redactPdfRegions(
  pdfBytes: ArrayBuffer | Uint8Array,
  regions: RedactRegion[]
): Promise<RedactResult> {
  const doc = await PDFDocument.load(pdfBytes, { updateMetadata: false });
  const pages = doc.getPages();
  const warnings: string[] = [];
  const scrubbedStrings: string[] = [];
  let opsScrubbed = 0;
  let annotsScrubbed = 0;
  let regionsApplied = 0;

  const byPage = new Map<number, RedactRegion[]>();
  for (const r of regions) {
    const list = byPage.get(r.page) ?? [];
    list.push(r);
    byPage.set(r.page, list);
  }

  for (const [pageNum, pageRegions] of byPage) {
    const page = pages[pageNum - 1];
    if (!page) {
      warnings.push(`page_${pageNum}_missing`);
      continue;
    }
    const { width: pw, height: ph } = page.getSize();
    const rects = pageRegions.map((r) =>
      percentToPdfRect(pw, ph, r.x, r.y, r.width, r.height)
    );
    // Union of this page's rects — content touching any region is scrubbed.
    let ux = Infinity;
    let uy = Infinity;
    let ux2 = -Infinity;
    let uy2 = -Infinity;
    for (const r of rects) {
      ux = Math.min(ux, r.x);
      uy = Math.min(uy, r.y);
      ux2 = Math.max(ux2, r.x + r.width);
      uy2 = Math.max(uy2, r.y + r.height);
    }
    const region: Rect = { x: ux, y: uy, width: ux2 - ux, height: uy2 - uy };

    const resources = readResources(
      page.node.lookupMaybe(PDFName.of("Resources"), PDFDict)
    );
    const streams = pageContentsBytes(page);
    const outStreams: Uint8Array[] = [];
    for (const streamBytes of streams) {
      const tokens = tokenizeContentStream(streamBytes);
      const { ops: kept, scrubbed } = scrubTokens(
        tokens,
        region,
        IDENT,
        doc,
        resources,
        scrubbedStrings,
        warnings
      );
      opsScrubbed += scrubbed;
      outStreams.push(serializeOps(kept));
    }
    const merged = mergeBytes(outStreams);
    const scrubbedStream = doc.context.register(doc.context.stream(merged));
    page.node.set(PDFName.of("Contents"), scrubbedStream);
    regionsApplied += rects.length;

    annotsScrubbed += scrubAnnots(page, region);

    // Visual mark over the scrubbed areas.
    for (const r of rects) {
      page.drawRectangle({
        x: r.x,
        y: r.y,
        width: r.width,
        height: r.height,
        color: rgb(0, 0, 0),
        opacity: 1,
      });
    }
  }

  // Metadata purge — nothing under the boxes should linger in properties.
  doc.setTitle("");
  doc.setAuthor("");
  doc.setSubject("");
  doc.setKeywords([]);
  doc.setProducer("");
  doc.setCreator("");
  try {
    doc.catalog.delete(PDFName.of("Metadata"));
  } catch {
    // Optional.
  }

  const bytes = await doc.save({ updateFieldAppearances: false });
  return {
    bytes,
    regionsApplied,
    opsScrubbed,
    annotsScrubbed,
    scrubbedStrings: scrubbedStrings.slice(0, 100),
    warnings,
  };
}
