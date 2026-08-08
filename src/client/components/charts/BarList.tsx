import type { ReactNode } from "react";
import { useI18n } from "@/lib/i18n";

export type BarRow = {
	key: string;
	label: ReactNode;
	/** Plain-text label for the tooltip and for screen readers. */
	title: string;
	value: number;
};

/**
 * Ranked magnitudes as a bar list.
 *
 * One series, so one hue and no legend — the panel heading names what is
 * plotted. Every row carries its value as text, which makes this simultaneously
 * the chart and the table view: nothing is gated behind reading a bar length.
 */
export default function BarList({
	rows,
	max,
	limit = 8,
	emptyLabel,
}: {
	rows: BarRow[];
	max?: number;
	limit?: number;
	emptyLabel?: string;
}) {
	const { t } = useI18n();
	const shown = rows.slice(0, limit);
	const ceiling = max ?? Math.max(...shown.map((row) => row.value), 1);

	if (!shown.length) {
		return <p className="py-6 text-sm text-faint">{emptyLabel ?? t("stats.noData")}</p>;
	}

	return (
		<ol className="space-y-2.5">
			{shown.map((row) => {
				const share = Math.max((row.value / ceiling) * 100, 1.5);

				return (
					<li key={row.key} title={`${row.title}: ${row.value.toLocaleString()}`}>
						<div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
							<span className="clamp-1 font-semibold text-ink">{row.label}</span>
							<span className="shrink-0 tabular-nums text-muted">
								{row.value.toLocaleString()}
							</span>
						</div>
						{/* Track is a wash of the same hue, so the bar reads as a fill
						    of a whole rather than a floating mark. */}
						<div className="h-2.5 w-full overflow-hidden rounded-full bg-[rgb(var(--chart-mark)/0.12)]">
							<div
								className="h-full rounded-r-[4px] bg-[rgb(var(--chart-mark))] transition-[width] duration-500"
								style={{ width: `${share}%` }}
							/>
						</div>
					</li>
				);
			})}
		</ol>
	);
}
