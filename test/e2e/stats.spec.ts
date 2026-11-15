import { createViaApi, expect, HISTORY_KEY, test, v2Entry } from "./fixtures";

test("public stats page shows the counters and no cities", async ({ page }) => {
  const link = await createViaApi(page.request);
  const response = await page.goto(`/${link.id}/stats`);

  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "Wejścia" })).toBeVisible();
  // No gauge stuck at zero: a nudge to share, with Copy.
  await expect(page.getByText("Nie ma jeszcze kliknięć")).toBeVisible();
  await expect(page.locator(".counter__value")).toHaveCount(0);
  await expect(page.locator('.stats__zero [data-copy="shortUrl"]')).toBeVisible();
  // Visitors who are not the owner can report the link.
  await expect(page.locator("[data-report]")).toBeVisible();
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
  // The owner has no reason to report their own link.
  await expect(page.locator("[data-report]")).toBeHidden();
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

test("the stats header copies the full short link", async ({ page }) => {
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
  const link = await createViaApi(page.request);
  await page.goto(`/${link.id}/stats`);
  await page.locator('.stats__head [data-copy="shortUrl"]').click();
  const copied = await page.evaluate(() => (globalThis as { __copied?: string }).__copied);
  expect(copied).toMatch(new RegExp(`/${link.id}$`));
  expect(copied).toMatch(/^https?:\/\//);
});
