import { afterEach, expect, test } from "bun:test";
import { closePages, HISTORY_KEY, openPage, seedHistory, uniqueTarget, v2Entry } from "./helpers";

afterEach(closePages);

test("shows a message when the history is empty", async () => {
  const page = await openPage();
  await page.goto("/history");

  await page.expect(page.getByText("Brak zapisanych linków")).toBeVisible();
});

test("the read-only note shows only when an entry has no key", async () => {
  const page = await openPage();
  const link = await page.createViaApi();
  await seedHistory(page, [v2Entry(link)]);
  await page.expect(page.getByRole("listitem").filter({ hasText: link.id })).toBeVisible();
  await page.expect(page.locator("#history-note")).toBeHidden();

  await seedHistory(page, [v2Entry({ id: link.id, url: link.url })]);
  await page.expect(page.locator("#history-note")).toBeVisible();
});

test("v2 entry with a key can be deleted", async () => {
  const page = await openPage();
  const link = await page.createViaApi();
  await seedHistory(page, [v2Entry(link)]);

  const item = page.getByRole("listitem").filter({ hasText: link.id });
  await page.expect(item.getByRole("link", { name: new RegExp(`/${link.id}$`) })).toBeVisible();
  await page.click(item.getByRole("button", { name: `Usuń link ${link.id}` }));
  await page.click(page.getByRole("dialog").getByRole("button", { name: "Usuń", exact: true }));

  await page.expect(page.locator("#toasts-status")).toContainText(`Usunięto link ${link.id}`);
  await page.expect(item).toHaveCount(0);
  expect(await page.storage(HISTORY_KEY)).toEqual([]);
});

test("v2 entry without a key is read-only", async () => {
  const page = await openPage();
  const entry = { id: "someoldlink", url: uniqueTarget() };
  await seedHistory(page, [v2Entry(entry)]);

  const item = page.getByRole("listitem").filter({ hasText: entry.id });
  await page.expect(item.getByText("Tylko do odczytu (brak klucza)")).toBeVisible();
  await page.expect(item.getByRole("button", { name: /Usuń/ })).toHaveCount(0);
});

test("expired v2 entry is pruned from the page and from storage", async () => {
  const page = await openPage();
  const live = { id: "livelink", url: uniqueTarget() };
  const gone = { id: "expiredlink", url: uniqueTarget() };
  await seedHistory(page, [
    v2Entry(live),
    v2Entry(gone, { expire: "2020-01-01T00:00:00.000Z", createdAt: "2019-01-01T00:00:00.000Z" }),
  ]);

  await page.expect(page.getByRole("listitem").filter({ hasText: live.id })).toBeVisible();
  await page.expect(page.getByRole("listitem").filter({ hasText: gone.id })).toHaveCount(0);
  expect(await page.storage(HISTORY_KEY)).toEqual([expect.objectContaining({ id: live.id })]);
});

test("a wrong key keeps the entry and reports the rejection", async () => {
  const page = await openPage();
  const link = await page.createViaApi();
  await seedHistory(page, [v2Entry({ ...link, secretKey: "wrong-key" })]);

  await page.click(page.getByRole("button", { name: `Usuń link ${link.id}` }));
  await page.click(page.getByRole("dialog").getByRole("button", { name: "Usuń", exact: true }));

  await page.expect(page.getByText("Ten klucz nie pasuje do linku.")).toBeAttached();
  await page.expect(page.getByRole("listitem").filter({ hasText: link.id })).toBeVisible();
  const still = await page.request(`/${link.id}`);
  expect(still.status).toBe(302);
});
