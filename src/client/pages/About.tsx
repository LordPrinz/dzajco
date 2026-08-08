import { Suspense, lazy, useEffect, useState } from "react";
import type { GlobalStats } from "@shared/types";
import { countryFlag, countryName } from "@shared/format";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import StatTile from "@/components/charts/StatTile";
import BarList, { type BarRow } from "@/components/charts/BarList";

const Choropleth = lazy(() => import("@/components/charts/Choropleth"));

export default function About() {
	const { t } = useI18n();
	const [stats, setStats] = useState<GlobalStats | null>(null);

	useEffect(() => {
		let cancelled = false;

		void api
			.globalStats()
			.then((data) => {
				if (!cancelled) setStats(data);
			})
			.catch(() => {
				// The page is still worth reading without the counters.
			});

		return () => {
			cancelled = true;
		};
	}, []);

	const rows: BarRow[] =
		stats?.countries.map((row) => ({
			key: row.label,
			title: countryName(row.label),
			label: (
				<>
					<span aria-hidden="true">{countryFlag(row.label)}</span>{" "}
					{countryName(row.label)}
				</>
			),
			value: row.clicks,
		})) ?? [];

	return (
		<div className="mx-auto mt-14 max-w-3xl">
			<h1 className="text-3xl font-extrabold sm:text-4xl">{t("about.title")}</h1>
			<p className="mt-3 leading-relaxed text-muted">{t("about.body")}</p>

			<section className="mt-8 grid gap-3 sm:grid-cols-2">
				<StatTile
					label={t("about.links")}
					value={stats ? stats.links.toLocaleString() : "—"}
				/>
				<StatTile
					label={t("about.clicks")}
					value={stats ? stats.clicks.toLocaleString() : "—"}
				/>
			</section>

			<section className="panel mt-3 p-5 sm:p-6">
				<h2 className="mb-4 font-bold text-ink">{t("about.topCountries")}</h2>
				<Suspense fallback={<div className="skeleton h-[300px] rounded-2xl" />}>
					<Choropleth countries={stats?.countries ?? []} />
				</Suspense>
				<div className="mt-6 border-t border-edge pt-5">
					<BarList rows={rows} limit={10} />
				</div>
			</section>
		</div>
	);
}
