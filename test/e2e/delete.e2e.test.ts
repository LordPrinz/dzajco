import { afterEach, expect, test } from "bun:test";
import { closePages, HISTORY_KEY, openPage, v2Entry } from "./helpers";

afterEach(closePages);

test("deleting from the history makes the short link answer 404", async () => {
  const page = await openPage();
  const link = await page.createViaApi();
  const before = await page.request(`/${link.id}`);
  expect(before.status).toBe(302);

  await page.goto("/");
  await page.seedStorage(HISTORY_KEY, [v2Entry(link)]);
  await page.goto("/history");
  await page.click(page.getByRole("button", { name: `Usuń link ${link.id}` }));
  await page.expect(page.getByText("Brak zapisanych linków")).toBeVisible();

  expect(await page.goto(`/${link.id}`)).toBe(404);
  await page.expect(page.getByRole("heading", { name: "Nie znaleziono linku" })).toBeVisible();
});
