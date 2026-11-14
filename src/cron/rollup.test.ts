import { describe, expect, it } from "bun:test";
import type { RollupCursor, VisitRow, VisitSource } from "../analytics/ports.ts";
import { PAGE_SIZE, parseMaxPages, type RollupStore, runRollup } from "./rollup.ts";

const D = "2026-11-13";
const CLOSED = Date.parse("2026-11-14T01:00:00Z");
const OPEN = Date.parse("2026-11-14T00:59:59Z");

function rows(n: number, prefix = "l"): VisitRow[] {
  return Array.from({ length: n }, (_, i) => ({
    linkId: `${prefix}${String(i).padStart(5, "0")}`,
    country: "PL",
    city: "",
    visits: 1,
    lat: null,
    lon: null,
  }));
}

/** Source with `groups` rows on day D and none on other days. */
function fakeSource(groups: number) {
  const calls: { day: string; offset: number; limit: number }[] = [];
  const source: VisitSource = {
    async queryDay(day, offset, limit) {
      calls.push({ day, offset, limit });
      return day === D ? rows(groups).slice(offset, offset + limit) : [];
    },
    async querySince() {
      throw new Error("not used by the rollup");
    },
  };
  return { source, calls };
}

function fakeStore(initial: RollupCursor | null, applied = true) {
  let cursor = initial;
  const pages: { rows: number; from: RollupCursor | null; to: RollupCursor }[] = [];
  const store: RollupStore = {
    async readCursor() {
      return cursor;
    },
    async applyPage(r, from, to) {
      pages.push({ rows: r.length, from, to });
      if (!applied) return false;
      cursor = to;
      return true;
    },
  };
  return { store, pages, cursor: () => cursor };
}

describe("runRollup", () => {
  it("does nothing before D+1 01:00 UTC", async () => {
    const { source, calls } = fakeSource(3);
    const { store, cursor } = fakeStore({ day: D, offset: 0 });
    const result = await runRollup({ store, source, now: OPEN, maxPages: 10 });
    expect(result.pages).toBe(0);
    expect(calls).toEqual([]);
    expect(cursor()).toEqual({ day: D, offset: 0 });
  });

  it("closes a day with a short page and stops at an open day", async () => {
    const { source, calls } = fakeSource(3);
    const { store, cursor, pages } = fakeStore({ day: D, offset: 0 });
    await runRollup({ store, source, now: CLOSED, maxPages: 10 });
    expect(calls).toEqual([{ day: D, offset: 0, limit: PAGE_SIZE }]);
    expect(pages).toEqual([
      { rows: 3, from: { day: D, offset: 0 }, to: { day: "2026-11-14", offset: 0 } },
    ]);
    expect(cursor()).toEqual({ day: "2026-11-14", offset: 0 });
  });

  it("handles at most maxPages pages: 12 pages need two runs", async () => {
    const { source } = fakeSource(11 * PAGE_SIZE + 7);
    const { store, cursor } = fakeStore({ day: D, offset: 0 });
    expect((await runRollup({ store, source, now: CLOSED, maxPages: 10 })).pages).toBe(10);
    expect(cursor()).toEqual({ day: D, offset: 5000 });
    expect((await runRollup({ store, source, now: CLOSED, maxPages: 10 })).pages).toBe(2);
    expect(cursor()).toEqual({ day: "2026-11-14", offset: 0 });
  });

  it("an exactly full last page is followed by an empty page that ends the day", async () => {
    const { source } = fakeSource(PAGE_SIZE);
    const { store, cursor } = fakeStore({ day: D, offset: 0 });
    expect((await runRollup({ store, source, now: CLOSED, maxPages: 10 })).pages).toBe(2);
    expect(cursor()).toEqual({ day: "2026-11-14", offset: 0 });
  });

  it("catches up over several closed days", async () => {
    const { source } = fakeSource(1);
    const { store, cursor } = fakeStore({ day: "2026-11-10", offset: 0 });
    await runRollup({ store, source, now: CLOSED, maxPages: 10 });
    expect(cursor()).toEqual({ day: "2026-11-14", offset: 0 });
  });

  it("starts from the previous day when there is no cursor", async () => {
    const { source, calls } = fakeSource(1);
    const { store, pages, cursor } = fakeStore(null);
    await runRollup({ store, source, now: CLOSED, maxPages: 10 });
    expect(calls[0]).toEqual({ day: D, offset: 0, limit: PAGE_SIZE });
    expect(pages[0]?.from).toBeNull();
    expect(cursor()).toEqual({ day: "2026-11-14", offset: 0 });
  });

  it("stops when a page was not applied (cursor moved elsewhere)", async () => {
    const { source, calls } = fakeSource(2 * PAGE_SIZE);
    const { store, pages } = fakeStore({ day: D, offset: 0 }, false);
    const result = await runRollup({ store, source, now: CLOSED, maxPages: 10 });
    expect(result.pages).toBe(0);
    expect(calls).toHaveLength(1);
    expect(pages).toHaveLength(1);
  });

  it("propagates a source error without writing", async () => {
    const { store, pages } = fakeStore({ day: D, offset: 0 });
    const source: VisitSource = {
      queryDay: () => Promise.reject(new Error("AE down")),
      querySince: () => Promise.resolve([]),
    };
    await expect(runRollup({ store, source, now: CLOSED, maxPages: 10 })).rejects.toThrow(
      "AE down",
    );
    expect(pages).toEqual([]);
  });
});

describe("parseMaxPages", () => {
  it("clamps to 1..20 and defaults to 10", () => {
    expect(parseMaxPages("10")).toBe(10);
    expect(parseMaxPages("20")).toBe(20);
    expect(parseMaxPages("50")).toBe(20);
    expect(parseMaxPages("0")).toBe(1);
    expect(parseMaxPages("-3")).toBe(1);
    expect(parseMaxPages(undefined)).toBe(10);
    expect(parseMaxPages("")).toBe(10);
    expect(parseMaxPages("abc")).toBe(10);
    expect(parseMaxPages("2.5")).toBe(10);
  });
});
