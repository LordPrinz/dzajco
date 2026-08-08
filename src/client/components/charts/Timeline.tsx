import { useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";

type Point = { day: string; clicks: number };

/**
 * Clicks per day.
 *
 * Days with no clicks are filled in as zeroes rather than skipped — a time axis
 * that silently drops empty days compresses quiet periods and makes a flat week
 * look like a busy one.
 */
function densify(points: Point[], days: number): Point[] {
	const byDay = new Map(points.map((point) => [point.day, point.clicks]));
	const out: Point[] = [];

	for (let offset = days - 1; offset >= 0; offset--) {
		const day = new Date(Date.now() - offset * 86_400_000)
			.toISOString()
			.slice(0, 10);
		out.push({ day, clicks: byDay.get(day) ?? 0 });
	}
	return out;
}

/** Rounds up to a clean axis ceiling (1, 2, 5 × 10ⁿ). */
function niceCeiling(value: number): number {
	if (value <= 5) return Math.max(value, 1);

	const magnitude = 10 ** Math.floor(Math.log10(value));
	const normalised = value / magnitude;
	const step = normalised <= 1 ? 1 : normalised <= 2 ? 2 : normalised <= 5 ? 5 : 10;

	return step * magnitude;
}

export default function Timeline({
	points,
	days = 30,
}: {
	points: Point[];
	days?: number;
}) {
	const { t, lang } = useI18n();
	const [hover, setHover] = useState<number | null>(null);

	const data = useMemo(() => densify(points, days), [points, days]);
	const peak = Math.max(...data.map((point) => point.clicks), 0);
	const ceiling = niceCeiling(peak);
	const ticks = [ceiling, Math.round(ceiling / 2), 0];

	const formatDay = (day: string) =>
		new Date(`${day}T00:00:00Z`).toLocaleDateString(lang, {
			month: "short",
			day: "numeric",
			timeZone: "UTC",
		});

	if (!peak) {
		return <p className="py-10 text-center text-sm text-faint">{t("stats.noData")}</p>;
	}

	const active = hover === null ? null : data[hover];

	return (
		<div className="relative">
			<div className="flex gap-3">
				{/* Axis ticks carry the values the marks are not directly labelled
				    with; tabular figures keep them aligned. */}
				<div className="flex h-40 w-10 shrink-0 flex-col justify-between py-0 text-right text-[10px] tabular-nums text-faint">
					{ticks.map((tick) => (
						<span key={tick}>{tick.toLocaleString()}</span>
					))}
				</div>

				<div
					className="relative h-40 flex-1"
					onMouseLeave={() => setHover(null)}>
					{/*
					  Hairline, solid, one step off the surface — recessive. The
					  baseline is anchored with `bottom` rather than `top: 100%`, so
					  the line sits inside the plot area and the bars end on it
					  instead of a pixel past it.
					*/}
					{[{ top: 0 }, { top: "50%" }, { bottom: 0 }].map((position, index) => (
						<div
							key={index}
							className="absolute inset-x-0 h-px bg-[rgb(var(--chart-grid))]"
							style={position}
						/>
					))}

					<div className="absolute inset-0 flex items-end gap-[2px]">
						{data.map((point, index) => (
							<div
								key={point.day}
								className="group relative flex h-full max-w-[24px] flex-1 cursor-default items-end"
								onMouseEnter={() => setHover(index)}
								onFocus={() => setHover(index)}
								tabIndex={-1}>
								{/* Full-height hit area: a 1px-tall bar is impossible to
								    hover otherwise. */}
								<span className="absolute inset-0" aria-hidden="true" />
								<div
									className={`w-full rounded-t-[4px] transition-colors ${
										hover === index
											? "bg-[rgb(var(--chart-mark))]"
											: "bg-[rgb(var(--chart-mark)/0.75)]"
									}`}
									style={{
										// A zero day draws nothing — the baseline gridline
										// already marks it. Stubs across the axis read as a
										// dashed rule rather than as data.
										height: point.clicks
											? `${Math.max((point.clicks / ceiling) * 100, 2)}%`
											: 0,
									}}
								/>
							</div>
						))}
					</div>
				</div>
			</div>

			<div className="ml-[52px] mt-2 flex justify-between text-[10px] text-faint">
				<span>{formatDay(data[0].day)}</span>
				<span>{formatDay(data[data.length - 1].day)}</span>
			</div>

			{active && (
				<div className="pointer-events-none absolute right-0 top-0 rounded-lg border border-edge bg-surface px-3 py-1.5 text-xs shadow-lift">
					<div className="font-bold text-ink">
						{active.clicks.toLocaleString()}{" "}
						{t(active.clicks === 1 ? "stats.visits_one" : "stats.visits_other")}
					</div>
					<div className="text-faint">{formatDay(active.day)}</div>
				</div>
			)}
		</div>
	);
}
