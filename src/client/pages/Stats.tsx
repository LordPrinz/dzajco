import { Suspense, lazy, useCallback, useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import type { LinkStats } from "@shared/types";
import { countryFlag, countryName, relativeTime, truncateUrl } from "@shared/format";
import { api, ApiFailure } from "@/lib/api";
import { secretFor } from "@/lib/storage";
import { translateError, useI18n } from "@/lib/i18n";
import StatTile from "@/components/charts/StatTile";
import BarList, { type BarRow } from "@/components/charts/BarList";
import Timeline from "@/components/charts/Timeline";
import { DownloadIcon, LockIcon } from "@/components/Icons";

// Leaflet, and the baked world geometry, are large and only this page needs
// them — both stay out of the landing-page bundle.
const GeoMap = lazy(() => import("@/components/charts/GeoMap"));
const Choropleth = lazy(() => import("@/components/charts/Choropleth"));

const STATUS_STYLES: Record<string, string> = {
	active: "text-emerald-700 dark:text-emerald-400",
	scheduled: "text-sky-700 dark:text-sky-400",
	expired: "text-muted",
	disabled: "text-muted",
	exhausted: "text-amber-700 dark:text-amber-400",
};

export default function Stats() {
	const { code = "" } = useParams();
	const [params] = useSearchParams();
	const { t, lang } = useI18n();

	// The key can come from this browser's profile or be pasted into the URL,
	// which is how an owner reads stats on a device that did not create the link.
	const [secret, setSecret] = useState<string | undefined>(
		() => params.get("key") ?? secretFor(code) ?? undefined
	);
	const [keyInput, setKeyInput] = useState("");
	const [data, setData] = useState<LinkStats | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);

	const load = useCallback(
		async (withSecret?: string) => {
			setLoading(true);
			try {
				setData(await api.stats(code, withSecret));
				setError(null);
			} catch (failure) {
				setError(
					failure instanceof ApiFailure
						? translateError(t, failure.code)
						: t("error.generic")
				);
			} finally {
				setLoading(false);
			}
		},
		[code, t]
	);

	useEffect(() => {
		void load(secret);
	}, [load, secret]);

	if (loading && !data) {
		return (
			<div className="mt-16 space-y-3">
				<div className="skeleton h-10 w-64 rounded-lg" />
				<div className="skeleton h-40 w-full rounded-2xl" />
			</div>
		);
	}

	if (error && !data) {
		return (
			<div className="mx-auto mt-24 max-w-md text-center">
				<h1 className="text-3xl font-extrabold">{error}</h1>
				<Link to="/" className="btn-primary mt-6">
					{t("gate.home")}
				</Link>
			</div>
		);
	}

	if (!data) return null;

	const { link, totals, owner } = data;

	const geoRows: BarRow[] = data.geo
		.filter((point) => point.city)
		.map((point) => ({
			key: `${point.country}-${point.region}-${point.city}`,
			title: `${point.city}, ${countryName(point.country)}`,
			label: (
				<>
					<span aria-hidden="true">{countryFlag(point.country)}</span> {point.city}
					<span className="text-faint"> · {countryName(point.country)}</span>
				</>
			),
			value: point.clicks,
		}));

	const countryRows: BarRow[] = data.countries.map((row) => ({
		key: row.label,
		title: countryName(row.label),
		label: (
			<>
				<span aria-hidden="true">{countryFlag(row.label)}</span>{" "}
				{countryName(row.label)}
			</>
		),
		value: row.clicks,
	}));

	const simpleRows = (rows: { label: string; clicks: number }[]): BarRow[] =>
		rows.map((row) => ({
			key: row.label,
			title: row.label === "direct" ? t("stats.direct") : row.label,
			label: row.label === "direct" ? t("stats.direct") : row.label,
			value: row.clicks,
		}));

	return (
		<div className="mt-10 space-y-6">
			<header className="flex flex-wrap items-start justify-between gap-4">
				<div className="min-w-0">
					<h1 className="text-3xl font-extrabold sm:text-4xl">
						/{link.code}
						{link.hasPassword && (
							<LockIcon className="ml-2 inline h-5 w-5 text-muted" />
						)}
					</h1>

					{owner && link.target && (
						<a
							href={link.target}
							target="_blank"
							rel="noreferrer"
							className="mt-1 block text-sm text-muted hover:text-jajco-600 dark:hover:text-jajco-400"
							title={link.target}>
							{truncateUrl(link.target, 80)}
						</a>
					)}

					<div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
						<span className={`chip ${STATUS_STYLES[link.status] ?? ""}`}>
							{t(`status.${link.status}` as "status.active")}
						</span>
						<span className="chip">
							{t("stats.created")}: {relativeTime(link.createdAt, lang)}
						</span>
						{link.expiresAt && (
							<span className="chip">
								{t("stats.expires")}: {relativeTime(link.expiresAt, lang)}
							</span>
						)}
						{link.startsAt && (
							<span className="chip">
								{t("stats.starts")}: {relativeTime(link.startsAt, lang)}
							</span>
						)}
					</div>
				</div>

				{owner && (
					<a
						href={api.csvUrl(code, secret)}
						className="btn-ghost px-4 py-2 text-sm"
						download>
						<DownloadIcon className="h-4 w-4" /> {t("stats.export")}
					</a>
				)}
			</header>

			{!owner && (
				<UnlockPanel
					value={keyInput}
					onChange={setKeyInput}
					onSubmit={() => setSecret(keyInput.trim() || undefined)}
				/>
			)}

			<section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
				<div className="sm:col-span-2">
					<StatTile
						label={t("stats.clicks")}
						value={totals.clicks.toLocaleString()}
						hint={
							link.lastClickAt
								? `${t("stats.lastClick")}: ${relativeTime(link.lastClickAt, lang)}`
								: undefined
						}
						hero
					/>
				</div>
				<StatTile label={t("stats.countries")} value={totals.countries} />
				<StatTile
					label={owner ? t("stats.cities") : t("stats.last30d")}
					value={owner ? totals.cities : "—"}
				/>
			</section>

			{owner && (
				<section className="grid gap-3 sm:grid-cols-2">
					<StatTile label={t("stats.last7d")} value={totals.last7d.toLocaleString()} />
					<StatTile label={t("stats.last30d")} value={totals.last30d.toLocaleString()} />
				</section>
			)}

			{owner && (
				<section className="panel p-5 sm:p-6">
					<h2 className="mb-5 font-bold text-ink">{t("stats.timeline")}</h2>
					<Timeline points={data.timeline} days={30} />
				</section>
			)}

			<section className="panel p-5 sm:p-6">
				<h2 className="mb-4 font-bold text-ink">{t("stats.countriesMap")}</h2>
				<Suspense fallback={<div className="skeleton h-[300px] rounded-2xl" />}>
					<Choropleth countries={data.countries} />
				</Suspense>
			</section>

			<section className="panel overflow-hidden">
				<h2 className="px-5 pb-3 pt-5 font-bold text-ink sm:px-6">
					{t("stats.map")}
				</h2>
				<Suspense
					fallback={<div className="skeleton mx-5 mb-5 h-[420px] rounded-2xl" />}>
					<GeoMap points={data.geo} className="h-[420px] w-full" />
				</Suspense>
				<p className="px-5 py-2 text-[10px] text-faint sm:px-6">
					© OpenStreetMap contributors
				</p>
			</section>

			<section className="grid gap-3 lg:grid-cols-2">
				<Panel title={t("stats.topCountries")}>
					<BarList rows={countryRows} />
				</Panel>

				{owner && (
					<Panel title={t("stats.topCities")}>
						<BarList rows={geoRows} />
					</Panel>
				)}

				{owner && (
					<Panel title={t("stats.referrers")}>
						<BarList rows={simpleRows(data.referrers)} />
					</Panel>
				)}

				{owner && (
					<Panel title={t("stats.devices")}>
						<BarList rows={simpleRows(data.devices)} limit={5} />
					</Panel>
				)}

				{owner && (
					<Panel title={t("stats.browsers")}>
						<BarList rows={simpleRows(data.browsers)} limit={6} />
					</Panel>
				)}
			</section>

			{owner && <UtmPanel stats={data} />}
		</div>
	);
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
	return (
		<div className="panel p-5 sm:p-6">
			<h2 className="mb-4 font-bold text-ink">{title}</h2>
			{children}
		</div>
	);
}

function UnlockPanel({
	value,
	onChange,
	onSubmit,
}: {
	value: string;
	onChange: (value: string) => void;
	onSubmit: () => void;
}) {
	const { t } = useI18n();

	return (
		<div className="panel border-dashed p-5">
			<p className="text-sm text-muted">{t("stats.publicNotice")}</p>
			<form
				className="mt-3 flex flex-wrap gap-2"
				onSubmit={(event) => {
					event.preventDefault();
					onSubmit();
				}}>
				<input
					value={value}
					onChange={(event) => onChange(event.target.value)}
					placeholder={t("stats.keyPlaceholder")}
					className="input-sm max-w-sm flex-1 font-mono text-xs"
					autoComplete="off"
					spellCheck={false}
				/>
				<button type="submit" className="btn-ghost px-4 py-2 text-sm">
					{t("stats.unlock")}
				</button>
			</form>
		</div>
	);
}

/**
 * UTM rows are a table rather than a chart: five dimensions per row is exactly
 * the case where a chart buries the detail the reader came for.
 */
function UtmPanel({ stats }: { stats: LinkStats }) {
	const { t } = useI18n();

	if (!stats.utm) {
		return (
			<div className="panel p-5 sm:p-6">
				<h2 className="mb-2 font-bold text-ink">{t("stats.utm")}</h2>
				<p className="text-sm text-faint">
					{stats.link.trackUtm ? t("stats.utmOff") : t("stats.utmAnon")}
				</p>
			</div>
		);
	}

	return (
		<div className="panel overflow-hidden">
			<h2 className="px-5 pb-3 pt-5 font-bold text-ink sm:px-6">{t("stats.utm")}</h2>

			{stats.utm.length === 0 ? (
				<p className="px-5 pb-5 text-sm text-faint sm:px-6">{t("stats.noData")}</p>
			) : (
				<div className="overflow-x-auto">
					<table className="w-full min-w-[36rem] text-sm">
						<thead className="border-y border-edge bg-sunken text-xs uppercase tracking-wide text-muted">
							<tr>
								<th className="px-5 py-2 text-left font-bold sm:px-6">source</th>
								<th className="px-3 py-2 text-left font-bold">medium</th>
								<th className="px-3 py-2 text-left font-bold">campaign</th>
								<th className="px-3 py-2 text-left font-bold">content</th>
								<th className="px-5 py-2 text-right font-bold sm:px-6">
									{t("stats.clicks")}
								</th>
							</tr>
						</thead>
						<tbody>
							{stats.utm.map((row, index) => (
								<tr
									key={`${row.source}|${row.medium}|${row.campaign}|${row.term}|${row.content}|${index}`}
									className="border-b border-edge/60 last:border-0">
									<td className="px-5 py-2 font-semibold sm:px-6">
										{row.source || "—"}
									</td>
									<td className="px-3 py-2 text-muted">{row.medium || "—"}</td>
									<td className="px-3 py-2 text-muted">{row.campaign || "—"}</td>
									<td className="px-3 py-2 text-muted">{row.content || "—"}</td>
									<td className="px-5 py-2 text-right tabular-nums sm:px-6">
										{row.clicks.toLocaleString()}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
		</div>
	);
}
