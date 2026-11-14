import { expect, HISTORY_KEY, test, uniqueTarget } from "./fixtures";

test("creates a link with JavaScript and shows the result card", async ({ page }) => {
  const target = uniqueTarget();
  await page.goto("/");
  await page.getByLabel("Link do skrócenia").fill(target);
  await page.getByRole("button", { name: "Dżajcuj" }).click();

  const card = page.locator("#result-slot [data-created]");
  await expect(card.getByRole("heading", { name: "Twój link jest gotowy" })).toBeVisible();
  await expect(card.locator('[data-field="shortUrl"]')).toHaveText(/^http:\/\/.+\/[\w-]+$/);
  await expect(card.locator('[data-field="target"]')).toHaveText(target);
  await expect(card.locator('[data-field="secretKey"]')).not.toBeEmpty();
  await expect(card.getByText("Zapisz klucz")).toBeVisible();
});

test("saves the new link and its key to the history", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Link do skrócenia").fill(uniqueTarget());
  await page.getByRole("button", { name: "Dżajcuj" }).click();
  const key = await page.locator('#result-slot [data-field="secretKey"]').textContent();

  const stored = await page.evaluate((name) => localStorage.getItem(name), HISTORY_KEY);
  expect(JSON.parse(stored ?? "[]")).toEqual([expect.objectContaining({ secretKey: key })]);
});

test("copy button puts the short link on the clipboard", async ({ page }) => {
  // Headless Chromium has no reliable shared clipboard, so record what the page writes to it.
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (text: string) => {
          (globalThis as { __copied?: string }).__copied = text;
        },
      },
    });
  });
  await page.goto("/");
  await page.getByLabel("Link do skrócenia").fill(uniqueTarget());
  await page.getByRole("button", { name: "Dżajcuj" }).click();

  const shortUrl = await page.locator('#result-slot [data-field="shortUrl"]').textContent();
  await page.locator('#result-slot [data-copy="shortUrl"]').click();

  await expect(page.locator('#result-slot [data-copy="shortUrl"]')).toHaveText("Skopiowano");
  expect(await page.evaluate(() => (globalThis as { __copied?: string }).__copied)).toBe(shortUrl);
});

test("shows an error for an invalid link and creates nothing", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Link do skrócenia").fill("ftp://example.com/file");
  await page.getByRole("button", { name: "Dżajcuj" }).click();

  await expect(page.locator("#form-error")).toBeVisible();
  await expect(page.locator("#result-slot [data-created]")).toHaveCount(0);
});
