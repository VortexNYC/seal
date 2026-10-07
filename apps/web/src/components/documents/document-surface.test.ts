import { canvas } from "@seal/tokens/theme";
import { describe, expect, it } from "vitest";

import { FIELD_DIMENSIONS } from "@/lib/field-types";

import {
  centeredPageShift,
  fieldChrome,
  fieldDisplayLabel,
  fieldPlacementBox,
  fieldRowWidth,
  markupClearsBecauseFieldArmed,
  markupExport,
  markupInkTools,
  markupLeaveSave,
  thumbnailPageRender,
  thumbnailPdfUrl,
  overlayOnRenderedPage,
  pageBoxFromMetrics,
  pageSlot,
  type PageBox,
} from "./document-surface";

const letter: PageBox = {
  x: 0,
  y: 0,
  width: 612,
  height: 792,
  scale: 1,
  naturalWidth: 612,
  naturalHeight: 792,
};

describe("page overlay", () => {
  it("treats a visible page edge as the slice origin, not the centered sheet", () => {
    const box = pageBoxFromMetrics(
      {
        viewportX: 0,
        viewportY: 0,
        scaled: { pageX: 0, pageY: 10, scale: 1 },
      },
      { width: 612, height: 792, rotatedWidth: 612, rotatedHeight: 792 }
    );
    expect(box).toMatchObject({ x: 0, y: -10, width: 612, height: 792 });
  });

  it("puts the overlay on the rendered page, not the stage gutter", () => {
    const placed = overlayOnRenderedPage(
      { left: 454, top: 143, clientLeft: 1, clientTop: 1 },
      { left: 750, top: 143, width: 612, height: 792 },
      letter
    );
    expect(placed.x + 454 + 1).toBe(750);
    expect(placed.y + 143 + 1).toBe(143);
    expect(placed.width).toBe(612);
  });

  it("centers a narrower page in the stage when the shell is not measured yet", () => {
    expect(centeredPageShift(1204, 612, 0)).toBe(296);
    expect(letter.x + centeredPageShift(1204, letter.width, 0)).toBe(296);
  });

  it("keeps one shell per page so page 2 is not the duplicate of page 1", () => {
    const shells = [-659, -659, 143, 143, 945, 945, 1747, 2549].map(
      (top, index) => ({ top, node: index })
    );
    expect(pageSlot(shells, 1)?.top).toBe(-659);
    expect(pageSlot(shells, 2)?.top).toBe(143);
    expect(pageSlot(shells, 5)?.top).toBe(2549);
    expect(pageSlot(shells, 6)).toBeNull();
  });
});

describe("field and pen", () => {
  it("keeps a pen chosen while a field is still armed", () => {
    expect(markupClearsBecauseFieldArmed(true, true)).toBe(false);
  });

  it("drops the pen when a field is newly armed", () => {
    expect(markupClearsBecauseFieldArmed(false, true)).toBe(true);
  });

  it("does not clear markup when the field arm goes away", () => {
    expect(markupClearsBecauseFieldArmed(true, false)).toBe(false);
    expect(markupClearsBecauseFieldArmed(false, false)).toBe(false);
  });
});

describe("field spacing", () => {
  it("shows the type name on one line, not the generated Field suffix", () => {
    expect(fieldDisplayLabel("Initials", "Initials Field")).toBe("Initials");
    expect(fieldDisplayLabel("Date signed", "Date signed Field")).toBe(
      "Date signed"
    );
    expect(fieldDisplayLabel("Name", "Buyer")).toBe("Buyer");
  });

  it("gives an email field a full address width", () => {
    expect(FIELD_DIMENSIONS.email).toEqual({ width: 208, height: 28 });
    expect(FIELD_DIMENSIONS.email.width).toBeGreaterThan(
      FIELD_DIMENSIONS.signature.width
    );
  });

  it("hugs the label instead of taking a third of the page", () => {
    const chips: Array<[keyof typeof FIELD_DIMENSIONS, string]> = [
      ["signature", "Signature"],
      ["initials", "Initials"],
      ["name", "Name"],
      ["date", "Date"],
      ["date_signed", "Date signed"],
      ["text", "Text"],
    ];
    for (const [type, label] of chips) {
      const { width, height } = FIELD_DIMENSIONS[type];
      expect(width).toBeGreaterThanOrEqual(fieldRowWidth(label));
      expect(width).toBeLessThanOrEqual(fieldRowWidth(label) + 12);
      expect(height).toBe(28);
    }
  });

  it("stores the same page fraction at 100% and at 139% zoom", () => {
    const placed = (renderedWidth: number) =>
      fieldPlacementBox({
        naturalWidth: 612,
        naturalHeight: 792,
        renderedWidth,
        renderedHeight: (792 / 612) * renderedWidth,
        pageLeft: 0,
        pageTop: 0,
        clientX: 300,
        clientY: 200,
        widthPx: FIELD_DIMENSIONS.initials.width,
        heightPx: FIELD_DIMENSIONS.initials.height,
        anchor: "center",
      });
    const at100 = placed(612);
    const at139 = placed(850);
    expect(at100.width).toBeCloseTo(at139.width, 5);
    expect(at100.height).toBeCloseTo(at139.height, 5);
    expect(at100.width).toBeCloseTo((FIELD_DIMENSIONS.initials.width / 612) * 100, 5);
  });
});

describe("markup thumbnails", () => {
  it("shows the saved PDF after a mark, and the opened file before that", () => {
    expect(thumbnailPdfUrl("blob:doc", null)).toBe("blob:doc");
    expect(thumbnailPdfUrl("blob:doc", "blob:saved")).toBe("blob:saved");
    expect(thumbnailPdfUrl(null, null)).toBeNull();
  });

  it("paints annotations into the page thumbnail", () => {
    expect(thumbnailPageRender(0.2, 2)).toEqual({
      scaleFactor: 0.2,
      dpr: 2,
      withAnnotations: true,
    });
  });
});

describe("markup commit", () => {
  it("commits pen and highlighter on lift, and uploads when the page leaves", () => {
    const tools = markupInkTools();
    expect(tools.map((tool) => tool.id)).toEqual(["ink", "inkHighlighter"]);
    expect(tools.every((tool) => tool.behavior.commitDelay === 0)).toBe(true);
    expect(markupLeaveSave("pagehide")).toEqual({ flush: true, keepalive: true });
    expect(markupLeaveSave("hidden")).toEqual({ flush: true, keepalive: true });
    expect(markupLeaveSave("unmount")).toEqual({ flush: true, keepalive: false });
  });
});

describe("markup export", () => {
  it("exports the open document through saveAsCopy", () => {
    const scoped = { toPromise: () => Promise.resolve(new ArrayBuffer(4)) };
    const root = { toPromise: () => Promise.resolve(new ArrayBuffer(2)) };
    const cap = {
      saveAsCopy: () => root,
      forDocument: (id: string) => {
        expect(id).toBe("doc-1");
        return { saveAsCopy: () => scoped };
      },
    };
    expect(markupExport(cap, "doc-1")?.()).toBe(scoped);
    expect(markupExport({ saveAsCopy: () => root }, null)?.()).toBe(root);
    expect(markupExport(null, "doc-1")).toBeNull();
    expect(markupExport({}, "doc-1")).toBeNull();
  });
});

describe("field chrome", () => {
  it("uses one ink for every field", () => {
    const chrome = fieldChrome();
    expect(chrome.ink).toBe("#2c271f");
    expect(chrome.accent).toBe(chrome.ink);
    expect(canvas.filled.stroke).toBe(canvas.chrome.ink);
    expect(canvas.filled.accent).toBe(canvas.chrome.ink);
    expect("fieldColors" in canvas).toBe(false);
  });
});
