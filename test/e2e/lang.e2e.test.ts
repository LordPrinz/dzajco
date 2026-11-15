import { afterEach, describe, expect, test } from "bun:test";
import { closePages, openPage, type Page, uniqueTarget } from "./helpers";

afterEach(closePages);

describe("in English", () => {
  test("creates a link and shows English feedback", async () => {
    const page = await openPage({ locale: "en-GB" });
    // Pinned by the URL: wrangler dev may report a country in Poland, which would pick Polish.
    await page.goto("/?lang=en");
    await page.expect(page.locator("html")).toHaveAttribute("lang", "en");

    await page.fill(page.getByLabel("Link to shorten"), "ftp://example.com/file");
    await page.click(page.getByRole("button", { name: "Shorten" }));
    await page
      .expect(page.locator("#form-error"))
      .toHaveText("Only http and https addresses are allowed.");

    await page.fill(page.getByLabel("Link to shorten"), uniqueTarget());
    await page.click(page.getByRole("button", { name: "Shorten" }));
    await page.expect(page.getByRole("heading", { name: "Your link is ready" })).toBeVisible();
  });
});

test("the English home page loads only the basic Latin font", async () => {
  const page = await openPage();
  await page.goto("/?lang=en");
  await page.waitFor("the fonts", () => document.fonts.ready.then(() => true));
  // Every request goes through the page's proxy, so its log is the network log.
  const fonts = page.requests.map((r) => r.path).filter((path) => path.includes("/fonts/"));
  expect(fonts.some((path) => path.endsWith("open-sans-latin.woff2"))).toBe(true);
  expect(fonts.some((path) => path.includes("latin-ext"))).toBe(false);
});

async function switchToEnglish(page: Page) {
  await page.goto("/about?lang=pl");
  await page.expect(page.locator("html")).toHaveAttribute("lang", "pl");

  await page.click(page.getByRole("button", { name: "English" }));
  await page.waitForUrl(/\/about$/);
  await page.expect(page.locator("html")).toHaveAttribute("lang", "en");
  await page
    .expect(page.getByRole("button", { name: "English" }))
    .toHaveAttribute("aria-pressed", "true");

  // The choice is a cookie, so the next page is English too.
  await page.goto("/history");
  await page.expect(page.getByRole("heading", { name: "Link history" })).toBeVisible();
}

test("the language switch changes and remembers the language", async () => {
  await switchToEnglish(await openPage());
});

describe("without JavaScript", () => {
  test("the language switch still works", async () => {
    const page = await openPage({ javaScript: false });
    await switchToEnglish(page);
    expect(page.requests).toContainEqual({ method: "POST", path: "/prefs/lang", status: 303 });
  });
});
