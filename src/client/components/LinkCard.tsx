import { Link } from "react-router-dom";
import type { LinkSummary } from "@shared/types";
import { relativeTime, truncateUrl } from "@shared/format";
import { useI18n } from "@/lib/i18n";
import CopyButton from "./CopyButton";
import { ChartIcon, LockIcon, TrashIcon } from "./Icons";

const STATUS_TONE: Record<LinkSummary["status"], string> = {
	active: "border-emerald-300 text-emerald-700 dark:border-emerald-800 dark:text-emerald-400",
	scheduled: "border-sky-300 text-sky-700 dark:border-sky-800 dark:text-sky-400",
	expired: "",
	disabled: "",
	exhausted: "border-amber-300 text-amber-700 dark:border-amber-800 dark:text-amber-400",
};

export default function LinkCard({
	link,
	onDelete,
	onForget,
	statsHref,
}: {
	link: LinkSummary;
	onDelete?: () => void;
	onForget?: () => void;
	statsHref: string;
}) {
	const { t, lang } = useI18n();
	const display = link.shortUrl.replace(/^https?:\/\//, "");

	return (
		<div className="panel flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
			<div className="min-w-0 flex-1">
				<div className="flex flex-wrap items-center gap-2">
					<a
						href={link.shortUrl}
						target="_blank"
						rel="noreferrer"
						className="font-bold text-jajco-600 hover:underline dark:text-jajco-400">
						{display}
					</a>
					{link.hasPassword && <LockIcon className="h-4 w-4 text-faint" />}
					<span className={`chip ${STATUS_TONE[link.status]}`}>
						{t(`status.${link.status}` as "status.active")}
					</span>
				</div>

				{link.title && (
					<div className="mt-1 text-sm font-semibold text-ink">{link.title}</div>
				)}

				<div className="clamp-1 mt-0.5 text-xs text-muted" title={link.target}>
					{truncateUrl(link.target, 90)}
				</div>

				<div className="mt-1.5 flex flex-wrap gap-x-3 text-xs text-faint">
					<span>
						{link.clicks.toLocaleString()}{" "}
						{t(link.clicks === 1 ? "stats.visits_one" : "stats.visits_other")}
					</span>
					<span>
						{t("stats.created")} {relativeTime(link.createdAt, lang)}
					</span>
					{link.expiresAt && (
						<span>
							{t("stats.expires")} {relativeTime(link.expiresAt, lang)}
						</span>
					)}
				</div>
			</div>

			<div className="flex shrink-0 flex-wrap items-center gap-2">
				<CopyButton value={link.shortUrl} className="btn-ghost px-3 py-1.5 text-xs" />

				<Link to={statsHref} className="btn-ghost px-3 py-1.5 text-xs">
					<ChartIcon className="h-3.5 w-3.5" /> {t("result.openStats")}
				</Link>

				{onForget && (
					<button type="button" onClick={onForget} className="btn-quiet">
						{t("history.forget")}
					</button>
				)}

				{onDelete && (
					<button
						type="button"
						onClick={onDelete}
						className="btn-quiet text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-950/40">
						<TrashIcon className="h-3.5 w-3.5" /> {t("history.delete")}
					</button>
				)}
			</div>
		</div>
	);
}
