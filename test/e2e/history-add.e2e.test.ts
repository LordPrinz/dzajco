import { afterEach, expect, test } from "bun:test";
import { closePages, HISTORY_KEY, openPage, v2Entry } from "./helpers";

afterEach(closePages);

// Each test gets its own origin, so the history starts empty, like on another device.

test("a link added with its key can be deleted and shows the owner stats", async () => {
  const page = await openPage();
  const link = await page.createViaApi();
  await page.goto("/history");

  await page.fill(page.getByLabel("Krótki link albo kod"), ` ${link.shortUrl} `);
  await page.fill(page.getByLabel("Klucz do zarządzania"), link.secretKey);
  await page.click(page.getByRole("button", { name: "Dodaj link" }));

  await page.expect(page.locator("#toasts-status")).toContainText(`Dodano link ${link.id}`);
  const item = page.getByRole("listitem").filter({ hasText: link.id });
  await page.expect(item.getByText(link.url)).toBeVisible();
  await page.expect(item.getByText("Utworzono:")).toBeVisible();
  expect(await page.storage(HISTORY_KEY)).toEqual([
    expect.objectContaining({ id: link.id, url: link.url, secretKey: link.secretKey }),
  ]);

  await page.goto(`/${link.id}/stats`);
  await page.expect(page.getByRole("heading", { name: "Miasta" })).toBeVisible();

  await page.goto("/history");
  await page.click(page.getByRole("button", { name: `Usuń link ${link.id}` }));
  await page.click(page.getByRole("dialog").getByRole("button", { name: "Usuń", exact: true }));
  await page.expect(page.getByText("Brak zapisanych linków")).toBeVisible();
  const gone = await page.request(`/${link.id}`);
  expect(gone.status).toBe(404);
});

test("adding the key to a read-only entry updates it without a duplicate", async () => {
  const page = await openPage();
  const link = await page.createViaApi();
  await page.goto("/");
  await page.seedStorage(HISTORY_KEY, [v2Entry({ id: link.id, url: link.url })]);
  await page.goto("/history");
  const item = page.locator("#history-list > li").filter({ hasText: link.id });
  await page.expect(item.getByText("Tylko do odczytu (brak klucza)")).toBeVisible();

  await page.fill(
    page.getByLabel("Krótki link albo kod"),
    link.shortUrl.replace(/^https?:\/\//, ""),
  );
  await page.fill(page.getByLabel("Klucz do zarządzania"), link.secretKey);
  await page.click(page.getByRole("button", { name: "Dodaj link" }));

  await page
    .expect(page.locator("#toasts-status"))
    .toContainText(`Zapisano klucz linku ${link.id}`);
  await page.expect(page.locator("#history-list > li")).toHaveCount(1);
  await page.click(item.getByRole("button", { name: `Usuń link ${link.id}` }));
  await page.click(page.getByRole("dialog").getByRole("button", { name: "Usuń", exact: true }));
  await page.expect(page.getByText("Brak zapisanych linków")).toBeVisible();
});

test("a code of only spaces asks for a link", async () => {
  const page = await openPage();
  await page.goto("/history");

  const code = page.getByLabel("Krótki link albo kod");
  await page.fill(code, "   ");
  await page.fill(page.getByLabel("Klucz do zarządzania"), "some-key");
  await page.click(page.getByRole("button", { name: "Dodaj link" }));

  await page.expect(page.getByRole("alert")).toHaveText("Wpisz krótki link albo jego kod.");
  await page.expect(code).toHaveAttribute("aria-invalid", "true");
  await page.expect(code).toBeFocused();
});

test("a rate limit shows the message and returns focus to the button", async () => {
  const page = await openPage({
    route: (_method, path) =>
      /^\/api\/v1\/links\/[^/]+\/stats$/.test(path)
        ? Response.json({ error: { code: "rate_limited" } }, { status: 429 })
        : undefined,
  });
  await page.goto("/history");

  await page.fill(page.getByLabel("Krótki link albo kod"), "somelink");
  await page.fill(page.getByLabel("Klucz do zarządzania"), "some-key");
  const submit = page.getByRole("button", { name: "Dodaj link" });
  await page.click(submit);

  await page
    .expect(page.getByRole("alert"))
    .toHaveText("Za dużo żądań. Spróbuj ponownie za minutę.");
  await page.expect(submit).toBeFocused();
});

test("a wrong key shows an error and saves nothing", async () => {
  const page = await openPage();
  const link = await page.createViaApi();
  await page.goto("/history");

  const key = page.getByLabel("Klucz do zarządzania");
  await page.fill(page.getByLabel("Krótki link albo kod"), link.id);
  await page.fill(key, "wrong-key");
  await page.click(page.getByRole("button", { name: "Dodaj link" }));

  await page.expect(page.getByRole("alert")).toHaveText("Ten klucz nie pasuje do linku.");
  await page.expect(key).toHaveAttribute("aria-invalid", "true");
  await page.expect(page.locator("#history-list > li")).toHaveCount(0);
  expect((await page.storage(HISTORY_KEY)) ?? []).toEqual([]);
});

test("an unknown link shows an error on the link field", async () => {
  const page = await openPage();
  // A malformed key is rejected before the link is looked up, so this one has the real format.
  const { secretKey } = await page.createViaApi();
  await page.goto("/history");

  const code = page.getByLabel("Krótki link albo kod");
  await page.fill(code, "nosuchlink-e2e");
  await page.fill(page.getByLabel("Klucz do zarządzania"), secretKey);
  await page.click(page.getByRole("button", { name: "Dodaj link" }));

  await page.expect(page.getByRole("alert")).toHaveText("Nie ma takiego linku albo już wygasł.");
  await page.expect(code).toHaveAttribute("aria-invalid", "true");
});
