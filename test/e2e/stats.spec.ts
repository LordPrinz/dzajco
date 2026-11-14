import { createViaApi, expect, HISTORY_KEY, test, v2Entry } from "./fixtures";

test("public stats page shows the counters and no cities", async ({ page }) => {
  const link = await createViaApi(page.request);
  const response = await page.goto(`/${link.id}/stats`);

  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "Wejścia" })).toBeVisible();
  await expect(page.locator(".counter__value")).toHaveText("0");
  await expect(page.getByRole("heading", { name: "Miasta" })).toBeHidden();
  await expect(page.locator("[data-owner]")).toBeHidden();
  await expect(page.locator("[data-owner-hint]")).toBeVisible();
});

test("owner view appears with the key from the history and hides the map without coordinates", async ({
  page,
}) => {
  const link = await createViaApi(page.request);
  await page.addInitScript(
    ([name, entries]) => localStorage.setItem(name as string, JSON.stringify(entries)),
    [HISTORY_KEY, [v2Entry(link)]],
  );
  await page.goto(`/${link.id}/stats`);

  await expect(page.locator("[data-owner]")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Miasta" })).toBeVisible();
  await expect(page.getByText("Brak danych o miastach")).toBeVisible();
  await expect(page.getByRole("button", { name: "Pokaż mapę" })).toBeHidden();
  await expect(page.locator("[data-owner-hint]")).toBeHidden();
});

test("a wrong key in the history leaves the page in the public view", async ({ page }) => {
  const link = await createViaApi(page.request);
  await page.addInitScript(
    ([name, entries]) => localStorage.setItem(name as string, JSON.stringify(entries)),
    [HISTORY_KEY, [v2Entry({ ...link, secretKey: "not-the-key" })]],
  );
  await page.goto(`/${link.id}/stats`);

  await expect(page.locator("[data-owner-hint]")).toBeVisible();
  await expect(page.locator("[data-owner]")).toBeHidden();
});
