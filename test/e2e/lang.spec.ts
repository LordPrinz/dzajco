import type { Page } from "@playwright/test";
import { expect, test, uniqueTarget } from "./fixtures";

test.describe("in English", () => {
  test.use({ locale: "en-GB" });

  test("creates a link and shows English feedback", async ({ page }) => {
    // Pinned by the URL: wrangler dev may report a country in Poland, which would pick Polish.
    await page.goto("/?lang=en");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");

    await page.getByLabel("Link to shorten").fill("ftp://example.com/file");
    await page.getByRole("button", { name: "Shorten" }).click();
    await expect(page.locator("#form-error")).toHaveText(
      "Only http and https addresses are allowed.",
    );

    await page.getByLabel("Link to shorten").fill(uniqueTarget());
    await page.getByRole("button", { name: "Shorten" }).click();
    await expect(page.getByRole("heading", { name: "Your link is ready" })).toBeVisible();
  });
});

test("the English home page loads only the basic Latin font", async ({ page }) => {
  const fonts: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/fonts/")) fonts.push(request.url());
  });
  await page.goto("/?lang=en", { waitUntil: "networkidle" });
  expect(fonts.some((url) => url.endsWith("open-sans-latin.woff2"))).toBe(true);
  expect(fonts.some((url) => url.includes("latin-ext"))).toBe(false);
});

async function switchToEnglish(page: Page) {
  await page.goto("/about?lang=pl");
  await expect(page.locator("html")).toHaveAttribute("lang", "pl");

  await page.getByRole("button", { name: "English" }).click();
  await expect(page).toHaveURL(/\/about$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("button", { name: "English" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  // The choice is a cookie, so the next page is English too.
  await page.goto("/history");
  await expect(page.getByRole("heading", { name: "Link history" })).toBeVisible();
}

test("the language switch changes and remembers the language", async ({ page }) => {
  await switchToEnglish(page);
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("the language switch still works", async ({ page }) => {
    await switchToEnglish(page);
  });
});
