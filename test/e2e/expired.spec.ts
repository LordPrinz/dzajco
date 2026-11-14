import { createViaApi, expect, test } from "./fixtures";

test("expired link shows the 410 page", async ({ page }) => {
  // The API takes any future instant, so a link that lives for six seconds is enough.
  const expiresAt = new Date(Date.now() + 6000).toISOString().replace(/\.\d+Z$/, "Z");
  const link = await createViaApi(page.request, { expiresAt });
  const live = await page.request.get(`/${link.id}`, { maxRedirects: 0 });
  expect(live.status()).toBe(302);

  // The first 410 deletes the row lazily and later requests answer 404, so wait for the clock, not for the status.
  await expect
    .poll(() => Date.now(), { timeout: 20_000, intervals: [250] })
    .toBeGreaterThan(Date.parse(expiresAt) + 500);

  const response = await page.goto(`/${link.id}`);
  expect(response?.status()).toBe(410);
  await expect(page.getByRole("heading", { name: "Ten link wygasł" })).toBeVisible();
});
