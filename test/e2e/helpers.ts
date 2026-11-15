import { expect } from "bun:test";

/**
 * Helpers for the end-to-end tests: a `Bun.WebView` per test behind a small local proxy.
 *
 * The proxy does what the WebView API has no switch for: it gives every test its own client address
 * (`cf-connecting-ip`, the rate limit key), sends the test's `Accept-Language`, can forbid scripts with a
 * CSP header (the no-JavaScript tests), and records every request with its status. Each test also gets its
 * own origin (a fresh port), so localStorage never leaks between tests, even on Chrome where all views share
 * one profile.
 */

export const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:8787";
export const HISTORY_KEY = "links-history";
/** How long an assertion keeps retrying before it fails. */
const EXPECT_TIMEOUT = 10_000;

const useChrome = process.platform !== "darwin" || process.env.E2E_BROWSER === "chrome";
export const backend: Bun.WebView.Backend = useChrome ? { type: "chrome", url: false } : "webkit";

export interface CreatedLink {
  id: string;
  shortUrl: string;
  secretKey: string;
  url: string;
  expiresAt: string | null;
}

/** A target nobody fetches: the tests only look at the `Location` header or the page, never follow it. */
export function uniqueTarget(): string {
  return `https://example.com/e2e-${crypto.randomUUID()}`;
}

// Addresses from the documentation ranges (RFC 5737 TEST-NET-2 and TEST-NET-3), one per test, so rate limits stay per test.
function randomIp(): string {
  const net = Math.random() < 0.5 ? "198.51.100" : "203.0.113";
  return `${net}.${1 + Math.floor(Math.random() * 253)}`;
}

/** One entry of the v2 `links-history` shape (`git show main:src/types/localStorage.ts`). */
export function v2Entry(
  link: { id: string; url: string; secretKey?: string },
  overrides: { expire?: string; createdAt?: string } = {},
) {
  return {
    id: link.id,
    url: link.url,
    expire: overrides.expire ?? "never",
    createdAt: overrides.createdAt ?? new Date().toISOString(),
    ...(link.secretKey === undefined ? {} : { secretKey: link.secretKey }),
  };
}

// ---------------------------------------------------------------------------------------------------------
// Locators: a serialisable description of how to find elements, resolved inside the page.

type Name = string | { source: string; flags: string };
type Step =
  | { kind: "css"; selector: string }
  | { kind: "role"; role: string; name?: Name }
  | { kind: "label"; text: string }
  | { kind: "text"; text: string }
  | { kind: "hasText"; text: string }
  | { kind: "first" };

function toName(name: string | RegExp | undefined): Name | undefined {
  return name instanceof RegExp ? { source: name.source, flags: name.flags } : name;
}

export class Locator {
  constructor(readonly steps: Step[]) {}
  locator(selector: string): Locator {
    return new Locator([...this.steps, { kind: "css", selector }]);
  }
  getByRole(role: string, options: { name?: string | RegExp } = {}): Locator {
    return new Locator([...this.steps, { kind: "role", role, name: toName(options.name) }]);
  }
  getByText(text: string): Locator {
    return new Locator([...this.steps, { kind: "text", text }]);
  }
  filter(options: { hasText: string }): Locator {
    return new Locator([...this.steps, { kind: "hasText", text: options.hasText }]);
  }
  first(): Locator {
    return new Locator([...this.steps, { kind: "first" }]);
  }
}

/**
 * Runs inside the page (serialised with `toString`), so it must not use anything from this module.
 * Name and text matching follow Playwright's defaults: case-insensitive substring after collapsing whitespace.
 */
function pageQuery(steps: Step[]): Element[] {
  const norm = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim();
  const matches = (value: string, name: Name) =>
    typeof name === "string"
      ? value.toLowerCase().includes(norm(name).toLowerCase())
      : new RegExp(name.source, name.flags).test(value);
  const byIds = (ids: string | null) =>
    norm(
      (ids ?? "")
        .split(/\s+/)
        .map((id) => document.getElementById(id)?.textContent ?? "")
        .join(" "),
    );
  const labelOf = (el: Element) => {
    if (el.getAttribute("aria-labelledby")) return byIds(el.getAttribute("aria-labelledby"));
    if (el.getAttribute("aria-label")) return norm(el.getAttribute("aria-label"));
    const labels = (el as HTMLInputElement).labels;
    if (labels && labels.length > 0) return norm([...labels].map((l) => l.textContent).join(" "));
    return null;
  };
  const roleSelectors: Record<string, string> = {
    button: "button, input[type=submit], input[type=button], [role=button]",
    link: "a[href], [role=link]",
    heading: "h1, h2, h3, h4, h5, h6, [role=heading]",
    listitem: "li, [role=listitem]",
  };
  let roots: Element[] = [document.documentElement];
  for (const step of steps) {
    const next: Element[] = [];
    const add = (el: Element) => {
      if (!next.includes(el)) next.push(el);
    };
    for (const root of roots) {
      const all = (selector: string) => {
        const found = [...root.querySelectorAll(selector)];
        if (root.matches(selector)) found.unshift(root);
        return found;
      };
      if (step.kind === "css") all(step.selector).forEach(add);
      else if (step.kind === "role") {
        const selector = roleSelectors[step.role];
        if (!selector) throw new Error(`unknown role ${step.role}`);
        for (const el of all(selector)) {
          const name =
            labelOf(el) ?? norm(el instanceof HTMLInputElement ? el.value : (el.textContent ?? ""));
          if (step.name === undefined || matches(name, step.name)) add(el);
        }
      } else if (step.kind === "label") {
        for (const el of all("input, textarea, select, button")) {
          const label = labelOf(el);
          if (label !== null && matches(label, step.text)) add(el);
        }
      } else if (step.kind === "text") {
        // The innermost elements whose text contains the string; nothing in <head> (the <title> is not on the page).
        for (const el of all("*")) {
          if (el.closest("head, script, style, noscript")) continue;
          if (!matches(norm(el.textContent), step.text)) continue;
          const child = [...el.children].some((c) => matches(norm(c.textContent), step.text));
          if (!child) add(el);
        }
      } else if (step.kind === "hasText") {
        if (matches(norm(root.textContent), step.text)) add(root);
      } else if (step.kind === "first") {
        if (next.length === 0) add(root);
      }
    }
    roots = next;
  }
  return roots;
}

/** Runs inside the page: one check of one expectation, with the value it saw for the failure message. */
function pageCheck(
  steps: Step[],
  check: { kind: string; arg?: unknown; name?: string },
): { pass: boolean; actual: unknown } {
  const els = pageQuery(steps);
  // Like Playwright's strict mode: only a count may look at several elements; use `first()` to pick one.
  if (els.length > 1 && check.kind !== "count") {
    return { pass: false, actual: `${els.length} elements match, expected one` };
  }
  const el = els[0] as HTMLElement | undefined;
  const norm = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim();
  const visible = (e: Element | undefined) => {
    if (!e?.isConnected) return false;
    const rect = e.getBoundingClientRect();
    return (
      rect.width > 0 &&
      rect.height > 0 &&
      e.checkVisibility({ visibilityProperty: true, opacityProperty: false })
    );
  };
  const text = (pattern: unknown, value: string, contains: boolean) => {
    if (typeof pattern === "string") return contains ? value.includes(pattern) : value === pattern;
    const re = pattern as { source: string; flags: string };
    return new RegExp(re.source, re.flags).test(value);
  };
  switch (check.kind) {
    case "visible":
      return { pass: visible(el), actual: el ? "not visible" : "no element" };
    case "hidden":
      return { pass: !visible(el), actual: "visible" };
    case "attached":
      return { pass: els.length > 0, actual: "no element" };
    case "count":
      return { pass: els.length === check.arg, actual: els.length };
    case "text":
    case "containText": {
      const value = norm(el?.textContent);
      return { pass: !!el && text(check.arg, value, check.kind === "containText"), actual: value };
    }
    case "attribute": {
      const value = el?.getAttribute(check.name ?? "") ?? null;
      const pass = value !== null && (check.arg === undefined || text(check.arg, value, false));
      return { pass, actual: value };
    }
    case "noAttribute": {
      const value = el?.getAttribute(check.name ?? "") ?? null;
      return { pass: !!el && value !== check.arg, actual: value };
    }
    case "class":
      return { pass: !!el && text(check.arg, el.className, false), actual: el?.className };
    case "value": {
      const value = (el as HTMLInputElement | undefined)?.value;
      return { pass: value === check.arg, actual: value };
    }
    case "focused":
      return {
        pass: !!el && document.activeElement === el,
        actual: document.activeElement?.outerHTML.slice(0, 120),
      };
    case "notEmpty":
      return { pass: !!el && norm(el.textContent) !== "", actual: el?.textContent };
    case "description": {
      const ids = el?.getAttribute("aria-describedby") ?? "";
      const value = norm(
        ids
          .split(/\s+/)
          .map((id) => document.getElementById(id)?.textContent ?? "")
          .join(" "),
      );
      return { pass: value === check.arg, actual: value };
    }
    case "inViewport": {
      const rect = el?.getBoundingClientRect();
      const pass =
        !!rect &&
        rect.width > 0 &&
        rect.height > 0 &&
        rect.bottom > 0 &&
        rect.right > 0 &&
        rect.top < innerHeight &&
        rect.left < innerWidth;
      return { pass, actual: rect ? JSON.stringify(rect) : "no element" };
    }
    default:
      throw new Error(`unknown check ${check.kind}`);
  }
}

/** Runs inside the page: tags the only match so `Bun.WebView` can address it by a CSS selector. */
function pageMark(steps: Step[], id: string): string {
  const els = pageQuery(steps);
  if (els.length !== 1) return els.length === 0 ? "no element" : `${els.length} elements match`;
  els[0]?.setAttribute("data-e2e-pick", id);
  return "ok";
}

const PAGE_LIB = `${pageQuery.toString()};${pageCheck.toString()};${pageMark.toString()}`;

// ---------------------------------------------------------------------------------------------------------
// The page under test.

interface Logged {
  method: string;
  path: string;
  status: number;
}

export interface PageOptions {
  /** Block every script with a CSP header, like a browser with JavaScript turned off. */
  javaScript?: boolean;
  /** Sent as `Accept-Language`. Polish by default; most tests check the Polish pages. */
  locale?: string;
}

export class Page {
  readonly view: Bun.WebView;
  readonly origin: string;
  /** Every request the page (or `request`) made, in order, with the status the server answered. */
  readonly requests: Logged[] = [];
  private readonly server: ReturnType<typeof Bun.serve>;
  private picks = 0;
  private closed = false;

  constructor(options: PageOptions = {}) {
    const ip = randomIp();
    const requests = this.requests;
    const base = new URL(BASE_URL);
    this.server = Bun.serve({
      port: 0,
      hostname: "localhost",
      async fetch(request) {
        const url = new URL(request.url);
        const headers = new Headers(request.headers);
        headers.delete("host");
        headers.delete("accept-encoding");
        headers.set("cf-connecting-ip", ip);
        headers.set("accept-language", options.locale ?? "pl-PL");
        const hasBody = request.method !== "GET" && request.method !== "HEAD";
        const upstream = await fetch(new URL(url.pathname + url.search, base), {
          method: request.method,
          headers,
          body: hasBody ? await request.arrayBuffer() : undefined,
          redirect: "manual",
        });
        requests.push({
          method: request.method,
          path: url.pathname + url.search,
          status: upstream.status,
        });
        const out = new Headers(upstream.headers);
        // fetch already decompressed the body.
        out.delete("content-encoding");
        out.delete("content-length");
        const location = out.get("location");
        if (location?.startsWith(base.origin)) {
          out.set("location", url.origin + location.slice(base.origin.length));
        }
        // A second CSP header is enforced on top of the page's own one.
        if (options.javaScript === false)
          out.append("content-security-policy", "script-src 'none'");
        return new Response(upstream.body, { status: upstream.status, headers: out });
      },
    });
    this.origin = `http://localhost:${this.server.port}`;
    try {
      this.view = new Bun.WebView({ backend, width: 1280, height: 800 });
    } catch (error) {
      this.server.stop(true);
      throw error;
    }
  }

  /**
   * Each WebKit view has its own ephemeral cookie jar and storage. Chrome keeps one profile for every view,
   * cookies ignore the port, and the OS can hand out a port again, so clear both before each test there.
   */
  async init(): Promise<void> {
    if (!useChrome) return;
    await this.view.navigate("about:blank");
    await this.view.cdp("Network.clearBrowserCookies");
    await this.view.cdp("Storage.clearDataForOrigin", { origin: this.origin, storageTypes: "all" });
  }

  close(): void {
    this.closed = true;
    try {
      this.view.close();
    } finally {
      this.server.stop(true);
    }
  }

  /** Navigates and returns the status the server answered for the document. */
  async goto(path: string): Promise<number | undefined> {
    const from = this.requests.length;
    await this.view.navigate(this.origin + path);
    return this.requests.slice(from).find((r) => r.method === "GET" && r.path === path)?.status;
  }

  /** A request from the test itself, with the same client address as the page. */
  request(path: string, init: RequestInit = {}): Promise<Response> {
    return fetch(this.origin + path, { redirect: "manual", ...init });
  }

  async createViaApi(body: { url?: string; expiresAt?: string | null } = {}): Promise<CreatedLink> {
    const response = await this.request("/api/v1/links", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: uniqueTarget(), ...body }),
    });
    expect(response.status).toBe(201);
    return (await response.json()) as CreatedLink;
  }

  /** Runs `fn` in the page with JSON arguments and returns its (awaited, JSON) result. */
  evaluate<T, A extends unknown[]>(fn: (...args: A) => T, ...args: A): Promise<Awaited<T>> {
    return this.view.evaluate(`(${fn.toString()})(...${JSON.stringify(args)})`);
  }

  /** Puts `name` = `value` in the page's localStorage (the page has to be on the app's origin). */
  async seedStorage(name: string, value: unknown): Promise<void> {
    await this.evaluate((n, v) => localStorage.setItem(n, v), name, JSON.stringify(value));
  }

  async storage(name: string): Promise<unknown> {
    return JSON.parse((await this.evaluate((n) => localStorage.getItem(n), name)) ?? "null");
  }

  locator(selector: string): Locator {
    return new Locator([{ kind: "css", selector }]);
  }
  getByRole(role: string, options: { name?: string | RegExp } = {}): Locator {
    return new Locator([{ kind: "role", role, name: toName(options.name) }]);
  }
  getByLabel(text: string): Locator {
    return new Locator([{ kind: "label", text }]);
  }
  getByText(text: string): Locator {
    return new Locator([{ kind: "text", text }]);
  }

  /** Waits for the element, scrolls it into view if needed and clicks it with a real mouse event. */
  async click(target: Locator): Promise<void> {
    await this.act(target, "click", async (selector, timeout) => {
      await this.view.scrollTo(selector, { block: "nearest", timeout });
      await this.view.click(selector, { timeout });
    });
  }

  /** Replaces the field's value by typing, which fires real `input` events. */
  async fill(target: Locator, value: string): Promise<void> {
    await this.click(target);
    await this.evaluate(() => (document.activeElement as HTMLInputElement).select());
    await this.view.type(value);
  }

  async focus(target: Locator): Promise<void> {
    await this.act(target, "focus", (selector) =>
      this.evaluate((s) => {
        const el = document.querySelector<HTMLElement>(s);
        if (!el) throw new Error("detached");
        el.focus();
      }, selector),
    );
  }

  async textContent(target: Locator): Promise<string | null> {
    return this.act(target, "read text", (selector) =>
      this.evaluate((s) => {
        const el = document.querySelector(s);
        if (!el) throw new Error("detached");
        return el.textContent;
      }, selector),
    );
  }

  async getAttribute(target: Locator, name: string): Promise<string | null> {
    return this.act(target, `read ${name}`, (selector) =>
      this.evaluate(
        (s, n) => {
          const el = document.querySelector(s);
          if (!el) throw new Error("detached");
          return el.getAttribute(n);
        },
        selector,
        name,
      ),
    );
  }

  /** Polls `fn` in the page until it returns a truthy value. */
  async waitFor<A extends unknown[]>(
    what: string,
    fn: (...args: A) => unknown,
    ...args: A
  ): Promise<void> {
    await this.poll(what, async () => ({
      pass: !!(await this.evaluate(fn, ...args)),
      actual: "falsy",
    }));
  }

  async waitForUrl(pattern: RegExp): Promise<void> {
    await this.poll(`URL matching ${pattern}`, async () => ({
      pass: pattern.test(this.view.url) && !this.view.loading,
      actual: this.view.url,
    }));
  }

  /** Playwright-style web-first assertions: each one retries until it passes or times out. */
  expect(target: Locator) {
    const run = (kind: string, arg?: unknown, name?: string) => {
      const value = arg instanceof RegExp ? { source: arg.source, flags: arg.flags } : arg;
      const check = { kind, arg: value, name };
      return this.poll(
        `${describe(target)} ${kind}${arg === undefined ? "" : ` ${String(arg)}`}`,
        () =>
          this.view.evaluate<{ pass: boolean; actual: unknown }>(
            `(() => { ${PAGE_LIB}; return pageCheck(${JSON.stringify(target.steps)}, ${JSON.stringify(check)}); })()`,
          ),
      );
    };
    return {
      toBeVisible: () => run("visible"),
      toBeHidden: () => run("hidden"),
      toBeAttached: () => run("attached"),
      toHaveCount: (n: number) => run("count", n),
      toHaveText: (text: string | RegExp) => run("text", text),
      toContainText: (text: string) => run("containText", text),
      toHaveAttribute: (name: string, value?: string | RegExp) => run("attribute", value, name),
      notToHaveAttribute: (name: string, value: string) => run("noAttribute", value, name),
      toHaveClass: (pattern: RegExp) => run("class", pattern),
      toHaveValue: (value: string) => run("value", value),
      toBeFocused: () => run("focused"),
      notToBeEmpty: () => run("notEmpty"),
      toHaveAccessibleDescription: (text: string) => run("description", text),
      toBeInViewport: () => run("inViewport"),
    };
  }

  /**
   * Finds the one element the locator matches, tags it and runs `action` on its selector. When the action
   * fails (the node was replaced or detached in between), it finds the element again, until the deadline.
   */
  private async act<T>(
    target: Locator,
    what: string,
    action: (selector: string, timeout: number) => Promise<T>,
  ): Promise<T> {
    const deadline = Date.now() + EXPECT_TIMEOUT;
    let result: T | undefined;
    await this.poll(
      `${what} on ${describe(target)}`,
      async () => {
        const id = String(++this.picks);
        const found = await this.view.evaluate<string>(
          `(() => { ${PAGE_LIB}; return pageMark(${JSON.stringify(target.steps)}, ${JSON.stringify(id)}); })()`,
        );
        if (found !== "ok") return { pass: false, actual: found };
        result = await action(`[data-e2e-pick="${id}"]`, Math.max(deadline - Date.now(), 100));
        return { pass: true, actual: "" };
      },
      deadline,
    );
    return result as T;
  }

  /**
   * Retries `check` until it passes or `deadline`. Errors count as a miss: the page may be in the middle of
   * a navigation. Stops at once when the page is closed, so nothing keeps running after the test.
   */
  private async poll(
    what: string,
    check: () => Promise<{ pass: boolean; actual: unknown }>,
    deadline = Date.now() + EXPECT_TIMEOUT,
  ): Promise<void> {
    let last: unknown = "never ran";
    while (true) {
      if (this.closed) throw new Error(`Page closed while waiting for ${what}`);
      try {
        const result = await check();
        if (result.pass) return;
        last = result.actual;
      } catch (error) {
        last = error;
      }
      if (Date.now() > deadline) {
        throw new Error(`Timed out waiting for ${what}; last saw: ${String(last)}`);
      }
      await Bun.sleep(50);
    }
  }
}

function describe(target: Locator): string {
  return target.steps.map((s) => JSON.stringify(s)).join(" > ");
}

/** Opens a page for one test; `afterEach(closePages)` closes it. */
const open: Page[] = [];
export async function openPage(options: PageOptions = {}): Promise<Page> {
  const page = new Page(options);
  open.push(page);
  await page.init();
  return page;
}

/** Closes every open page, even when closing one of them throws. */
export function closePages(): void {
  const errors: unknown[] = [];
  for (const page of open.splice(0)) {
    try {
      page.close();
    } catch (error) {
      errors.push(error);
    }
  }
  if (errors.length > 0) throw new AggregateError(errors, "closing the pages failed");
}

/** Starts the browser once before the first test, so that test does not pay for the launch. */
export async function warmUp(): Promise<void> {
  const view = new Bun.WebView({ backend });
  try {
    await view.navigate("about:blank");
  } finally {
    view.close();
  }
}
