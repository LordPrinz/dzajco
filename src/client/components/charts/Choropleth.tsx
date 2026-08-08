import { useMemo, useState } from "react";
import type { CountRow } from "@shared/types";
import { countryFlag, countryName } from "@shared/format";
import { useI18n } from "@/lib/i18n";
import { WORLD_PATHS, WORLD_VIEWBOX } from "./worldPaths";

const BINS = 5;

/**
 * World choropleth of clicks per country.
 *
 * Magnitude, so the colour job is sequential: one hue running light to dark
 * across five bins, with a neutral fill for "no data" that is deliberately
 * outside the ramp — absence of data is not a low value.
 *
 * Bins are cut on a square-root scale. Click distributions are heavily skewed
 * (one country usually dwarfs the rest), and linear cuts would drop every other
 * country into bin 1 and say nothing.
 */
function binFor(clicks: number, peak: number): number {
	if (clicks <= 0) return 0;
	if (peak <= 1) return BINS;

	const scaled = Math.sqrt(clicks) / Math.sqrt(peak);
	return Math.min(BINS, Math.max(1, Math.ceil(scaled * BINS)));
}

export default function Choropleth({
	countries,
	className = "",
}: {
	countries: CountRow[];
	className?: string;
}) {
	const { t } = useI18n();
	const [hover, setHover] = useState<{ code: string; clicks: number } | null>(null);

	const { byCountry, peak } = useMemo(() => {
		const map = new Map<string, number>();
		for (const row of countries) map.set(row.label.toUpperCase(), row.clicks);
		return { byCountry: map, peak: Math.max(...countries.map((r) => r.clicks), 0) };
	}, [countries]);

	if (!countries.length) {
		return (
			<div
				className={`flex items-center justify-center rounded-2xl bg-sunken text-sm text-faint ${className}`}>
				{t("stats.noData")}
			</div>
		);
	}

	return (
		<div className={`relative ${className}`}>
			<svg
				viewBox={WORLD_VIEWBOX}
				className="h-auto w-full"
				role="img"
				aria-label={t("stats.map")}
				onMouseLeave={() => setHover(null)}>
				{Object.entries(WORLD_PATHS).map(([code, d]) => {
					const clicks = byCountry.get(code) ?? 0;
					const bin = binFor(clicks, peak);

					return (
						<path
							key={code}
							d={d}
							fill={`rgb(var(--choro-${bin}))`}
							// A hairline in the surface colour separates neighbours, so
							// two adjacent countries in the same bin stay distinct.
							stroke="rgb(var(--surface))"
							strokeWidth={0.5}
							className={clicks ? "cursor-pointer" : undefined}
							onMouseEnter={() => clicks && setHover({ code, clicks })}
						>
							<title>{`${countryName(code)}: ${clicks.toLocaleString()}`}</title>
						</path>
					);
				})}
			</svg>

			<div className="mt-3 flex flex-wrap items-center justify-between gap-3">
				{/* Sequential scales need a legend — the bins carry the values. */}
				<div className="flex items-center gap-1.5 text-[10px] text-faint">
					<span>0</span>
					{Array.from({ length: BINS }, (_, index) => (
						<span
							key={index}
							className="h-3 w-5 rounded-sm"
							style={{ background: `rgb(var(--choro-${index + 1}))` }}
						/>
					))}
					<span className="tabular-nums">{peak.toLocaleString()}</span>
				</div>

				{hover && (
					<div className="text-xs font-semibold text-ink">
						<span aria-hidden="true">{countryFlag(hover.code)}</span>{" "}
						{countryName(hover.code)}{" "}
						<span className="tabular-nums text-muted">
							· {hover.clicks.toLocaleString()}{" "}
							{t(hover.clicks === 1 ? "stats.visits_one" : "stats.visits_other")}
						</span>
					</div>
				)}
			</div>
		</div>
	);
}
