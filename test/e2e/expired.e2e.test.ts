import { afterEach, expect, test } from "bun:test";
import { closePages, openPage } from "./helpers";

afterEach(closePages);

test("expired link shows the 410 page", async () => {
  const page = await openPage();
  // The API takes any future instant, so a link that lives for six seconds is enough.
  const expiresAt = new Date(Date.now() + 6000).toISOString().replace(/\.\d+Z$/, "Z");
  const link = await page.createViaApi({ expiresAt });
  const live = await page.request(`/${link.id}`);
  expect(live.status).toBe(302);

  // The first 410 deletes the row lazily and later requests answer 404, so wait for the clock, not for the status.
  await Bun.sleep(Math.max(0, Date.parse(expiresAt) + 500 - Date.now()));

  expect(await page.goto(`/${link.id}`)).toBe(410);
  await page.expect(page.getByRole("heading", { name: "Ten link wygasł" })).toBeVisible();
});
