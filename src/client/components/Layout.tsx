import { Link, NavLink, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import { useTheme } from "@/lib/theme";
import { MoonIcon, SunIcon } from "./Icons";

const NAV: { to: string; key: MessageKey; auth?: boolean }[] = [
	{ to: "/history", key: "nav.history" },
	{ to: "/dashboard", key: "nav.dashboard", auth: true },
	{ to: "/about", key: "nav.about" },
	{ to: "/api-docs", key: "nav.api" },
];

const FOOTER: { to: string; key: MessageKey }[] = [
	{ to: "/", key: "nav.home" },
	{ to: "/about", key: "nav.about" },
	{ to: "/history", key: "nav.history" },
	{ to: "/api-docs", key: "nav.api" },
	{ to: "/privacy-policy", key: "nav.privacy" },
];

export function Wordmark({ className = "" }: { className?: string }) {
	return (
		<span className={`font-extrabold tracking-tight ${className}`}>
			dzaj<span className="text-jajco-500">co</span>
		</span>
	);
}

export default function Layout({ children }: { children: ReactNode }) {
	const { t, lang, setLang } = useI18n();
	const { user, signOut } = useSession();
	const [theme, toggleTheme] = useTheme();
	const { pathname } = useLocation();

	return (
		<div className="flex min-h-full flex-col">
			<header className="gridLayout border-b border-edge/70 bg-canvas/80 backdrop-blur">
				<div className="center flex h-16 items-center justify-between gap-4">
					<Link to="/" className="text-xl" aria-label="dzajco">
						<Wordmark />
					</Link>

					<nav className="flex items-center gap-1">
						{NAV.filter((item) => !item.auth || user).map((item) => (
							<NavLink
								key={item.to}
								to={item.to}
								className={({ isActive }) =>
									`hidden rounded-lg px-3 py-2 text-sm font-semibold transition sm:block ${
										isActive
											? "text-jajco-600 dark:text-jajco-400"
											: "text-muted hover:text-ink"
									}`
								}>
								{t(item.key)}
							</NavLink>
						))}

						<button
							type="button"
							onClick={() => setLang(lang === "en" ? "pl" : "en")}
							className="btn-quiet uppercase"
							aria-label={t("common.language")}>
							{lang === "en" ? "PL" : "EN"}
						</button>

						<button
							type="button"
							onClick={toggleTheme}
							className="btn-quiet"
							aria-label={t("common.theme")}>
							{theme === "dark" ? (
								<SunIcon className="h-4 w-4" />
							) : (
								<MoonIcon className="h-4 w-4" />
							)}
						</button>

						{user ? (
							<div className="flex items-center gap-2 pl-1">
								{user.avatarUrl && (
									<img
										src={user.avatarUrl}
										alt=""
										className="h-7 w-7 rounded-full border border-edge"
										referrerPolicy="no-referrer"
									/>
								)}
								<button
									type="button"
									onClick={() => void signOut()}
									className="btn-quiet">
									{t("nav.logout")}
								</button>
							</div>
						) : (
							pathname !== "/login" && (
								<Link to="/login" className="btn-quiet">
									{t("nav.login")}
								</Link>
							)
						)}
					</nav>
				</div>
			</header>

			<div className="gridLayout flex-1">
				<main className="center w-full pb-20">{children}</main>
			</div>

			<footer className="gridLayout border-t border-edge/70 py-6">
				<div className="center flex flex-wrap items-center justify-center gap-x-1 gap-y-2 text-sm text-muted">
					{FOOTER.map((item, index) => (
						<span key={item.to} className="flex items-center">
							{index > 0 && <span className="px-1 text-edge">·</span>}
							<Link
								to={item.to}
								className="rounded px-2 py-1 transition hover:text-jajco-600 dark:hover:text-jajco-400">
								{t(item.key)}
							</Link>
						</span>
					))}
				</div>
			</footer>
		</div>
	);
}
