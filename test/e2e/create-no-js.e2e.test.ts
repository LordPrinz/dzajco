import { afterEach, expect, test } from "bun:test";
import { closePages, openPage, uniqueTarget } from "./helpers";

afterEach(closePages);

test("creates a link without JavaScript and shows the key with its warning", async () => {
  const page = await openPage({ javaScript: false });
  const target = uniqueTarget();
  await page.goto("/");
  await page.fill(page.getByLabel("Link do skrócenia"), target);
  await page.click(page.getByRole("button", { name: "Dżajcuj" }));

  await page.expect(page.getByRole("heading", { name: "Twój link jest gotowy" })).toBeVisible();
  await page.expect(page.locator('[data-field="shortUrl"]')).toHaveText(/^[^/:]+(:\d+)?\/[\w-]+$/);
  await page.expect(page.locator('[data-field="shortUrl"]')).toHaveAttribute("href", /^http:\/\//);
  await page.expect(page.locator('[data-field="target"]')).toHaveText(target);
  await page.expect(page.locator('[data-field="secretKey"]')).notToBeEmpty();
  await page.expect(page.getByText("Zapisz klucz")).toBeVisible();
  await page.expect(page.getByText("nie pokażemy go ponownie")).toBeVisible();
  // The form itself was posted, not the API the script would call.
  expect(page.requests).toContainEqual({ method: "POST", path: "/", status: 200 });
  expect(page.requests.some((r) => r.path.startsWith("/api/"))).toBe(false);
});

test("shows the form again with an error for an invalid link without JavaScript", async () => {
  const page = await openPage({ javaScript: false });
  await page.goto("/");
  await page.fill(page.getByLabel("Link do skrócenia"), "ftp://example.com/file");
  await page.click(page.getByRole("button", { name: "Dżajcuj" }));

  await page.expect(page.locator("#form-error")).toBeVisible();
  await page.expect(page.getByLabel("Link do skrócenia")).toHaveValue("ftp://example.com/file");
  expect(page.requests.some((r) => r.method === "POST" && r.path === "/")).toBe(true);
});
