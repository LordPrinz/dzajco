import { useState, type ReactNode } from "react";
import { ChevronIcon } from "./Icons";

/**
 * The "More options" disclosure from the original form. The panel is unmounted
 * while closed — the advanced fields are the minority case, and keeping them out
 * of the tree keeps the first paint to the one input that matters.
 */
export default function Collapse({
	openLabel,
	closeLabel,
	children,
}: {
	openLabel: string;
	closeLabel: string;
	children: ReactNode;
}) {
	const [open, setOpen] = useState(false);

	return (
		<div>
			<button
				type="button"
				onClick={() => setOpen((value) => !value)}
				aria-expanded={open}
				className="mx-auto mt-4 flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-muted transition hover:text-jajco-600 dark:hover:text-jajco-400">
				{open ? closeLabel : openLabel}
				<ChevronIcon
					className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
				/>
			</button>

			{open && (
				<div className="panel mt-3 animate-fade-up p-5 sm:p-6">{children}</div>
			)}
		</div>
	);
}
