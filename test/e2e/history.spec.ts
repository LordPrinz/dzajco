import { createViaApi, expect, HISTORY_KEY, test, uniqueTarget, v2Entry } from "./fixtures";

async function seedHistory(page: import("@playwright/test").Page, entries: unknown[]) {
  await page.goto("/");
  await page.evaluate(
    ([name, value]) => localStorage.setItem(name as string, value as string),
    [HISTORY_KEY, JSON.stringify(entries)],
  );
  await page.goto("/history");
}

test("shows a message when the history is empty", async ({ page }) => {
  await page.goto("/history");

  await expect(page.getByText("Brak zapisanych linków")).toBeVisible();
});

test("v2 entry with a key can be deleted", async ({ page }) => {
  const link = await createViaApi(page.request);
  await seedHistory(page, [v2Entry(link)]);

  const item = page.getByRole("listitem").filter({ hasText: link.id });
  await expect(item.getByRole("link", { name: new RegExp(`/${link.id}$`) })).toBeVisible();
  await item.getByRole("button", { name: `Usuń link ${link.id}` }).click();

  await expect(page.locator("#toasts")).toContainText(`Usunięto link ${link.id}`);
  await expect(item).toHaveCount(0);
  const stored = await page.evaluate((name) => localStorage.getItem(name), HISTORY_KEY);
  expect(JSON.parse(stored ?? "[]")).toEqual([]);
});

test("v2 entry without a key is read-only", async ({ page }) => {
  const entry = { id: "someoldlink", url: uniqueTarget() };
  await seedHistory(page, [v2Entry(entry)]);

  const item = page.getByRole("listitem").filter({ hasText: entry.id });
  await expect(item.getByText("Tylko do odczytu (brak klucza)")).toBeVisible();
  await expect(item.getByRole("button", { name: /Usuń/ })).toHaveCount(0);
});

test("expired v2 entry is pruned from the page and from storage", async ({ page }) => {
  const live = { id: "livelink", url: uniqueTarget() };
  const gone = { id: "expiredlink", url: uniqueTarget() };
  await seedHistory(page, [
    v2Entry(live),
    v2Entry(gone, { expire: "2020-01-01T00:00:00.000Z", createdAt: "2019-01-01T00:00:00.000Z" }),
  ]);

  await expect(page.getByRole("listitem").filter({ hasText: live.id })).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: gone.id })).toHaveCount(0);
  const stored = await page.evaluate((name) => localStorage.getItem(name), HISTORY_KEY);
  expect(JSON.parse(stored ?? "[]")).toEqual([expect.objectContaining({ id: live.id })]);
});

test("a wrong key keeps the entry and reports the rejection", async ({ page }) => {
  const link = await createViaApi(page.request);
  await seedHistory(page, [v2Entry({ ...link, secretKey: "wrong-key" })]);

  await page.getByRole("button", { name: `Usuń link ${link.id}` }).click();

  await expect(page.getByText("Ten klucz nie pasuje do linku.")).toBeAttached();
  await expect(page.getByRole("listitem").filter({ hasText: link.id })).toBeVisible();
  const still = await page.request.get(`/${link.id}`, { maxRedirects: 0 });
  expect(still.status()).toBe(302);
});
