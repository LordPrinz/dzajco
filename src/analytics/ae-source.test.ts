import { describe, expect, it } from "bun:test";
import fc from "fast-check";
import {
  AeVisitSource,
  buildDayQuery,
  buildSinceQuery,
  createVisitSource,
  type Fetcher,
} from "./ae-source.ts";
import { LocalVisitSource } from "./local-source.ts";

const ACCOUNT = "0123456789abcdef0123456789abcdef";

describe("buildDayQuery", () => {
  it("sums _sample_interval and pages in the documented order", () => {
    const sql = buildDayQuery("2026-11-13", 500, 500);
    expect(sql).toContain("SUM(_sample_interval)");
    expect(sql).toContain(
      "sumIf(double1 * _sample_interval, (double1 != 0 OR double2 != 0)) / sumIf(_sample_interval, (double1 != 0 OR double2 != 0)) AS lat",
    );
    expect(sql).toContain("FROM dzajco_visits");
    expect(sql).toContain("GROUP BY linkId, country, city, createdAt");
    expect(sql).toContain("ORDER BY linkId, country, city, createdAt");
    expect(sql).toContain("LIMIT 500 OFFSET 500");
    expect(sql).toContain("timestamp >= toDateTime('2026-11-13 00:00:00')");
    expect(sql).toContain("timestamp < toDateTime('2026-11-14 00:00:00')");
  });

  it("rolls over month and year ends", () => {
    expect(buildDayQuery("2026-12-31", 0, 1)).toContain("toDateTime('2027-01-01 00:00:00')");
    expect(buildDayQuery("2028-02-28", 0, 1)).toContain("toDateTime('2028-02-29 00:00:00')");
  });

  it.each([
    "2026-02-30",
    "2026-13-01",
    "2026-1-01",
    "26-11-13",
    "2026-11-13 ",
    "2026-11-13') OR 1=1 --",
    "",
  ])("rejects the day %p", (day) => {
    expect(() => buildDayQuery(day, 0, 500)).toThrow();
  });

  it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, 2 ** 53])(
    "rejects the offset %p",
    (offset) => {
      expect(() => buildDayQuery("2026-11-13", offset, 500)).toThrow();
    },
  );

  it.each([0, -1, 1.5, 10_001, Number.NaN])("rejects the limit %p", (limit) => {
    expect(() => buildDayQuery("2026-11-13", 0, limit)).toThrow();
  });

  it("rejects non-number values passed through any", () => {
    expect(() => buildDayQuery("2026-11-13", "0; DROP" as unknown as number, 500)).toThrow();
    expect(() => buildDayQuery(42 as unknown as string, 0, 500)).toThrow();
  });

  it("only ever emits digits and dashes from its inputs", () => {
    fc.assert(
      fc.property(fc.string(), fc.anything(), fc.anything(), (day, offset, limit) => {
        try {
          const sql = buildDayQuery(day, offset as number, limit as number);
          expect(day).toMatch(/^\d{4}-\d{2}-\d{2}$/);
          expect(sql).not.toContain(";");
        } catch {
          // rejected input is fine
        }
      }),
    );
  });
});

describe("buildSinceQuery", () => {
  it("has no upper time bound", () => {
    const sql = buildSinceQuery("2026-11-14", 0, 10_000);
    expect(sql).toContain("timestamp >= toDateTime('2026-11-14 00:00:00')");
    expect(sql).not.toContain("timestamp <");
    expect(sql).toContain("SUM(_sample_interval)");
    expect(sql).toContain("LIMIT 10000 OFFSET 0");
  });
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("AeVisitSource", () => {
  it("posts the SQL with the bearer token and parses rows", async () => {
    const calls: { url: string; init: RequestInit | undefined }[] = [];
    const fetcher = (async (input: string, init: RequestInit) => {
      calls.push({ url: String(input), init });
      return jsonResponse({
        data: [
          {
            linkId: "abc",
            createdAt: "1700",
            country: "PL",
            city: "Warsaw",
            visits: "3",
            lat: 52.23,
            lon: 21.01,
          },
          { linkId: "abc", country: "DE", city: "", visits: 2, lat: null, lon: "nan" },
        ],
      });
    }) as Fetcher;
    const source = new AeVisitSource({ accountId: ACCOUNT, token: "tok", fetch: fetcher });

    const rows = await source.queryDay("2026-11-13", 0, 500);

    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe(
      `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/analytics_engine/sql`,
    );
    expect(calls[0]?.init?.method).toBe("POST");
    expect(new Headers(calls[0]?.init?.headers as Bun.HeadersInit).get("authorization")).toBe(
      "Bearer tok",
    );
    expect(calls[0]?.init?.body).toBe(buildDayQuery("2026-11-13", 0, 500));
    expect(rows).toEqual([
      {
        linkId: "abc",
        createdAt: 1700,
        country: "PL",
        city: "Warsaw",
        visits: 3,
        lat: 52.23,
        lon: 21.01,
      },
      { linkId: "abc", createdAt: null, country: "DE", city: "", visits: 2, lat: null, lon: null },
    ]);
  });

  it("throws on an HTTP error without leaking the token", async () => {
    const fetcher = (async () => new Response("rate limited", { status: 429 })) as Fetcher;
    const source = new AeVisitSource({ accountId: ACCOUNT, token: "secret-tok", fetch: fetcher });
    const error = await source.queryDay("2026-11-13", 0, 500).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(Error);
    expect(String((error as Error).message)).toContain("429");
    expect(String((error as Error).message)).not.toContain("secret-tok");
  });

  it("puts the start of the error body in the message", async () => {
    const body = `Input was invalid:\n unable to find type of column: "index1" ${"x".repeat(400)}`;
    const fetcher = (async () => new Response(body, { status: 422 })) as Fetcher;
    const source = new AeVisitSource({ accountId: ACCOUNT, token: "secret-tok", fetch: fetcher });
    const error = (await source.queryDay("2026-11-13", 0, 500).catch((e: unknown) => e)) as Error;
    expect(error.message).toContain(
      '422: Input was invalid: unable to find type of column: "index1"',
    );
    expect(error.message.length).toBeLessThan(260);
  });

  it("throws on a malformed body", async () => {
    const fetcher = (async () => jsonResponse({ data: [{ linkId: 5 }] })) as Fetcher;
    const source = new AeVisitSource({ accountId: ACCOUNT, token: "t", fetch: fetcher });
    await expect(source.queryDay("2026-11-13", 0, 500)).rejects.toThrow();
  });

  it("querySince pages until a short page", async () => {
    const bodies: string[] = [];
    const fetcher = (async (_input: string, init: RequestInit) => {
      bodies.push(String(init?.body));
      const n = bodies.length === 1 ? 2 : 1;
      return jsonResponse({
        data: Array.from({ length: n }, (_, i) => ({
          linkId: `l${bodies.length}-${i}`,
          country: "PL",
          city: "",
          visits: 1,
          lat: null,
          lon: null,
        })),
      });
    }) as Fetcher;
    const source = new AeVisitSource({
      accountId: ACCOUNT,
      token: "t",
      fetch: fetcher,
      sincePageSize: 2,
    });
    const rows = await source.querySince("2026-11-14");
    expect(rows).toHaveLength(3);
    expect(bodies).toEqual([
      buildSinceQuery("2026-11-14", 0, 2),
      buildSinceQuery("2026-11-14", 2, 2),
    ]);
  });

  it("rejects an account id that is not 32 hex characters", () => {
    expect(() => new AeVisitSource({ accountId: "../x", token: "t" })).toThrow();
  });
});

describe("AeVisitSource timeout", () => {
  it("aborts a request the SQL API never answers", async () => {
    const fetcher = ((_url: string, init: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => reject(init.signal?.reason));
      })) as Fetcher;
    const source = new AeVisitSource({
      accountId: ACCOUNT,
      token: "tok",
      fetch: fetcher,
      timeoutMs: 20,
    });

    await expect(source.queryDay("2026-11-13", 0, 500)).rejects.toThrow();
  });
});

describe("AeVisitSource row mapping", () => {
  async function mapOne(raw: Record<string, unknown>) {
    const fetcher = (async () =>
      jsonResponse({
        data: [{ linkId: "a", country: "PL", city: "Warsaw", visits: 1, ...raw }],
      })) as Fetcher;
    const source = new AeVisitSource({ accountId: ACCOUNT, token: "t", fetch: fetcher });
    return (await source.queryDay("2026-11-13", 0, 500))[0];
  }

  it("reads blob3 as the link's created_at and anything but a safe integer string as null", async () => {
    expect(await mapOne({ createdAt: "1700000000000" })).toMatchObject({
      createdAt: 1700000000000,
    });
    for (const bad of ["", "abc", "-5", "1.5", "99999999999999999", 1700, null]) {
      expect(await mapOne({ createdAt: bad })).toMatchObject({ createdAt: null });
    }
  });

  it("reads 0, 0 (no doubles written) as no coordinates", async () => {
    expect(await mapOne({ lat: 0, lon: 0 })).toMatchObject({ lat: null, lon: null });
  });

  it("keeps a real coordinate that is 0 on one axis only", async () => {
    expect(await mapOne({ lat: 0, lon: 21.5 })).toMatchObject({ lat: 0, lon: 21.5 });
  });

  it("drops both coordinates when one is missing or NaN", async () => {
    expect(await mapOne({ lat: 52.2, lon: null })).toMatchObject({ lat: null, lon: null });
    expect(await mapOne({ lat: "nan", lon: 21 })).toMatchObject({ lat: null, lon: null });
  });

  it("drops coordinates outside the valid range", async () => {
    expect(await mapOne({ lat: 90.5, lon: 10 })).toMatchObject({ lat: null, lon: null });
    expect(await mapOne({ lat: 10, lon: -180.1 })).toMatchObject({ lat: null, lon: null });
    expect(await mapOne({ lat: -90, lon: 180 })).toMatchObject({ lat: -90, lon: 180 });
  });

  it("maps anything but a two-character Cloudflare country code to ??", async () => {
    for (const country of ["pl", "POL", "P", "1T", "<b>", "T-"]) {
      expect(await mapOne({ country })).toMatchObject({ country: "??" });
    }
  });

  it("keeps Cloudflare's special codes T1 (Tor) and XX", async () => {
    expect(await mapOne({ country: "T1" })).toMatchObject({ country: "T1" });
    expect(await mapOne({ country: "XX" })).toMatchObject({ country: "XX" });
  });

  it("truncates a city to 100 characters", async () => {
    const city = (await mapOne({ city: "ż".repeat(150) }))?.city;
    expect(city).toBe("ż".repeat(100));
  });

  it("maps an empty country to ?? and keeps an empty city", async () => {
    expect(await mapOne({ country: "", city: "" })).toMatchObject({ country: "??", city: "" });
  });
});

describe("createVisitSource", () => {
  it("uses the local source without a token or account id", () => {
    expect(createVisitSource({ CF_ACCOUNT_ID: ACCOUNT, CF_AE_TOKEN: "" })).toBeInstanceOf(
      LocalVisitSource,
    );
    expect(createVisitSource({ CF_ACCOUNT_ID: "", CF_AE_TOKEN: "t" })).toBeInstanceOf(
      LocalVisitSource,
    );
  });

  it("uses the AE source with both", () => {
    expect(createVisitSource({ CF_ACCOUNT_ID: ACCOUNT, CF_AE_TOKEN: "t" })).toBeInstanceOf(
      AeVisitSource,
    );
  });
});

describe("LocalVisitSource", () => {
  it("returns nothing", async () => {
    const source = new LocalVisitSource();
    expect(await source.queryDay("2026-11-13", 0, 500)).toEqual([]);
    expect(await source.querySince("2026-11-13")).toEqual([]);
  });
});
