/**
 * Visitor geography, taken from the `cf` object Cloudflare attaches to every
 * request. No third-party geo-IP service, no API key, no extra latency — and
 * the IP itself never leaves the request.
 */

export type Geo = {
	country: string;
	region: string;
	city: string;
	lat: number | null;
	lon: number | null;
};

const UNKNOWN: Geo = {
	country: "XX",
	region: "",
	city: "",
	lat: null,
	lon: null,
};

export function readGeo(request: Request): Geo {
	const cf = (request as { cf?: IncomingRequestCfProperties }).cf;
	if (!cf) return UNKNOWN;

	const lat = Number(cf.latitude);
	const lon = Number(cf.longitude);

	return {
		country: normalise(cf.country ?? "", 2).toUpperCase() || "XX",
		region: normalise(cf.region ?? "", 64),
		city: normalise(cf.city ?? "", 64),
		// Rounded to ~1km. Enough to place a city on the map, not enough to
		// point at a household.
		lat: Number.isFinite(lat) ? Math.round(lat * 100) / 100 : null,
		lon: Number.isFinite(lon) ? Math.round(lon * 100) / 100 : null,
	};
}

function normalise(value: string, max: number): string {
	// These values come from the edge, not from our own code, and they end up in
	// JSON responses and CSV exports — drop control and format characters.
	return value.replace(/\p{C}/gu, "").trim().slice(0, max);
}
