import { type APIRequestContext, test as base, expect } from "@playwright/test";

export const HISTORY_KEY = "links-history";

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

/**
 * Every test gets its own client address (`cf-connecting-ip`, the rate limit key), so the per-IP create
 * limit of 10 per minute is never shared between tests or between consecutive local runs.
 */
export const test = base.extend({
  // Playwright insists on a destructuring pattern as the first argument.
  // biome-ignore lint/correctness/noEmptyPattern: required by Playwright fixtures
  extraHTTPHeaders: async ({}, use) => {
    await use({ "cf-connecting-ip": randomIp() });
  },
});

export { expect };

export async function createViaApi(
  request: APIRequestContext,
  body: { url?: string; expiresAt?: string | null } = {},
): Promise<CreatedLink> {
  const response = await request.post("/api/v1/links", {
    data: { url: uniqueTarget(), ...body },
  });
  expect(response.status()).toBe(201);
  return (await response.json()) as CreatedLink;
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
