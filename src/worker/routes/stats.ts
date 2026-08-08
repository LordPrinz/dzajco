import { Hono } from "hono";
import type { AppContext } from "../env";
import type {
	CountRow,
	GeoPoint,
	GlobalStats,
	LinkStats,
	UtmRow,
} from "@shared/types";
import { getLink, toSummary, type LinkRow } from "../lib/links";
import { sha256Hex, timingSafeEqual } from "../lib/crypto";
import { isRateLimited, limiterKey } from "../lib/ratelimit";
import { fail, tooManyRequests } from "../lib/responses";

const stats = new Hono<AppContext>();

const TIMELINE_DAYS = 90;
const TOP_N = 25;

async function resolveOwner(
	row: LinkRow,
	userId: string | null,
	secret: string | undefined
): Promise<boolean> {
	if (row.user_id && userId && row.user_id === userId) return true;
	if (!row.secret_hash || !secret) return false;
	return timingSafeEqual(await sha256Hex(secret), row.secret_hash);
}

/**
 * Link statistics.
 *
 * Two tiers, deliberately:
 *  - anyone with the code sees the visit counter and the country map, which is
 *    what the public stats page has always shown;
 *  - the owner (secret or session) additionally sees cities, the timeline,
 *    referrers, devices and — on account-owned links — UTM breakdowns.
 */
stats.get("/:code", async (c) => {
	const userId = c.get("userId");
	if (await isRateLimited(c.env, "read", await limiterKey(c.req.raw, userId))) {
		return tooManyRequests(c);
	}

	const code = c.req.param("code");
	const row = await getLink(c.env, code);
	if (!row) return fail(c, 404, "not_found", "Link not found.");

	const secret =
		c.req.header("x-dzajco-secret")?.trim() || c.req.query("secret")?.trim();
	const owner = await resolveOwner(row, userId, secret);

	const summary = toSummary(row, c.env.APP_URL);
	if (!owner) {
		// Never expose where a private link actually points, or its schedule.
		summary.target = "";
		summary.title = null;
	}

	const geoRows = await c.env.DB.prepare(
		`SELECT country, region, city, lat, lon, clicks FROM clicks_geo
		 WHERE code = ?1 ORDER BY clicks DESC LIMIT 500`
	)
		.bind(code)
		.all<GeoPoint>();

	const geo = geoRows.results ?? [];
	const countries = rollUpCountries(geo);

	const totals = {
		clicks: row.clicks,
		countries: countries.length,
		cities: geo.filter((point) => point.city).length,
		last7d: 0,
		last30d: 0,
	};

	if (!owner) {
		return c.json<LinkStats>({
			link: summary,
			owner: false,
			totals,
			timeline: [],
			// Cities are owner-only; the public map is country-level.
			geo: geo.map((point) => ({ ...point, city: "", region: "" })),
			countries,
			referrers: [],
			devices: [],
			browsers: [],
			utm: null,
		});
	}

	const since = new Date(Date.now() - TIMELINE_DAYS * 86_400_000)
		.toISOString()
		.slice(0, 10);

	const [daily, referrers, devices, utm] = await c.env.DB.batch<
		Record<string, unknown>
	>([
		c.env.DB.prepare(
			`SELECT day, clicks FROM clicks_daily WHERE code = ?1 AND day >= ?2
			 ORDER BY day ASC`
		).bind(code, since),
		c.env.DB.prepare(
			`SELECT referrer AS label, clicks FROM clicks_ref WHERE code = ?1
			 ORDER BY clicks DESC LIMIT ?2`
		).bind(code, TOP_N),
		c.env.DB.prepare(
			`SELECT device, os, browser, clicks FROM clicks_device WHERE code = ?1
			 ORDER BY clicks DESC LIMIT 200`
		).bind(code),
		c.env.DB.prepare(
			`SELECT source, medium, campaign, term, content, clicks FROM clicks_utm
			 WHERE code = ?1 ORDER BY clicks DESC LIMIT ?2`
		).bind(code, TOP_N),
	]);

	const timeline = (daily.results ?? []) as { day: string; clicks: number }[];
	const deviceRows = (devices.results ?? []) as {
		device: string;
		os: string;
		browser: string;
		clicks: number;
	}[];

	const cutoff = (days: number) =>
		new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);

	const sum = (from: string) =>
		timeline
			.filter((entry) => entry.day >= from)
			.reduce((acc, entry) => acc + entry.clicks, 0);

	totals.last7d = sum(cutoff(7));
	totals.last30d = sum(cutoff(30));

	return c.json<LinkStats>({
		link: summary,
		owner: true,
		totals,
		timeline,
		geo,
		countries,
		referrers: (referrers.results ?? []) as CountRow[],
		devices: tally(deviceRows, (entry) => entry.device),
		browsers: tally(deviceRows, (entry) => entry.browser || "Other"),
		utm: row.track_utm ? ((utm.results ?? []) as UtmRow[]) : null,
	});
});

/** CSV export of a link's geography — owner only. */
stats.get("/:code/export.csv", async (c) => {
	const userId = c.get("userId");
	if (await isRateLimited(c.env, "read", await limiterKey(c.req.raw, userId))) {
		return tooManyRequests(c);
	}

	const code = c.req.param("code");
	const row = await getLink(c.env, code);
	if (!row) return fail(c, 404, "not_found", "Link not found.");

	const secret =
		c.req.header("x-dzajco-secret")?.trim() || c.req.query("secret")?.trim();
	if (!(await resolveOwner(row, userId, secret))) {
		return fail(c, 403, "forbidden", "You do not own this link.");
	}

	const { results } = await c.env.DB.prepare(
		`SELECT country, region, city, clicks FROM clicks_geo WHERE code = ?1
		 ORDER BY clicks DESC`
	)
		.bind(code)
		.all<{ country: string; region: string; city: string; clicks: number }>();

	const lines = ["country,region,city,clicks"];
	for (const entry of results ?? []) {
		lines.push(
			[entry.country, entry.region, entry.city, String(entry.clicks)]
				.map(csvCell)
				.join(",")
		);
	}

	return new Response(lines.join("\n"), {
		headers: {
			"content-type": "text/csv; charset=utf-8",
			"content-disposition": `attachment; filename="dzajco-${code}.csv"`,
		},
	});
});

/** Site-wide counters for the About page. */
stats.get("/", async (c) => {
	if (await isRateLimited(c.env, "read", await limiterKey(c.req.raw, c.get("userId")))) {
		return tooManyRequests(c);
	}

	const [totals, countries] = await c.env.DB.batch<Record<string, unknown>>([
		c.env.DB.prepare("SELECT key, value FROM globals"),
		c.env.DB.prepare(
			"SELECT country AS label, clicks FROM globals_geo ORDER BY clicks DESC LIMIT 30"
		),
	]);

	const counters = new Map(
		((totals.results ?? []) as { key: string; value: number }[]).map((entry) => [
			entry.key,
			entry.value,
		])
	);

	return c.json<GlobalStats>({
		links: counters.get("links_created") ?? 0,
		clicks: counters.get("total_clicks") ?? 0,
		countries: (countries.results ?? []) as CountRow[],
	});
});

/** Collapses city rows into one row per country. */
function rollUpCountries(geo: GeoPoint[]): CountRow[] {
	const byCountry = new Map<string, number>();
	for (const point of geo) {
		byCountry.set(point.country, (byCountry.get(point.country) ?? 0) + point.clicks);
	}
	return [...byCountry.entries()]
		.map(([label, clicks]) => ({ label, clicks }))
		.sort((a, b) => b.clicks - a.clicks);
}

function tally<T extends { clicks: number }>(
	rows: T[],
	pick: (row: T) => string
): CountRow[] {
	const totals = new Map<string, number>();
	for (const row of rows) {
		const label = pick(row) || "Other";
		totals.set(label, (totals.get(label) ?? 0) + row.clicks);
	}
	return [...totals.entries()]
		.map(([label, clicks]) => ({ label, clicks }))
		.sort((a, b) => b.clicks - a.clicks);
}

function csvCell(value: string): string {
	return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export default stats;
