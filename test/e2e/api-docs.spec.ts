import { expect, test } from "./fixtures";

test("API docs codes never break inside a word and the page does not scroll sideways on a phone", async ({
  page,
}) => {
  const code = page.locator("td code", { hasText: "credentials_not_allowed" }).first();
  const lineHeight = () =>
    code.evaluate((el) =>
      Number.parseFloat(el.ownerDocument.defaultView?.getComputedStyle(el).lineHeight ?? ""),
    );
  const height = () => code.evaluate((el) => el.getBoundingClientRect().height);

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/docs/api");
  expect(
    await code.evaluate((el) => el.ownerDocument.defaultView?.getComputedStyle(el).overflowWrap),
  ).toBe("normal");
  // It may wrap after an underscore, so two lines at most, never a chopped word.
  expect(await height()).toBeLessThanOrEqual((await lineHeight()) * 2 + 8);

  await page.setViewportSize({ width: 375, height: 800 });
  expect(await page.evaluate("document.documentElement.scrollWidth")).toBeLessThanOrEqual(375);
});
