import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import type { LinkSummary } from "@shared/types";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import { useToast } from "@/components/Toast";
import LinkCard from "@/components/LinkCard";
import StatTile from "@/components/charts/StatTile";

export default function Dashboard() {
	const { t } = useI18n();
	const toast = useToast();
	const { user, loading: sessionLoading } = useSession();

	const [links, setLinks] = useState<LinkSummary[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		if (!user) return;

		let cancelled = false;
		void api
			.myLinks()
			.then(({ links: found }) => {
				if (!cancelled) setLinks(found);
			})
			.catch(() => {
				if (!cancelled) toast.error(t("error.generic"));
			})
			.finally(() => {
				if (!cancelled) setLoading(false);
			});

		return () => {
			cancelled = true;
		};
	}, [user, t, toast]);

	if (sessionLoading) {
		return <div className="mt-24 text-center text-muted">{t("common.loading")}</div>;
	}

	if (!user) return <Navigate to="/login" replace />;

	const totalClicks = links.reduce((sum, link) => sum + link.clicks, 0);
	const active = links.filter((link) => link.status === "active").length;

	const remove = async (code: string) => {
		if (!confirm(t("history.confirmDelete"))) return;

		try {
			await api.deleteLink(code);
			setLinks((current) => current.filter((link) => link.code !== code));
			toast.success(t("history.deleted"));
		} catch {
			toast.error(t("error.generic"));
		}
	};

	return (
		<div className="mt-12">
			<header>
				<h1 className="text-3xl font-extrabold sm:text-4xl">{t("dashboard.title")}</h1>
				<p className="mt-2 text-sm text-muted">
					{t("dashboard.signedInAs", { name: user.name ?? user.email ?? user.provider })}
				</p>
			</header>

			<section className="mt-6 grid gap-3 sm:grid-cols-3">
				<StatTile label={t("about.links")} value={links.length} />
				<StatTile label={t("stats.clicks")} value={totalClicks.toLocaleString()} />
				<StatTile label={t("status.active")} value={active} />
			</section>

			<div className="mt-6 space-y-3">
				{loading ? (
					Array.from({ length: 3 }, (_, index) => (
						<div key={index} className="skeleton h-24 rounded-2xl" />
					))
				) : links.length === 0 ? (
					<p className="py-16 text-center text-muted">{t("dashboard.empty")}</p>
				) : (
					links.map((link) => (
						<LinkCard
							key={link.code}
							link={link}
							statsHref={`/${link.code}/info`}
							onDelete={() => void remove(link.code)}
						/>
					))
				)}
			</div>
		</div>
	);
}
