import { createViaApi, expect, test } from "./fixtures";

test("short link answers 302 to its target", async ({ page }) => {
  const link = await createViaApi(page.request);
  const response = await page.request.get(`/${link.id}`, { maxRedirects: 0 });

  expect(response.status()).toBe(302);
  expect(response.headers().location).toBe(link.url);
});

test("unknown short link shows the 404 page", async ({ page }) => {
  const response = await page.goto("/zzzzzzzzzz");

  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Nie znaleziono linku" })).toBeVisible();
});
