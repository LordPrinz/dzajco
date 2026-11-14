// In-memory stand-in for the Analytics Engine SQL API. It reads the time range, LIMIT and OFFSET
// out of the SQL that AeVisitSource sends and answers like `FORMAT JSON` would.

export interface FakePoint {
  linkId: string;
  country: string;
  city: string;
  lat?: number;
  lon?: number;
  /** Unix ms. */
  at: number;
  /** `_sample_interval`; 1 when unsampled. */
  sample?: number;
}

export class FakeAe {
  points: FakePoint[] = [];
  queries: string[] = [];
  failWith: number | null = null;

  readonly fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    const sql = String(init?.body);
    this.queries.push(sql);
    if (this.failWith !== null) return new Response("error", { status: this.failWith });
    return Response.json({ data: this.#run(sql) });
  }) as typeof fetch;

  /** Total visits of all points, counting the sample interval. */
  total(): number {
    return this.points.reduce((sum, p) => sum + (p.sample ?? 1), 0);
  }

  #run(sql: string) {
    if (!sql.includes("SUM(_sample_interval)")) throw new Error("query must sum _sample_interval");
    const weighted = "sumIf(double1 * _sample_interval, (double1 != 0 OR double2 != 0))";
    if (!sql.includes(weighted)) throw new Error("query must average only points with coordinates");
    const time = (op: string) => {
      const m = sql.match(
        new RegExp(`timestamp ${op} toDateTime\\('(\\d{4}-\\d{2}-\\d{2}) 00:00:00'\\)`),
      );
      return m ? Date.parse(`${m[1]}T00:00:00Z`) : null;
    };
    const from = time(">=");
    const to = time("<");
    const page = sql.match(/LIMIT (\d+) OFFSET (\d+)/);
    if (from === null || !page) throw new Error(`unexpected SQL: ${sql}`);
    const groups = new Map<
      string,
      {
        linkId: string;
        country: string;
        city: string;
        visits: number;
        latSum: number;
        lonSum: number;
        coordWeight: number;
      }
    >();
    for (const p of this.points) {
      if (p.at < from || (to !== null && p.at >= to)) continue;
      const key = JSON.stringify([p.linkId, p.country, p.city]);
      const g = groups.get(key) ?? {
        linkId: p.linkId,
        country: p.country,
        city: p.city,
        visits: 0,
        latSum: 0,
        lonSum: 0,
        coordWeight: 0,
      };
      g.visits += p.sample ?? 1;
      // Like the sink: missing coordinates are stored as no doubles and read back as 0.
      const lat = p.lat ?? 0;
      const lon = p.lon ?? 0;
      if (lat !== 0 || lon !== 0) {
        g.latSum += lat * (p.sample ?? 1);
        g.lonSum += lon * (p.sample ?? 1);
        g.coordWeight += p.sample ?? 1;
      }
      groups.set(key, g);
    }
    const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
    return [...groups.values()]
      .sort((a, b) => cmp(a.linkId, b.linkId) || cmp(a.country, b.country) || cmp(a.city, b.city))
      .slice(Number(page[2]), Number(page[2]) + Number(page[1]))
      .map((g) => ({
        linkId: g.linkId,
        country: g.country,
        city: g.city,
        // ClickHouse JSON output quotes 64-bit integers.
        visits: String(g.visits),
        // 0 / 0 is NaN, which JSON (like ClickHouse FORMAT JSON) writes as null.
        lat: g.latSum / g.coordWeight,
        lon: g.lonSum / g.coordWeight,
      }));
  }
}
