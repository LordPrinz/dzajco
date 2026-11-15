import { createViaApi, expect, HISTORY_KEY, test, v2Entry } from "./fixtures";

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
  await expect(item.getByText("Utworzono:")).toBeVisible();
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

test("adding the key to a read-only entry updates it without a duplicate", async ({ page }) => {
  const link = await createViaApi(page.request);
  await page.goto("/");
  await page.evaluate(
    ([name, value]) => localStorage.setItem(name as string, value as string),
    [HISTORY_KEY, JSON.stringify([v2Entry({ id: link.id, url: link.url })])],
  );
  await page.goto("/history");
  const item = page.locator("#history-list > li").filter({ hasText: link.id });
  await expect(item.getByText("Tylko do odczytu (brak klucza)")).toBeVisible();

  await page.getByLabel("Krótki link albo kod").fill(link.shortUrl.replace(/^https?:\/\//, ""));
  await page.getByLabel("Klucz do zarządzania").fill(link.secretKey);
  await page.getByRole("button", { name: "Dodaj link" }).click();

  await expect(page.locator("#toasts-status")).toContainText(`Zapisano klucz linku ${link.id}`);
  await expect(page.locator("#history-list > li")).toHaveCount(1);
  await item.getByRole("button", { name: `Usuń link ${link.id}` }).click();
  await expect(page.getByText("Brak zapisanych linków")).toBeVisible();
});

test("a code of only spaces asks for a link", async ({ page }) => {
  await page.goto("/history");

  const code = page.getByLabel("Krótki link albo kod");
  await code.fill("   ");
  await page.getByLabel("Klucz do zarządzania").fill("some-key");
  await page.getByRole("button", { name: "Dodaj link" }).click();

  await expect(page.getByRole("alert")).toHaveText("Wpisz krótki link albo jego kod.");
  await expect(code).toHaveAttribute("aria-invalid", "true");
  await expect(code).toBeFocused();
});

test("a rate limit shows the message and returns focus to the button", async ({ page }) => {
  await page.route("**/api/v1/links/*/stats", (route) =>
    route.fulfill({ status: 429, json: { error: { code: "rate_limited" } } }),
  );
  await page.goto("/history");

  await page.getByLabel("Krótki link albo kod").fill("somelink");
  await page.getByLabel("Klucz do zarządzania").fill("some-key");
  const submit = page.getByRole("button", { name: "Dodaj link" });
  await submit.click();

  await expect(page.getByRole("alert")).toHaveText("Za dużo żądań. Spróbuj ponownie za minutę.");
  await expect(submit).toBeFocused();
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
