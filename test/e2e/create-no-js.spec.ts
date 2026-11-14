import { expect, test, uniqueTarget } from "./fixtures";

test.use({ javaScriptEnabled: false });

test("creates a link without JavaScript and shows the key with its warning", async ({ page }) => {
  const target = uniqueTarget();
  await page.goto("/");
  await page.getByLabel("Link do skrócenia").fill(target);
  await page.getByRole("button", { name: "Dżajcuj" }).click();

  await expect(page.getByRole("heading", { name: "Twój link jest gotowy" })).toBeVisible();
  await expect(page.locator('[data-field="shortUrl"]')).toHaveText(/^http:\/\/.+\/[\w-]+$/);
  await expect(page.locator('[data-field="target"]')).toHaveText(target);
  await expect(page.locator('[data-field="secretKey"]')).not.toBeEmpty();
  await expect(page.getByText("Zapisz klucz")).toBeVisible();
  await expect(page.getByText("nie pokażemy go ponownie")).toBeVisible();
});

test("shows the form again with an error for an invalid link without JavaScript", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Link do skrócenia").fill("ftp://example.com/file");
  await page.getByRole("button", { name: "Dżajcuj" }).click();

  await expect(page.locator("#form-error")).toBeVisible();
  await expect(page.getByLabel("Link do skrócenia")).toHaveValue("ftp://example.com/file");
});
