// Ports for visit recording and aggregation. Implementations: sink.ts and source.ts (Analytics
// Engine), a local source that returns nothing, and in-memory fakes in tests.

/** One visit, as written to the dataset: `indexes: [linkId]`, `blobs: [country, city]`, `doubles: [lat, lon]`. */
export interface VisitPoint {
  linkId: string;
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
 * One aggregated group: `SUM(_sample_interval)` grouped by link, country and city. `lat` and `lon`
 * come from an aggregate over the group's doubles (for example `any(double1)`), or are null when
 * the source has none.
 */
export interface VisitRow {
  linkId: string;
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
  /** Groups of one UTC day ordered by `index1, blob1, blob2`, from `offset`, at most `limit` rows. */
  queryDay(day: string, offset: number, limit: number): Promise<VisitRow[]>;
  /**
   * Groups of everything with `timestamp >= day 00:00 UTC`, same grouping and order. Returns all
   * groups: the implementation pages internally, the caller passes no limit.
   */
  querySince(day: string): Promise<VisitRow[]>;
}
