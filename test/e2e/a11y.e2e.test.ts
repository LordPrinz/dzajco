import { afterEach, test } from "bun:test";
import { backend, closePages, openPage } from "./helpers";

afterEach(closePages);

test("the first Tab stop is the skip link and it moves focus to the content", async () => {
  const page = await openPage();
  await page.goto("/");
  // WebKit, like Safari, leaves links out of plain Tab; Option+Tab is its key for every focusable element.
  await page.view.press("Tab", { modifiers: backend === "webkit" ? ["Alt"] : [] });
  const skip = page.getByRole("link", { name: "Przejdź do treści" });
  await page.expect(skip).toBeFocused();
  await page.expect(skip).toBeInViewport();
  // A raw Return keystroke: WebKit turns the named "Enter" into an editing command, which follows no link.
  await page.view.press("\r");
  await page.expect(page.locator("main")).toBeFocused();
});
