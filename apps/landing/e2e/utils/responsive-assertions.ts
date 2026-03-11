import { expect, type Locator, type Page, type TestInfo } from "@playwright/test";

export type ViewportKind = "desktop" | "mobile" | "tablet";

function requireBox(locator: Locator, name: string): Promise<NonNullable<Awaited<ReturnType<Locator["boundingBox"]>>>> {
  return locator.boundingBox().then((box) => {
    expect(box, `${name} should have a bounding box`).not.toBeNull();
    return box!;
  });
}

export async function assertNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => {
    const root = document.documentElement;
    return Math.max(0, root.scrollWidth - root.clientWidth);
  });

  expect(overflow, "page should not overflow horizontally").toBeLessThanOrEqual(1);
}

export async function expectStacked(top: Locator, bottom: Locator): Promise<void> {
  await expect(top).toBeVisible();
  await expect(bottom).toBeVisible();

  const topBox = await requireBox(top, "top element");
  const bottomBox = await requireBox(bottom, "bottom element");

  expect(bottomBox.y, "second element should render below the first").toBeGreaterThan(
    topBox.y + topBox.height / 2,
  );
}

export async function expectInline(left: Locator, right: Locator): Promise<void> {
  await expect(left).toBeVisible();
  await expect(right).toBeVisible();

  const leftBox = await requireBox(left, "left element");
  const rightBox = await requireBox(right, "right element");

  expect(
    Math.abs(leftBox.y - rightBox.y),
    "inline elements should share roughly the same vertical origin",
  ).toBeLessThan(Math.max(leftBox.height, rightBox.height));
  expect(rightBox.x, "second element should render to the right of the first").toBeGreaterThan(
    leftBox.x + 16,
  );
}

export function getViewportKind(testInfo: TestInfo): ViewportKind {
  if (testInfo.project.name.startsWith("Mobile")) {
    return "mobile";
  }

  if (testInfo.project.name.includes("Tablet")) {
    return "tablet";
  }

  return "desktop";
}
