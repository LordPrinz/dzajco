import { expect, it, vi } from "vitest";
import { FRESH_ROWS_WARN_THRESHOLD, loadFresh } from "../../src/analytics/fresh";
import type { VisitRow, VisitSource } from "../../src/analytics/ports";

const NOW = Date.parse("2026-11-14T01:00:00Z");

function sourceOf(count: number): VisitSource {
  const rows: VisitRow[] = Array.from({ length: count }, (_, i) => ({
    linkId: `l${i}`,
    country: "PL",
    city: "",
    visits: 1,
    lat: null,
    lon: null,
  }));
  return { queryDay: async () => [], querySince: async () => rows };
}

async function warnings(count: number, cacheName: string): Promise<unknown[][]> {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  try {
    await loadFresh({
      source: sourceOf(count),
      cursor: null,
      now: NOW,
      ttlSeconds: 300,
      cache: await caches.open(cacheName),
    });
    return warn.mock.calls;
  } finally {
    warn.mockRestore();
  }
}

it("warns once with the row count above the threshold", async () => {
  const calls = await warnings(FRESH_ROWS_WARN_THRESHOLD + 1, "fresh-warn-over");
  expect(calls).toHaveLength(1);
  expect(String(calls[0]?.[0])).toContain(String(FRESH_ROWS_WARN_THRESHOLD + 1));
});

it("stays quiet at the threshold", async () => {
  expect(await warnings(FRESH_ROWS_WARN_THRESHOLD, "fresh-warn-at")).toHaveLength(0);
});
