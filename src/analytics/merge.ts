// Adds the fresh Analytics Engine rows of one link to its rolled-up D1 stats.

import type { CityStat, CountryStat, OwnerStats, PublicStats } from "../db/queries";
import { roundCoord } from "../domain/geo";
import type { VisitRow } from "./ports";

interface CityTotal {
  country: string;
  city: string;
  visits: number;
  latSum: number;
  lonSum: number;
  /** Visits that came with coordinates; the mean is weighted by them. */
  weight: number;
}

function byVisits<T extends { visits: number }>(key: (item: T) => string) {
  return (a: T, b: T) => b.visits - a.visits || (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0);
}

/** True for a fresh row of this incarnation of the link: same id and the same `created_at`. */
function isOf(row: VisitRow, linkId: string, createdAt: number | null): boolean {
  return row.linkId === linkId && createdAt !== null && row.createdAt === createdAt;
}

/** Visits and countries of D1 plus the fresh rows of the link (`linkId` created at `createdAt`), sorted by visits. */
export function mergeCountries(
  d1: PublicStats,
  fresh: readonly VisitRow[],
  linkId: string,
  createdAt: number | null,
) {
  const totals = new Map<string, number>();
  for (const c of d1.countries) totals.set(c.code, (totals.get(c.code) ?? 0) + c.visits);
  for (const r of fresh) {
    if (isOf(r, linkId, createdAt)) totals.set(r.country, (totals.get(r.country) ?? 0) + r.visits);
  }
  const countries: CountryStat[] = [...totals]
    .map(([code, visits]) => ({ code, visits }))
    .sort(byVisits((c) => c.code));
  return { visits: countries.reduce((sum, c) => sum + c.visits, 0), countries };
}

/**
 * Cities of D1 plus the fresh rows of the link (`linkId` created at `createdAt`; rows without a city name are left out, as in D1).
 * Coordinates are the visit-weighted mean of the sources that have them, rounded to 2 decimals.
 */
export function mergeCities(
  d1: OwnerStats,
  fresh: readonly VisitRow[],
  linkId: string,
  createdAt: number | null,
): CityStat[] {
  const totals = new Map<string, CityTotal>();
  const add = (row: CityStat) => {
    if (row.city === "") return;
    const key = JSON.stringify([row.country, row.city]);
    const t = totals.get(key) ?? {
      country: row.country,
      city: row.city,
      visits: 0,
      latSum: 0,
      lonSum: 0,
      weight: 0,
    };
    t.visits += row.visits;
    if (row.lat !== null && row.lon !== null) {
      t.latSum += row.lat * row.visits;
      t.lonSum += row.lon * row.visits;
      t.weight += row.visits;
    }
    totals.set(key, t);
  };
  for (const c of d1.cities) add(c);
  for (const r of fresh) if (isOf(r, linkId, createdAt)) add(r);
  return [...totals.values()]
    .map((t) => ({
      country: t.country,
      city: t.city,
      lat: t.weight > 0 ? roundCoord(t.latSum / t.weight) : null,
      lon: t.weight > 0 ? roundCoord(t.lonSum / t.weight) : null,
      visits: t.visits,
    }))
    .sort(byVisits((c) => `${c.country}\u0000${c.city}`));
}
