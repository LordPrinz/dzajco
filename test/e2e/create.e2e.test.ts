import { afterEach, expect, test } from "bun:test";
import { closePages, HISTORY_KEY, openPage, type Page, uniqueTarget } from "./helpers";

afterEach(closePages);

async function shorten(page: Page, target = uniqueTarget()): Promise<void> {
  await page.fill(page.getByLabel("Link do skrócenia"), target);
  await page.click(page.getByRole("button", { name: "Dżajcuj" }));
}

test("creates a link with JavaScript and shows the result card", async () => {
  const page = await openPage();
  const target = uniqueTarget();
  await page.goto("/");
  await shorten(page, target);

  const card = page.locator("#result-slot [data-created]");
  await page.expect(card.getByRole("heading", { name: "Twój link jest gotowy" })).toBeVisible();
  // Shown without the protocol; the full URL is what Copy and the link use.
  await page.expect(card.locator('[data-field="shortUrl"]')).toHaveText(/^[^/:]+(:\d+)?\/[\w-]+$/);
  await page.expect(card.locator('[data-field="shortUrl"]')).toHaveAttribute("href", /^http:\/\//);
  await page
    .expect(card.getByRole("button", { name: "Kopiuj" }).first())
    .toHaveClass(/\bbutton\b(?!--)/);
  await page.expect(card.getByRole("link", { name: "Skróć kolejny link" })).toBeVisible();
  await page.expect(card.locator('[data-field="target"]')).toHaveText(target);
  await page.expect(card.locator('[data-field="secretKey"]')).notToBeEmpty();
  // The key went to History, so the box is a quiet note instead of a warning.
  await page.expect(card.getByText("Klucz do zarządzania")).toBeVisible();
  await page.expect(card.locator("[data-key-box]")).toHaveClass(/notice--quiet/);
  // The result takes the place of the forms.
  await page.expect(page.locator("#shorten-form")).toBeHidden();
  await page.expect(page.locator("#lookup-form")).toBeHidden();
  await page.expect(card).toBeInViewport();
  // The browser path, not the no-JS form post.
  expect(page.requests).toContainEqual({ method: "POST", path: "/api/v1/links", status: 201 });
});

test("saves the new link and its key to the history", async () => {
  const page = await openPage();
  await page.goto("/");
  await shorten(page);
  const keyField = page.locator('#result-slot [data-field="secretKey"]');
  await page.expect(keyField).notToBeEmpty();
  const key = await page.textContent(keyField);

  expect(await page.storage(HISTORY_KEY)).toEqual([expect.objectContaining({ secretKey: key })]);
});

test("copy button puts the short link on the clipboard", async () => {
  const page = await openPage();
  await page.goto("/");
  // A headless browser has no reliable shared clipboard, so record what the page writes to it.
  await page.evaluate(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (text: string) => {
          (globalThis as { __copied?: string }).__copied = text;
        },
      },
    });
  });
  await shorten(page);

  const shortUrl = await page.getAttribute(
    page.locator('#result-slot [data-field="shortUrl"]'),
    "data-value",
  );
  await page.click(page.locator('#result-slot [data-copy="shortUrl"]'));

  await page.expect(page.locator('#result-slot [data-copy="shortUrl"]')).toHaveText("Skopiowano");
  await page
    .expect(page.locator("#toasts-status .toast--success"))
    .toHaveText(/Skopiowano do schowka/);
  expect(await page.evaluate(() => (globalThis as { __copied?: string }).__copied)).toBe(
    shortUrl ?? "missing data-value",
  );
});

test("shows an error for an invalid link under the field and creates nothing", async () => {
  const page = await openPage();
  await page.goto("/");
  const field = page.getByLabel("Link do skrócenia");
  await shorten(page, "ftp://example.com/file");

  const error = page.locator("#form-error");
  await page.expect(error).toHaveText("Dozwolone są tylko adresy http i https.");
  await page.expect(error).toHaveAttribute("role", "alert");
  await page.expect(field).toHaveAccessibleDescription("Dozwolone są tylko adresy http i https.");
  await page.expect(field).toHaveAttribute("aria-invalid", "true");
  await page.expect(page.locator(".toasts .toast")).toHaveCount(0);
  await page.expect(page.locator("#result-slot [data-created]")).toHaveCount(0);

  // Typing clears the red state.
  await page.focus(field);
  await page.view.press("End");
  await page.view.type("x");
  await page.expect(error).toBeHidden();
  await page.expect(field).notToHaveAttribute("aria-invalid", "true");
});

test("asks for a link on an empty submit and calls a bare word invalid", async () => {
  const page = await openPage();
  await page.goto("/");
  await page.click(page.getByRole("button", { name: "Dżajcuj" }));
  await page.expect(page.locator("#form-error")).toHaveText("Najpierw wklej link.");

  await shorten(page, "notaurl");
  await page
    .expect(page.locator("#form-error"))
    .toHaveText("To nie wygląda na poprawny adres URL.");
});

test("a network failure shows a toast that hands focus back when closed", async () => {
  const page = await openPage();
  await page.goto("/");
  // What the page sees when the request never reaches the server.
  await page.evaluate(() => {
    const realFetch = window.fetch.bind(window);
    // The cast only satisfies Bun's own `fetch` type; the page has the browser's.
    window.fetch = ((input: RequestInfo | URL, init?: RequestInit) =>
      String(input).includes("/api/v1/links")
        ? Promise.reject(new TypeError("Failed to fetch"))
        : realFetch(input, init)) as typeof fetch;
  });
  await shorten(page);

  const toast = page.locator("#toasts-alert .toast--error");
  await page.expect(toast).toBeVisible();
  await page.focus(toast.getByRole("button", { name: "Zamknij" }));
  // "Enter" maps to WebKit's insert-newline editing command, which does nothing on a button; "\r" is a real
  // Enter keystroke (keydown with key "Enter") on both backends.
  await page.view.press("\r");
  await page.expect(page.locator(".toasts .toast")).toHaveCount(0);
  await page.expect(page.getByLabel("Link do skrócenia")).toBeFocused();
  expect(page.requests.filter((r) => r.path === "/api/v1/links")).toEqual([]);
});

test("opens the options and shows a custom name error next to the field", async () => {
  const page = await openPage();
  await page.goto("/");
  await page.click(page.getByText("Więcej opcji"));
  await page.fill(page.getByLabel("Własna nazwa"), "a");
  await page.click(page.getByText("Więcej opcji"));
  await shorten(page);

  await page.expect(page.locator("details.options")).toHaveAttribute("open", "");
  await page.expect(page.locator("#options-error")).toContainText("Własna nazwa ma mieć");
  await page.expect(page.getByLabel("Własna nazwa")).toBeFocused();
  await page.expect(page.locator("#form-error")).toBeHidden();
});

test("keeps the strong key warning when the key cannot be saved to History", async () => {
  const page = await openPage();
  await page.goto("/");
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("full", "QuotaExceededError");
    };
  });
  await shorten(page);
  const box = page.locator("#result-slot [data-key-box]");
  await page.expect(box).toHaveClass(/notice--warning/);
  await page.expect(box.getByText("Zapisz klucz")).toBeVisible();
});

test("offers Share where the browser has a share sheet", async () => {
  const page = await openPage();
  await page.goto("/");
  await page.evaluate(() => {
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async (data: { url?: string }) => {
        (globalThis as { __shared?: string }).__shared = data.url;
      },
    });
  });
  await shorten(page);
  await page.click(page.locator("#result-slot").getByRole("button", { name: "Udostępnij" }));
  await page.waitFor("the share sheet", () => (globalThis as { __shared?: string }).__shared);
  const shared = await page.evaluate(() => (globalThis as { __shared?: string }).__shared);
  expect(shared).toMatch(/^http:\/\/.+\/[\w-]+$/);
});

test("hides Share where the browser has no share sheet", async () => {
  const page = await openPage();
  await page.goto("/");
  await page.evaluate(() => {
    Object.defineProperty(navigator, "share", { configurable: true, value: undefined });
  });
  await shorten(page);
  await page.expect(page.locator("#result-slot [data-created]")).toBeVisible();
  await page.expect(page.locator("#result-slot [data-share]")).toBeHidden();
});
