// Ports for visit recording and aggregation. Implementations: the Analytics Engine sink, the SQL
// API source (ae-source.ts, used by cron/rollup.ts and fresh.ts), a local source that returns
// nothing, and in-memory fakes in tests.

/**
 * One visit, as written to the dataset: `indexes: [linkId]`, `blobs: [country, city, createdAt]`,
 * `doubles: [lat, lon]`. `createdAt` is the link's `created_at` (ms), so a re-created id is a new link.
 */
export interface VisitPoint {
  linkId: string;
  createdAt: number;
  country: string;
  city: string;
  lat: number | null;
  lon: number | null;
}

export interface VisitSink {
  /** Records one visit. Must never throw: a failing sink cannot change the redirect response. */
  write(point: VisitPoint): void | Promise<void>;
}

/**
 * One aggregated group: `SUM(_sample_interval)` grouped by link, `createdAt`, country and city. `createdAt`
 * is null for a point without a valid one, which matches no link. `lat` and `lon` are the
 * sample-weighted mean of the group's doubles, or null when the source has none.
 */
export interface VisitRow {
  linkId: string;
  createdAt: number | null;
  country: string;
  city: string;
  visits: number;
  lat: number | null;
  lon: number | null;
}

/** Rollup position. `day` is a UTC date (`YYYY-MM-DD`), `offset` counts groups already rolled up that day. */
export interface RollupCursor {
  day: string;
  offset: number;
}

export interface VisitSource {
  /** Groups of one UTC day ordered by `index1, blob1, blob2, blob3`, from `offset`, at most `limit` rows. */
  queryDay(day: string, offset: number, limit: number): Promise<VisitRow[]>;
  /**
   * Groups of everything with `timestamp >= day 00:00 UTC`, same grouping and order. Returns all
   * groups: the implementation pages internally, the caller passes no limit.
   */
  querySince(day: string): Promise<VisitRow[]>;
}
