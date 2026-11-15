// Pure part of the v2 visit import: turns the `visits` and `visitsLocation` of imported links,
// plus the `locations` collection, into rows of the v2_visit_import ledger (migration 0003).
// No Node or Bun APIs here, so the worker test can run it inside workerd.

import { roundCoord } from "../../src/domain/geo";
import { sqlString } from "../lib/sql";
import { countryCode } from "./countries";
import { BATCH_SIZE, compareCodePoints, type LinkRow } from "./transform";

export interface VisitImportRow {
  linkId: string;
  /** Target of the imported link; the SQL only applies while D1 holds the same link. */
  target: string;
  /** ISO 3166 code, or "" when v2 did not know the country. */
  country: string;
  city: string;
  lat: number | null;
  lon: number | null;
  visits: number;
}

export interface VisitReport {
  /** Imported links with at least one v2 visit. */
  links: number;
  rows: number;
  visits: number;
  /** Visits without a usable location, written to the unknown-country row. */
  unknownVisits: number;
  /** v2 country names with no ISO code; their visits keep the city under the unknown country. */
  unmappedCountries: string[];
  /** `visitsLocation` ids missing from the `locations` collection; imported without coordinates. */
  missingLocations: string[];
  /** Links whose located visits add up to more than `visits`; the located sum is imported. */
  locatedOverTotal: string[];
}

export interface Coordinates {
  lat: number | null;
  lon: number | null;
}

/** A non-negative integer from a plain number or Extended JSON; null for anything else. */
export function visitCount(value: unknown): number | null {
  let n: unknown = value;
  if (typeof value === "object" && value !== null) {
    const v = value as Record<string, unknown>;
    n = Number(v.$numberInt ?? v.$numberLong ?? v.$numberDouble ?? Number.NaN);
  }
  return typeof n === "number" && Number.isSafeInteger(n) && n >= 0 ? n : null;
}

function coordinate(value: unknown): number | null {
  if (typeof value === "object" && value !== null) {
    const v = value as Record<string, unknown>;
    return roundCoord(Number(v.$numberDouble ?? v.$numberInt ?? Number.NaN));
  }
  return roundCoord(typeof value === "number" ? value : null);
}

/** The `locations` collection by id (`City_Region_Country`). */
export function parseLocations(docs: Iterable<unknown>): Map<string, Coordinates> {
  const locations = new Map<string, Coordinates>();
  for (const doc of docs) {
    if (typeof doc !== "object" || doc === null) continue;
    const { _id, lat, lon } = doc as Record<string, unknown>;
    if (typeof _id !== "string") continue;
    const point = { lat: coordinate(lat), lon: coordinate(lon) };
    locations.set(_id, point.lat !== null && point.lon !== null ? point : { lat: null, lon: null });
  }
  return locations;
}

/** Country name and city of a v2 location id: `City_Region_Country`. */
function splitLocation(id: string): { countryName: string; city: string } {
  const parts = id.split("_");
  if (parts.length < 2) return { countryName: parts[0] ?? "", city: "" };
  return { countryName: parts[parts.length - 1] as string, city: (parts[0] as string).trim() };
}

interface Place {
  country: string;
  city: string;
  visits: number;
  latSum: number;
  lonSum: number;
  /** Visits that came with coordinates; the mean is weighted by them. */
  weight: number;
}

/**
 * Ledger rows for the imported links (`rows`, with their v2 documents in `sources`). Visits of one
 * link that land on the same country and city are merged. Visits not covered by `visitsLocation`
 * go to the unknown-country row (`country` and `city` empty).
 */
export function transformVisits(
  rows: readonly LinkRow[],
  sources: ReadonlyMap<string, Record<string, unknown>>,
  locations: ReadonlyMap<string, Coordinates>,
): { rows: VisitImportRow[]; report: VisitReport } {
  const report: VisitReport = {
    links: 0,
    rows: 0,
    visits: 0,
    unknownVisits: 0,
    unmappedCountries: [],
    missingLocations: [],
    locatedOverTotal: [],
  };
  const unmapped = new Set<string>();
  const missing = new Set<string>();
  const out: VisitImportRow[] = [];

  for (const link of rows) {
    const doc = sources.get(link.id);
    if (!doc) continue;
    const places = new Map<string, Place>();
    const add = (country: string, city: string, visits: number, at: Coordinates | undefined) => {
      const key = JSON.stringify([country, city]);
      const place = places.get(key) ?? {
        country,
        city,
        visits: 0,
        latSum: 0,
        lonSum: 0,
        weight: 0,
      };
      place.visits += visits;
      if (at && at.lat !== null && at.lon !== null) {
        place.latSum += at.lat * visits;
        place.lonSum += at.lon * visits;
        place.weight += visits;
      }
      places.set(key, place);
    };

    let located = 0;
    const entries = Array.isArray(doc.visitsLocation) ? doc.visitsLocation : [];
    for (const entry of entries) {
      if (typeof entry !== "object" || entry === null) continue;
      const { visits, location } = entry as Record<string, unknown>;
      const n = visitCount(visits);
      if (!n || typeof location !== "string" || location === "") continue;
      const { countryName, city } = splitLocation(location);
      let country = countryCode(countryName);
      if (country === null) {
        unmapped.add(countryName);
        country = "";
      }
      const at = locations.get(location);
      if (!at) missing.add(location);
      add(country, city, n, at);
      located += n;
    }
    const total = visitCount(doc.visits) ?? 0;
    if (located > total) report.locatedOverTotal.push(link.id);
    const unknown = Math.max(0, total - located);
    if (unknown > 0) {
      add("", "", unknown, undefined);
      report.unknownVisits += unknown;
    }
    if (places.size === 0) continue;

    report.links += 1;
    const sorted = [...places.values()].sort(
      (a, b) => compareCodePoints(a.country, b.country) || compareCodePoints(a.city, b.city),
    );
    for (const place of sorted) {
      out.push({
        linkId: link.id,
        target: link.target,
        country: place.country,
        city: place.city,
        lat: place.weight > 0 ? roundCoord(place.latSum / place.weight) : null,
        lon: place.weight > 0 ? roundCoord(place.lonSum / place.weight) : null,
        visits: place.visits,
      });
      report.visits += place.visits;
    }
  }

  report.rows = out.length;
  report.unmappedCountries = [...unmapped].sort(compareCodePoints);
  report.missingLocations = [...missing].sort(compareCodePoints);
  return { rows: out, report };
}

function sqlNumber(value: number | null): string {
  return value === null ? "NULL" : String(value);
}

/**
 * One ledger row, written only while D1 holds the link with the same target and the ledger does
 * not have the row yet. The trigger of migration 0003 adds the visits to `link_stats` in the same
 * statement, so the statement is safe to run any number of times.
 */
export function visitSql(row: VisitImportRow): string {
  const id = sqlString(row.linkId);
  const country = sqlString(row.country);
  const city = sqlString(row.city);
  const values = [id, country, city, sqlNumber(row.lat), sqlNumber(row.lon), String(row.visits)];
  return (
    `INSERT INTO v2_visit_import (link_id, country, city, lat, lon, visits) SELECT ${values.join(", ")} ` +
    `WHERE EXISTS (SELECT 1 FROM links WHERE id = ${id} AND target = ${sqlString(row.target)}) ` +
    `AND NOT EXISTS (SELECT 1 FROM v2_visit_import WHERE link_id = ${id} AND country = ${country} AND city = ${city});`
  );
}

/** One statement per line, at most BATCH_SIZE lines per file. */
export function buildVisitSqlFiles(
  rows: readonly VisitImportRow[],
  batchSize: number = BATCH_SIZE,
): string[] {
  const files: string[] = [];
  for (let i = 0; i < rows.length; i += batchSize) {
    files.push(
      `${rows
        .slice(i, i + batchSize)
        .map(visitSql)
        .join("\n")}\n`,
    );
  }
  return files;
}
