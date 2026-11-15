import { expect, test } from "./fixtures";

test("API docs do not scroll sideways on a phone and codes are not chopped apart", async ({
  page,
}) => {
  const codeHeight = () =>
    page
      .locator("td code", { hasText: "unsupported_media_type" })
      .first()
      .evaluate((el) => el.getBoundingClientRect().height);

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/docs/api");
  const oneLine = await codeHeight();

  await page.setViewportSize({ width: 375, height: 800 });
  expect(await page.evaluate("document.documentElement.scrollWidth")).toBeLessThanOrEqual(375);
  // At most one break after an underscore, so never the four or five lines of a word chopped apart.
  expect(await codeHeight()).toBeLessThanOrEqual(oneLine * 3);
});
