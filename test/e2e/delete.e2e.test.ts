import { afterEach, expect, test } from "bun:test";
import { closePages, openPage, type Page, seedHistory, v2Entry } from "./helpers";

afterEach(closePages);

const deletes = (page: Page) => page.requests.filter((r) => r.method === "DELETE");

test("deleting from the history makes the short link answer 404", async () => {
  const page = await openPage();
  const link = await page.createViaApi();
  const before = await page.request(`/${link.id}`);
  expect(before.status).toBe(302);

  await seedHistory(page, [v2Entry(link)]);
  await page.click(page.getByRole("button", { name: `Usuń link ${link.id}` }));
  await page.click(page.getByRole("dialog").getByRole("button", { name: "Usuń", exact: true }));
  await page.expect(page.getByText("Brak zapisanych linków")).toBeVisible();
  await page.expect(page.locator("#history-empty")).toBeFocused();
  expect(deletes(page)).toHaveLength(1);

  expect(await page.goto(`/${link.id}`)).toBe(404);
  await page.expect(page.getByRole("heading", { name: "Nie znaleziono linku" })).toBeVisible();
});

test("cancelling the confirmation keeps the link and returns focus to the button", async () => {
  const page = await openPage();
  const link = await page.createViaApi();
  await seedHistory(page, [v2Entry(link)]);

  const opener = page.getByRole("button", { name: `Usuń link ${link.id}` });
  await page.click(opener);
  const dialog = page.getByRole("dialog");
  await page.expect(dialog).toContainText(link.id);
  await page.expect(dialog.getByRole("button", { name: "Anuluj" })).toBeFocused();
  await page.view.press("Escape");
  await page.expect(dialog).toHaveCount(0);
  await page.expect(opener).toBeFocused();

  await page.click(opener);
  await page.click(dialog.getByRole("button", { name: "Anuluj" }));
  await page.expect(dialog).toHaveCount(0);
  await page.expect(opener).toBeFocused();

  expect(deletes(page)).toEqual([]);
  const still = await page.request(`/${link.id}`);
  expect(still.status).toBe(302);
});
