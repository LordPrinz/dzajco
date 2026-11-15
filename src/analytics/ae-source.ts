// VisitSource over the Analytics Engine SQL API. Every value that ends up in the SQL text is
// validated first (a real ISO date, safe integers); nothing else is interpolated.

import { dayStart, nextDay } from "./day";
import { LocalVisitSource } from "./local-source";
import type { VisitRow, VisitSource } from "./ports";

export const DEFAULT_DATASET = "dzajco_visits";
const DATASET_PATTERN = /^[a-z0-9_]{1,64}$/;
const MAX_LIMIT = 10_000;
/** The sink writes `doubles: []` without coordinates, which reads back as 0, 0. */
const HAS_COORDS = "(double1 != 0 OR double2 != 0)";
/** Anything but a two-character code like `PL`, `T1` (Tor) or `XX` is stored as `??` (the sink writes `''` when unknown). */
const UNKNOWN_COUNTRY = "??";
const SINCE_PAGE_SIZE = 10_000;
/** Fresh reads stop here and fail instead of returning a silently truncated result. */
export const MAX_FRESH_PAGES = 5;
const MAX_CITY_LENGTH = 100;

function checkInt(name: string, value: number, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < min || value > max) {
    throw new Error(`Invalid ${name}`);
  }
  return value;
}

/** The dataset name goes into the SQL text, so it is checked against a strict pattern first. */
function checkDataset(dataset: string): string {
  if (typeof dataset !== "string" || !DATASET_PATTERN.test(dataset)) {
    throw new Error("Invalid AE_DATASET");
  }
  return dataset;
}

function sqlTime(day: string): string {
  dayStart(day);
  return `toDateTime('${day} 00:00:00')`;
}

function buildQuery(where: string, offset: number, limit: number, dataset: string): string {
  checkInt("offset", offset, 0, Number.MAX_SAFE_INTEGER);
  checkInt("limit", limit, 1, MAX_LIMIT);
  checkDataset(dataset);
  // The SQL API runs in Etc/UTC, so toDateTime of a bare date-time is UTC midnight. Coordinates are
  // the sample-weighted mean over points that have them; with none the division gives NaN (-> null).
  // GROUP BY and ORDER BY use the aliases: Analytics Engine answers 422 ("unable to find type of
  // column") when an aliased column is named by its raw name there.
  const mean = (col: string) =>
    `sumIf(${col} * _sample_interval, ${HAS_COORDS}) / sumIf(_sample_interval, ${HAS_COORDS})`;
  return `SELECT index1 AS linkId, blob1 AS country, blob2 AS city, blob3 AS createdAt,
  SUM(_sample_interval) AS visits, ${mean("double1")} AS lat, ${mean("double2")} AS lon
FROM ${dataset}
WHERE ${where}
GROUP BY linkId, country, city, createdAt
ORDER BY linkId, country, city, createdAt
LIMIT ${limit} OFFSET ${offset}
FORMAT JSON`;
}

/** Groups of one UTC day, `[day 00:00, day+1 00:00)`. */
export function buildDayQuery(
  day: string,
  offset: number,
  limit: number,
  dataset: string = DEFAULT_DATASET,
): string {
  return buildQuery(
    `timestamp >= ${sqlTime(day)} AND timestamp < ${sqlTime(nextDay(day))}`,
    offset,
    limit,
    dataset,
  );
}

/** Groups of everything from `day 00:00` on. */
export function buildSinceQuery(
  day: string,
  offset: number,
  limit: number,
  dataset: string = DEFAULT_DATASET,
): string {
  return buildQuery(`timestamp >= ${sqlTime(day)}`, offset, limit, dataset);
}

function toCoord(value: unknown, limit: number): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && Math.abs(n) <= limit ? n : null;
}

/** The decimal string the sink wrote; anything else (older points, garbage) is null and matches no link. */
function toCreatedAt(value: unknown): number | null {
  if (typeof value !== "string" || !/^\d{1,16}$/.test(value)) return null;
  const n = Number(value);
  return Number.isSafeInteger(n) ? n : null;
}

function parseRows(body: unknown): VisitRow[] {
  const data = (body as { data?: unknown } | null)?.data;
  if (!Array.isArray(data)) throw new Error("Analytics Engine response has no data");
  return data.map((raw: Record<string, unknown>) => {
    const visits = Number(raw.visits);
    if (
      typeof raw.linkId !== "string" ||
      typeof raw.country !== "string" ||
      typeof raw.city !== "string" ||
      !Number.isSafeInteger(visits)
    ) {
      throw new Error("Analytics Engine row has an unexpected shape");
    }
    let lat = toCoord(raw.lat, 90);
    let lon = toCoord(raw.lon, 180);
    if (lat === null || lon === null || (lat === 0 && lon === 0)) {
      lat = null;
      lon = null;
    }
    return {
      linkId: raw.linkId,
      createdAt: toCreatedAt(raw.createdAt),
      country: /^[A-Z][A-Z0-9]$/.test(raw.country) ? raw.country : UNKNOWN_COUNTRY,
      city: [...raw.city].slice(0, MAX_CITY_LENGTH).join(""),
      visits,
      lat,
      lon,
    };
  });
}

const REQUEST_TIMEOUT_MS = 5000;

export type Fetcher = (url: string, init: RequestInit) => Promise<Response>;

export interface AeSourceOptions {
  accountId: string;
  token: string;
  /** Analytics Engine dataset to read (`AE_DATASET`); defaults to the production dataset. */
  dataset?: string;
  fetch?: Fetcher;
  sincePageSize?: number;
  /** Per request; a stalled SQL API then fails the read instead of holding the stats request. */
  timeoutMs?: number;
}

export class AeVisitSource implements VisitSource {
  readonly #url: string;
  readonly #token: string;
  readonly #dataset: string;
  readonly #fetch: Fetcher;
  readonly #sincePageSize: number;
  readonly #timeoutMs: number;

  constructor(options: AeSourceOptions) {
    if (!/^[0-9a-f]{32}$/i.test(options.accountId)) throw new Error("Invalid CF_ACCOUNT_ID");
    this.#url = `https://api.cloudflare.com/client/v4/accounts/${options.accountId}/analytics_engine/sql`;
    this.#token = options.token;
    this.#dataset = checkDataset(options.dataset ?? DEFAULT_DATASET);
    this.#fetch = options.fetch ?? ((url, init) => fetch(url, init));
    this.#timeoutMs = options.timeoutMs ?? REQUEST_TIMEOUT_MS;
    this.#sincePageSize = checkInt(
      "page size",
      options.sincePageSize ?? SINCE_PAGE_SIZE,
      1,
      MAX_LIMIT,
    );
  }

  async #query(sql: string): Promise<VisitRow[]> {
    const res = await this.#fetch(this.#url, {
      method: "POST",
      headers: { authorization: `Bearer ${this.#token}` },
      body: sql,
      signal: AbortSignal.timeout(this.#timeoutMs),
    });
    if (!res.ok) {
      // The body is Cloudflare's error text (for example which column it rejected), never a credential.
      const detail = (await res.text().catch(() => "")).replace(/\s+/g, " ").trim().slice(0, 200);
      throw new Error(
        `Analytics Engine SQL API returned ${res.status}${detail === "" ? "" : `: ${detail}`}`,
      );
    }
    return parseRows(await res.json());
  }

  queryDay(day: string, offset: number, limit: number): Promise<VisitRow[]> {
    return this.#query(buildDayQuery(day, offset, limit, this.#dataset));
  }

  async querySince(day: string): Promise<VisitRow[]> {
    const all: VisitRow[] = [];
    for (let page = 0; page < MAX_FRESH_PAGES; page++) {
      const rows = await this.#query(
        buildSinceQuery(day, page * this.#sincePageSize, this.#sincePageSize, this.#dataset),
      );
      all.push(...rows);
      if (rows.length < this.#sincePageSize) return all;
    }
    throw new Error("Analytics Engine fresh data exceeds the page budget");
  }
}

/** AE source when both `CF_ACCOUNT_ID` and `CF_AE_TOKEN` are set, otherwise the empty local source. */
export function createVisitSource(
  env: { CF_ACCOUNT_ID?: string; CF_AE_TOKEN?: string; AE_DATASET?: string },
  fetcher?: Fetcher,
): VisitSource {
  if (!env.CF_ACCOUNT_ID || !env.CF_AE_TOKEN) return new LocalVisitSource();
  return new AeVisitSource({
    accountId: env.CF_ACCOUNT_ID,
    token: env.CF_AE_TOKEN,
    dataset: env.AE_DATASET,
    fetch: fetcher,
  });
}
