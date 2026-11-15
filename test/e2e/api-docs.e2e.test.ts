import { afterEach, expect, test } from "bun:test";
import { closePages, openPage } from "./helpers";

afterEach(closePages);

test("API docs codes never break inside a word and the page does not scroll sideways on a phone", async () => {
  const page = await openPage();
  // The first `td code` that contains the text, measured in the page.
  const measure = () =>
    page.evaluate(() => {
      const code = [...document.querySelectorAll("td code")].find((el) =>
        el.textContent?.includes("credentials_not_allowed"),
      );
      if (!code) throw new Error("no code element");
      const style = getComputedStyle(code);
      return {
        overflowWrap: style.overflowWrap,
        lineHeight: Number.parseFloat(style.lineHeight),
        height: code.getBoundingClientRect().height,
      };
    });

  await page.view.resize(1280, 900);
  await page.goto("/docs/api");
  const code = await measure();
  expect(code.overflowWrap).toBe("normal");
  // It may wrap after an underscore, so two lines at most, never a chopped word.
  expect(code.height).toBeLessThanOrEqual(code.lineHeight * 2 + 8);

  await page.view.resize(375, 800);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
});
