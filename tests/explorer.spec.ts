import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

test("renders a real 3D seat view and changes the selected seat", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.locator("#viewport")).toHaveClass(/is-ready/);
  await expect(page.locator("#scene canvas")).toBeVisible();
  const initialView = await page.locator("#scene canvas").screenshot();
  await page.selectOption("#block", "324");
  await page.fill("#row", "10");
  await page.fill("#seat", "7");
  await page.getByRole("button", { name: "Take me to my seat" }).click();
  await expect(page.locator("#view-block")).toHaveText("Block 324.");
  await expect(page.locator("#view-seat")).toHaveText("Row 10 · Seat 7");
  await expect(page).toHaveURL(/block=324&row=10&seat=7/);
  await expect(page.locator("#view-tier")).toHaveText("UPPER TIER / SEATED");
  const selectedView = await page.locator("#scene canvas").screenshot();
  expect(selectedView.equals(initialView)).toBe(false);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});

test("changes perspective by block map and validates generated row bounds", async ({
  page,
}) => {
  await page.goto("/?block=211&row=18&seat=30");
  const details = page.locator("#map-details");
  if ((await details.getAttribute("open")) === null)
    await details.locator("summary").click();
  await page.locator('[data-block="109"]').click();
  await expect(page.locator("#view-block")).toHaveText("Block 109.");
  await expect(page.locator("#row")).toHaveValue("8");
  await expect(page.locator("#seat")).toHaveValue("24");
  await page.fill("#row", "9");
  await page.getByRole("button", { name: "Take me to my seat" }).click();
  expect(
    await page
      .locator("#row")
      .evaluate((input: HTMLInputElement) => input.validity.rangeOverflow),
  ).toBe(true);
  await expect(page.locator("#view-seat")).toHaveText("Row 8 · Seat 24");
});

test("drops a standing pin, supports keyboard adjustments, and restores its shared URL", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("#viewport")).toHaveClass(/is-ready/);
  await page.getByRole("button", { name: "Standing", exact: true }).click();
  const pen = page.locator('[data-pen="B"]');
  await pen.click({ position: { x: 20, y: 30 } });
  await expect(page.locator("#view-block")).toHaveText("Pen B.");
  await expect(page.locator("#pen-b")).toHaveAttribute("aria-pressed", "true");
  const before = new URL(page.url()).searchParams.get("v");
  await pen.focus();
  await page.keyboard.press("ArrowDown");
  const after = new URL(page.url()).searchParams.get("v");
  expect(Number(after)).toBeGreaterThan(Number(before));
  await page.getByRole("button", { name: "Take me to my spot" }).click();
  const url = page.url(),
    pin = await page.locator("#standing-pin").getAttribute("transform");
  await page.goto(url);
  await expect(page.locator("#standing-mode")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.locator("#standing-pin")).toHaveAttribute(
    "transform",
    pin!,
  );
  await expect(page.locator("#view-block")).toHaveText("Pen B.");
});

test("supports looking, zoom, reset, and the model explanation", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("#viewport")).toHaveClass(/is-ready/);
  await page.locator("#scene canvas").focus();
  await page.keyboard.press("ArrowLeft");
  await expect(page.locator("#look-hint")).toHaveClass(/dismissed/);
  await page.locator("#zoom").fill("42");
  await expect(page.locator("#zoom-value")).toHaveText("1.8×");
  await page.getByRole("button", { name: "Face the stage" }).click();
  await expect(page.locator("#zoom")).toHaveValue("68");
  await page.getByRole("button", { name: "About this preview" }).click();
  await expect(
    page.getByRole("dialog", { name: "A preview. Not a promise." }),
  ).toBeVisible();
  await expect(page.locator("#about-dialog")).toContainText(
    "illustrative estimates",
  );
  await page.keyboard.press("Escape");
  await expect(page.locator("#about-dialog")).not.toBeVisible();
});

test("provides a copyable share link when clipboard permission is unavailable", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", { value: undefined });
  });
  await page.goto("/?block=133&row=3&seat=9");
  await page.getByRole("button", { name: "Share view" }).click();
  await expect(page.locator("#share-dialog")).toBeVisible();
  await expect(page.locator("#share-url")).toHaveValue(
    /block=133&row=3&seat=9/,
  );
});

test("keeps selection and sharing usable when WebGL is unavailable", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      type: string,
      ...args: unknown[]
    ) {
      if (type.startsWith("webgl") || type === "experimental-webgl")
        return null;
      return original.apply(this, [type, ...args] as Parameters<
        typeof original
      >);
    } as typeof original;
  });
  await page.goto("/?block=211&row=6&seat=12");
  await expect(page.locator(".scene-error")).toBeVisible();
  await page.selectOption("#block", "209");
  await expect(page.locator("#view-block")).toHaveText("Block 209.");
  await expect(page.locator("#reset-view")).toBeDisabled();
  await expect(page.locator("#share-view")).toBeEnabled();
});

test("starts and shares the current selection when URL updates are blocked", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    history.replaceState = () => {
      throw new DOMException("Preview blocks URL changes", "SecurityError");
    };
    Object.defineProperty(navigator, "clipboard", { value: undefined });
  });
  await page.goto("/");
  await expect(page.locator("#viewport")).toHaveClass(/is-ready/);
  await page.selectOption("#block", "324");
  await expect(page.locator("#view-block")).toHaveText("Block 324.");
  await page.getByRole("button", { name: "Share view" }).click();
  await expect(page.locator("#share-url")).toHaveValue(/block=324/);
  expect(errors).toEqual([]);
});

test("runs the standalone preview in an opaque sandbox without asset requests", async ({
  page,
}) => {
  const errors: string[] = [],
    requests: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => requests.push(request.url()));
  const html = await readFile(
    new URL("../preview.html", import.meta.url),
    "utf8",
  );
  await page.setContent(
    '<iframe id="embedded-preview" title="Concert preview" sandbox="allow-scripts" style="border:0;width:100%;height:900px"></iframe>',
  );
  await page.locator("iframe").evaluate((frame: HTMLIFrameElement, source) => {
    frame.srcdoc = source;
  }, html);
  const preview = page.frameLocator("#embedded-preview");
  await expect(preview.locator("#viewport")).toHaveClass(/is-ready/);
  await preview.locator("#block").selectOption("133");
  await expect(preview.locator("#view-block")).toHaveText("Block 133.");
  await preview.locator("#row").fill("4");
  await preview.locator("#seat").fill("8");
  await preview.getByRole("button", { name: "Take me to my seat" }).click();
  await expect(preview.locator("#view-seat")).toHaveText("Row 4 · Seat 8");
  await preview.locator("#row").fill("5");
  await preview.locator("#row").press("Enter");
  await expect(preview.locator("#view-seat")).toHaveText("Row 5 · Seat 8");
  await preview.getByRole("button", { name: "Standing", exact: true }).click();
  await preview.getByRole("button", { name: "Pen B", exact: true }).click();
  await expect(preview.locator("#view-block")).toHaveText("Pen B.");
  await preview.getByRole("button", { name: "Share view" }).click();
  await expect(preview.locator("#toast")).toContainText(
    "opened from its website",
  );
  expect(requests.filter((url) => /^https?:/.test(url))).toEqual([]);
  expect(errors).toEqual([]);
});
