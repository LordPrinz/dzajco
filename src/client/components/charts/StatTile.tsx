import type { ReactNode } from "react";

/**
 * A single headline number. Deliberately not a one-bar chart — a lone value has
 * no magnitudes to compare, so the tile *is* the right form.
 *
 * Values use the font's proportional figures; `tabular-nums` is reserved for
 * columns that have to align vertically.
 */
export default function StatTile({
	label,
	value,
	hint,
	hero = false,
}: {
	label: string;
	value: ReactNode;
	hint?: string;
	hero?: boolean;
}) {
	return (
		<div className="panel flex flex-col justify-between gap-1 p-5">
			<div className="text-xs font-bold uppercase tracking-wide text-muted">
				{label}
			</div>
			<div
				className={`font-extrabold leading-none text-ink ${
					hero ? "text-5xl sm:text-6xl" : "text-3xl"
				}`}>
				{value}
			</div>
			{hint && <div className="text-xs text-faint">{hint}</div>}
		</div>
	);
}
