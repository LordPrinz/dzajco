import { afterEach, expect, test } from "bun:test";
import { closePages, HISTORY_KEY, openPage, v2Entry } from "./helpers";

afterEach(closePages);

test("public stats page shows the counters and no cities", async () => {
  const page = await openPage();
  const link = await page.createViaApi();
  expect(await page.goto(`/${link.id}/stats`)).toBe(200);

  await page.expect(page.getByRole("heading", { name: "Wejścia" })).toBeVisible();
  // No gauge stuck at zero: a nudge to share, with Copy.
  await page.expect(page.getByText("Nie ma jeszcze kliknięć")).toBeVisible();
  await page.expect(page.locator(".counter__value")).toHaveCount(0);
  await page.expect(page.locator('.stats__zero [data-copy="shortUrl"]')).toBeVisible();
  // Visitors who are not the owner can report the link.
  await page.expect(page.locator("[data-report]")).toBeVisible();
  await page.expect(page.getByRole("heading", { name: "Miasta" })).toBeHidden();
  await page.expect(page.locator("[data-owner]")).toBeHidden();
  await page.expect(page.locator("[data-owner-hint]")).toBeVisible();
});

// The history is seeded from another page of the same origin first, so it is there when the stats page loads.
test("owner view appears with the key from the history and hides the map without coordinates", async () => {
  const page = await openPage();
  const link = await page.createViaApi();
  await page.goto("/");
  await page.seedStorage(HISTORY_KEY, [v2Entry(link)]);
  await page.goto(`/${link.id}/stats`);

  await page.expect(page.locator("[data-owner]")).toBeVisible();
  await page.expect(page.getByRole("heading", { name: "Miasta" })).toBeVisible();
  await page.expect(page.getByText("Brak danych o miastach")).toBeVisible();
  await page.expect(page.getByRole("button", { name: "Pokaż mapę" })).toBeHidden();
  await page.expect(page.locator("[data-owner-hint]")).toBeHidden();
  // The owner has no reason to report their own link.
  await page.expect(page.locator("[data-report]")).toBeHidden();
});

test("a wrong key in the history leaves the page in the public view", async () => {
  const page = await openPage();
  const link = await page.createViaApi();
  await page.goto("/");
  await page.seedStorage(HISTORY_KEY, [v2Entry({ ...link, secretKey: "not-the-key" })]);
  await page.goto(`/${link.id}/stats`);

  await page.expect(page.locator("[data-owner-hint]")).toBeVisible();
  await page.expect(page.locator("[data-owner]")).toBeHidden();
});

test("the stats header copies the full short link", async () => {
  const page = await openPage();
  const link = await page.createViaApi();
  await page.goto(`/${link.id}/stats`);
  await page.evaluate(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (text: string) => {
          (globalThis as { __copied?: string }).__copied = text;
        },
      },
    });
  });
  await page.click(page.locator('.stats__head [data-copy="shortUrl"]'));
  await page.waitFor("the copied text", () => (globalThis as { __copied?: string }).__copied);
  const copied = await page.evaluate(() => (globalThis as { __copied?: string }).__copied);
  expect(copied).toMatch(new RegExp(`/${link.id}$`));
  expect(copied).toMatch(/^https?:\/\//);
});
