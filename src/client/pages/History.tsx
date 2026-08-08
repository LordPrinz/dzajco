import { useCallback, useEffect, useRef, useState } from "react";
import type { LinkSummary } from "@shared/types";
import { api } from "@/lib/api";
import {
	exportProfile,
	forgetLink,
	importProfile,
	readProfile,
	secretFor,
} from "@/lib/storage";
import { useI18n } from "@/lib/i18n";
import { useToast } from "@/components/Toast";
import LinkCard from "@/components/LinkCard";
import { DownloadIcon, UploadIcon } from "@/components/Icons";

/**
 * The anonymous owner's view: links created in this browser, resolved against
 * the server using the owner keys held locally.
 */
export default function History() {
	const { t } = useI18n();
	const toast = useToast();
	const fileInput = useRef<HTMLInputElement>(null);

	const [links, setLinks] = useState<LinkSummary[]>([]);
	const [loading, setLoading] = useState(true);
	const [missing, setMissing] = useState(0);

	const load = useCallback(async () => {
		const entries = readProfile();
		if (!entries.length) {
			setLinks([]);
			setMissing(0);
			setLoading(false);
			return;
		}

		try {
			const { links: found } = await api.lookup(
				entries.map((entry) => ({ code: entry.code, secret: entry.secret }))
			);
			setLinks(found);
			// Deleted or expired-away links stay in local storage; say so rather
			// than silently dropping them from the list.
			setMissing(entries.length - found.length);
		} catch {
			toast.error(t("error.generic"));
		} finally {
			setLoading(false);
		}
	}, [t, toast]);

	useEffect(() => {
		void load();
	}, [load]);

	const remove = async (code: string) => {
		if (!confirm(t("history.confirmDelete"))) return;

		try {
			await api.deleteLink(code, secretFor(code));
			forgetLink(code);
			setLinks((current) => current.filter((link) => link.code !== code));
			toast.success(t("history.deleted"));
		} catch {
			toast.error(t("error.generic"));
		}
	};

	const onImport = async (file: File) => {
		try {
			const added = importProfile(await file.text());
			toast.success(t("history.imported", { count: added }));
			await load();
		} catch {
			toast.error(t("history.importFailed"));
		}
	};

	return (
		<div className="mt-12">
			<header className="flex flex-wrap items-start justify-between gap-4">
				<div>
					<h1 className="text-3xl font-extrabold sm:text-4xl">
						{t("history.title")}
					</h1>
					<p className="mt-2 max-w-xl text-sm text-muted">
						{t("history.subtitle")}
					</p>
				</div>

				<div className="flex flex-wrap gap-2">
					<button
						type="button"
						onClick={exportProfile}
						className="btn-ghost px-4 py-2 text-sm">
						<DownloadIcon className="h-4 w-4" /> {t("history.export")}
					</button>
					<button
						type="button"
						onClick={() => fileInput.current?.click()}
						className="btn-ghost px-4 py-2 text-sm">
						<UploadIcon className="h-4 w-4" /> {t("history.import")}
					</button>
					<input
						ref={fileInput}
						type="file"
						accept="application/json,.json"
						className="hidden"
						onChange={(event) => {
							const file = event.target.files?.[0];
							if (file) void onImport(file);
							event.target.value = "";
						}}
					/>
				</div>
			</header>

			{missing > 0 && (
				<p className="mt-6 rounded-xl border border-edge bg-sunken px-4 py-3 text-sm text-muted">
					{t("history.gone")}
				</p>
			)}

			<div className="mt-6 space-y-3">
				{loading ? (
					Array.from({ length: 3 }, (_, index) => (
						<div key={index} className="skeleton h-24 rounded-2xl" />
					))
				) : links.length === 0 ? (
					<p className="py-16 text-center text-muted">{t("history.empty")}</p>
				) : (
					links.map((link) => (
						<LinkCard
							key={link.code}
							link={link}
							statsHref={`/${link.code}/info?key=${encodeURIComponent(
								secretFor(link.code) ?? ""
							)}`}
							onDelete={() => void remove(link.code)}
							onForget={() => {
								forgetLink(link.code);
								setLinks((current) =>
									current.filter((item) => item.code !== link.code)
								);
							}}
						/>
					))
				)}
			</div>
		</div>
	);
}
