import { afterEach, describe, expect, test } from "bun:test";
import { closePages, HISTORY_KEY, openPage, v2Entry } from "./helpers";

afterEach(closePages);

test("public stats page shows the counters and no cities", async () => {
  const page = await openPage();
  const link = await page.createViaApi();
  expect(await page.goto(`/${link.id}/stats`)).toBe(200);

  await page.expect(page.getByRole("heading", { name: "Wejścia" })).toBeVisible();
  // No gauge stuck at zero: a nudge to share, and a single Copy button (the header one).
  await page.expect(page.getByText("Nie ma jeszcze kliknięć")).toBeVisible();
  await page.expect(page.locator(".counter__value")).toHaveCount(0);
  await page.expect(page.locator('[data-copy="shortUrl"]')).toHaveCount(1);
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
  // Stubbed after load: the app reads navigator.clipboard when the button is clicked.
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

describe("times in the viewer's time zone", () => {
  const timezoneId = "Europe/Warsaw";

  test("expiry is shown in local time, not UTC", async () => {
    const page = await openPage({ timezoneId });
    // 20:57 UTC is 22:57 in Warsaw during summer time. Pinned to the next 15 July, as expiry is capped at a year.
    const year = new Date().getUTCFullYear();
    const thisYear = `${year}-07-15T20:57:00Z`;
    const expiresAt =
      Date.parse(thisYear) > Date.now() + 60_000 ? thisYear : `${year + 1}-07-15T20:57:00Z`;
    const link = await page.createViaApi({ expiresAt });
    await page.goto(`/${link.id}/stats`);

    const created = page.locator(".stats__meta time").first();
    const expires = page.locator(".stats__meta time:last-of-type");
    await page.expect(expires).toContainText("22:57");
    await page.expect(expires).notToContainText("UTC");
    await page.expect(created).notToContainText("UTC");
  });

  test("a link without expiry still says never", async () => {
    const page = await openPage({ timezoneId });
    const link = await page.createViaApi();
    await page.goto(`/${link.id}/stats`);

    await page.expect(page.getByText("Wygasa: nigdy")).toBeVisible();
  });
});
