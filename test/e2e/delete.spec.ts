import { createViaApi, expect, HISTORY_KEY, test, v2Entry } from "./fixtures";

test("deleting from the history makes the short link answer 404", async ({ page }) => {
  const link = await createViaApi(page.request);
  const before = await page.request.get(`/${link.id}`, { maxRedirects: 0 });
  expect(before.status()).toBe(302);

  await page.goto("/");
  await page.evaluate(
    ([name, value]) => localStorage.setItem(name as string, value as string),
    [HISTORY_KEY, JSON.stringify([v2Entry(link)])],
  );
  await page.goto("/history");
  await page.getByRole("button", { name: `Usuń link ${link.id}` }).click();
  await expect(page.getByText("Brak zapisanych linków")).toBeVisible();

  const response = await page.goto(`/${link.id}`);
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Nie znaleziono linku" })).toBeVisible();
});
