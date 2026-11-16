import { afterEach, expect, test } from "bun:test";
import { closePages, openPage, uniqueTarget } from "./helpers";

afterEach(closePages);

test("short link answers 302 to its target", async () => {
  const page = await openPage();
  const link = await page.createViaApi();
  const response = await page.request(`/${link.id}`);

  expect(response.status).toBe(302);
  expect(response.headers.get("location")).toBe(link.url);
});

test("unknown short link shows the 404 page", async () => {
  const page = await openPage();
  expect(await page.goto("/zzzzzzzzzz")).toBe(404);
  await page.expect(page.getByRole("heading", { name: "Nie znaleziono linku" })).toBeVisible();
});

test("a dead link page offers the shorten form and creates a link in place", async () => {
  const page = await openPage();
  await page.goto("/zzzzzzzzzz");
  await page.expect(page.getByRole("link", { name: /Zgłoś/ })).toHaveCount(0);
  await page.fill(page.getByLabel("Link do skrócenia"), uniqueTarget());
  await page.click(page.getByRole("button", { name: "Dżajcuj" }));
  await page.expect(page.getByRole("heading", { name: "Twój link jest gotowy" })).toBeVisible();
  await page.expect(page.getByRole("heading", { name: "Nie znaleziono linku" })).toBeHidden();
});
