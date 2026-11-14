// Shared by the server-rendered stats page and its browser script, so keep it free of runtime imports.

export interface CountryRow {
  code: string;
  visits: number;
}

export interface CityRow {
  country: string;
  city: string;
  lat: number | null;
  lon: number | null;
  visits: number;
}

/** The secret key stored for `id` in the `links-history` array (v2 shape), or null. */
export function findSecretKey(history: unknown, id: string): string | null {
  if (!Array.isArray(history)) return null;
  for (const entry of history) {
    if (typeof entry !== "object" || entry === null) continue;
    const { id: entryId, secretKey } = entry as { id?: unknown; secretKey?: unknown };
    if (entryId === id && typeof secretKey === "string" && secretKey !== "") return secretKey;
  }
  return null;
}

export function ownerStatsPath(id: string): string {
  return `/api/v1/links/${encodeURIComponent(id)}/stats`;
}

/** The key travels only in the `Authorization` header: never in the URL, a query string or a body. */
export function ownerRequest(id: string, key: string): { url: string; init: RequestInit } {
  return {
    url: ownerStatsPath(id),
    init: { headers: { Authorization: `Bearer ${key}` }, cache: "no-store" },
  };
}

/** Narrows an API response to its cities; anything unexpected yields an empty list. */
export function parseCities(body: unknown): CityRow[] {
  const cities = (body as { cities?: unknown } | null)?.cities;
  if (!Array.isArray(cities)) return [];
  const rows: CityRow[] = [];
  for (const item of cities) {
    const row = item as Partial<CityRow> | null;
    if (!row || typeof row.city !== "string" || typeof row.visits !== "number") continue;
    rows.push({
      country: typeof row.country === "string" ? row.country : "",
      city: row.city,
      lat: typeof row.lat === "number" && Number.isFinite(row.lat) ? row.lat : null,
      lon: typeof row.lon === "number" && Number.isFinite(row.lon) ? row.lon : null,
      visits: row.visits,
    });
  }
  return rows;
}

/** Polish name of an ISO 3166 country code; the code itself when the runtime does not know it. */
export function countryName(code: string): string {
  if (!/^[A-Za-z]{2}$/.test(code) || code.toUpperCase() === "XX") return "Nieznany kraj";
  try {
    return new Intl.DisplayNames(["pl"], { type: "region" }).of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}

/** True when at least one city has coordinates, i.e. a map would have something to show. */
export function hasCoordinates(cities: readonly CityRow[]): boolean {
  return cities.some((city) => city.lat !== null && city.lon !== null);
}
