import { createViaApi, expect, HISTORY_KEY, test } from "./fixtures";

// Each test runs in a fresh browser context, so the history starts empty, like on another device.

test("a link added with its key can be deleted and shows the owner stats", async ({ page }) => {
  const link = await createViaApi(page.request);
  await page.goto("/history");

  await page.getByLabel("Krótki link albo kod").fill(` ${link.shortUrl} `);
  await page.getByLabel("Klucz do zarządzania").fill(link.secretKey);
  await page.getByRole("button", { name: "Dodaj link" }).click();

  await expect(page.locator("#toasts-status")).toContainText(`Dodano link ${link.id}`);
  const item = page.getByRole("listitem").filter({ hasText: link.id });
  await expect(item.getByText(link.url)).toBeVisible();
  const stored = await page.evaluate((name) => localStorage.getItem(name), HISTORY_KEY);
  expect(JSON.parse(stored ?? "[]")).toEqual([
    expect.objectContaining({ id: link.id, url: link.url, secretKey: link.secretKey }),
  ]);

  await page.goto(`/${link.id}/stats`);
  await expect(page.getByRole("heading", { name: "Miasta" })).toBeVisible();

  await page.goto("/history");
  await page.getByRole("button", { name: `Usuń link ${link.id}` }).click();
  await expect(page.getByText("Brak zapisanych linków")).toBeVisible();
  const gone = await page.request.get(`/${link.id}`, { maxRedirects: 0 });
  expect(gone.status()).toBe(404);
});

test("a wrong key shows an error and saves nothing", async ({ page }) => {
  const link = await createViaApi(page.request);
  await page.goto("/history");

  const key = page.getByLabel("Klucz do zarządzania");
  await page.getByLabel("Krótki link albo kod").fill(link.id);
  await key.fill("wrong-key");
  await page.getByRole("button", { name: "Dodaj link" }).click();

  await expect(page.getByRole("alert")).toHaveText("Ten klucz nie pasuje do linku.");
  await expect(key).toHaveAttribute("aria-invalid", "true");
  await expect(page.locator("#history-list > li")).toHaveCount(0);
  const stored = await page.evaluate((name) => localStorage.getItem(name), HISTORY_KEY);
  expect(JSON.parse(stored ?? "[]")).toEqual([]);
});

test("an unknown link shows an error on the link field", async ({ page }) => {
  // A malformed key is rejected before the link is looked up, so this one has the real format.
  const { secretKey } = await createViaApi(page.request);
  await page.goto("/history");

  const code = page.getByLabel("Krótki link albo kod");
  await code.fill("nosuchlink-e2e");
  await page.getByLabel("Klucz do zarządzania").fill(secretKey);
  await page.getByRole("button", { name: "Dodaj link" }).click();

  await expect(page.getByRole("alert")).toHaveText("Nie ma takiego linku albo już wygasł.");
  await expect(code).toHaveAttribute("aria-invalid", "true");
});
