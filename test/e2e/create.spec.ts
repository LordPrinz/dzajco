import { expect, HISTORY_KEY, test, uniqueTarget } from "./fixtures";

test("creates a link with JavaScript and shows the result card", async ({ page }) => {
  const target = uniqueTarget();
  await page.goto("/");
  await page.getByLabel("Link do skrócenia").fill(target);
  await page.getByRole("button", { name: "Dżajcuj" }).click();

  const card = page.locator("#result-slot [data-created]");
  await expect(card.getByRole("heading", { name: "Twój link jest gotowy" })).toBeVisible();
  // Shown without the protocol; the full URL is what Copy and the link use.
  await expect(card.locator('[data-field="shortUrl"]')).toHaveText(/^[^/:]+(:\d+)?\/[\w-]+$/);
  await expect(card.locator('[data-field="shortUrl"]')).toHaveAttribute("href", /^http:\/\//);
  await expect(card.getByRole("button", { name: "Kopiuj" }).first()).toHaveClass(
    /\bbutton\b(?!--)/,
  );
  await expect(card.getByRole("link", { name: "Skróć kolejny link" })).toBeVisible();
  await expect(card.locator('[data-field="target"]')).toHaveText(target);
  await expect(card.locator('[data-field="secretKey"]')).not.toBeEmpty();
  // The key went to History, so the box is a quiet note instead of a warning.
  await expect(card.getByText("Klucz do zarządzania")).toBeVisible();
  await expect(card.locator("[data-key-box]")).toHaveClass(/notice--quiet/);
  // The result takes the place of the forms.
  await expect(page.locator("#shorten-form")).toBeHidden();
  await expect(page.locator("#lookup-form")).toBeHidden();
  await expect(card).toBeInViewport();
});

test("saves the new link and its key to the history", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Link do skrócenia").fill(uniqueTarget());
  await page.getByRole("button", { name: "Dżajcuj" }).click();
  const key = await page.locator('#result-slot [data-field="secretKey"]').textContent();

  const stored = await page.evaluate((name) => localStorage.getItem(name), HISTORY_KEY);
  expect(JSON.parse(stored ?? "[]")).toEqual([expect.objectContaining({ secretKey: key })]);
});

test("copy button puts the short link on the clipboard", async ({ page }) => {
  // Headless Chromium has no reliable shared clipboard, so record what the page writes to it.
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (text: string) => {
          (globalThis as { __copied?: string }).__copied = text;
        },
      },
    });
  });
  await page.goto("/");
  await page.getByLabel("Link do skrócenia").fill(uniqueTarget());
  await page.getByRole("button", { name: "Dżajcuj" }).click();

  const shortUrl = await page
    .locator('#result-slot [data-field="shortUrl"]')
    .getAttribute("data-value");
  await page.locator('#result-slot [data-copy="shortUrl"]').click();

  await expect(page.locator('#result-slot [data-copy="shortUrl"]')).toHaveText("Skopiowano");
  await expect(page.locator("#toasts-status .toast--success")).toHaveText(/Skopiowano do schowka/);
  expect(await page.evaluate(() => (globalThis as { __copied?: string }).__copied)).toBe(shortUrl);
});

test("shows an error for an invalid link under the field and creates nothing", async ({ page }) => {
  await page.goto("/");
  const field = page.getByLabel("Link do skrócenia");
  await field.fill("ftp://example.com/file");
  await page.getByRole("button", { name: "Dżajcuj" }).click();

  const error = page.locator("#form-error");
  await expect(error).toHaveText("Dozwolone są tylko adresy http i https.");
  await expect(error).toHaveAttribute("role", "alert");
  await expect(field).toHaveAccessibleDescription("Dozwolone są tylko adresy http i https.");
  await expect(field).toHaveAttribute("aria-invalid", "true");
  await expect(page.locator(".toasts .toast")).toHaveCount(0);
  await expect(page.locator("#result-slot [data-created]")).toHaveCount(0);

  // Typing clears the red state.
  await field.press("End");
  await field.pressSequentially("x");
  await expect(error).toBeHidden();
  await expect(field).not.toHaveAttribute("aria-invalid", "true");
});

test("asks for a link on an empty submit and calls a bare word invalid", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Dżajcuj" }).click();
  await expect(page.locator("#form-error")).toHaveText("Najpierw wklej link.");

  await page.getByLabel("Link do skrócenia").fill("notaurl");
  await page.getByRole("button", { name: "Dżajcuj" }).click();
  await expect(page.locator("#form-error")).toHaveText("To nie wygląda na poprawny adres URL.");
});

test("a network failure shows a toast that hands focus back when closed", async ({ page }) => {
  await page.route("**/api/v1/links", (route) => route.abort());
  await page.goto("/");
  await page.getByLabel("Link do skrócenia").fill(uniqueTarget());
  await page.getByRole("button", { name: "Dżajcuj" }).click();

  const toast = page.locator("#toasts-alert .toast--error");
  await expect(toast).toBeVisible();
  await toast.getByRole("button", { name: "Zamknij" }).focus();
  await toast.getByRole("button", { name: "Zamknij" }).press("Enter");
  await expect(page.locator(".toasts .toast")).toHaveCount(0);
  await expect(page.getByLabel("Link do skrócenia")).toBeFocused();
});

test("opens the options and shows a custom name error next to the field", async ({ page }) => {
  await page.goto("/");
  await page.getByText("Więcej opcji").click();
  await page.getByLabel("Własna nazwa").fill("a");
  await page.getByText("Więcej opcji").click();
  await page.getByLabel("Link do skrócenia").fill(uniqueTarget());
  await page.getByRole("button", { name: "Dżajcuj" }).click();

  await expect(page.locator("details.options")).toHaveAttribute("open", "");
  await expect(page.locator("#options-error")).toContainText("Własna nazwa ma mieć");
  await expect(page.getByLabel("Własna nazwa")).toBeFocused();
  await expect(page.locator("#form-error")).toBeHidden();
});

test("keeps the strong key warning when the key cannot be saved to History", async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("full", "QuotaExceededError");
    };
  });
  await page.goto("/");
  await page.getByLabel("Link do skrócenia").fill(uniqueTarget());
  await page.getByRole("button", { name: "Dżajcuj" }).click();
  const box = page.locator("#result-slot [data-key-box]");
  await expect(box).toHaveClass(/notice--warning/);
  await expect(box.getByText("Zapisz klucz")).toBeVisible();
});

test("offers Share where the browser has a share sheet", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async (data: { url?: string }) => {
        (globalThis as { __shared?: string }).__shared = data.url;
      },
    });
  });
  await page.goto("/");
  await page.getByLabel("Link do skrócenia").fill(uniqueTarget());
  await page.getByRole("button", { name: "Dżajcuj" }).click();
  await page.locator("#result-slot").getByRole("button", { name: "Udostępnij" }).click();
  const shared = await page.evaluate(() => (globalThis as { __shared?: string }).__shared);
  expect(shared).toMatch(/^http:\/\/.+\/[\w-]+$/);
});

test("hides Share where the browser has no share sheet", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "share", { configurable: true, value: undefined });
  });
  await page.goto("/");
  await page.getByLabel("Link do skrócenia").fill(uniqueTarget());
  await page.getByRole("button", { name: "Dżajcuj" }).click();
  await expect(page.locator("#result-slot [data-share]")).toBeHidden();
});
