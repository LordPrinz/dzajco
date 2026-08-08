import { Navigate, useSearchParams } from "react-router-dom";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import { GithubIcon, GoogleIcon } from "@/components/Icons";
import { Wordmark } from "@/components/Layout";

const ERRORS: Record<string, MessageKey> = {
	state: "login.error.state",
	failed: "login.error.failed",
	cancelled: "login.error.cancelled",
};

export default function Login() {
	const { t } = useI18n();
	const { user, providers, loading } = useSession();
	const [params] = useSearchParams();

	if (loading) {
		return <div className="mt-24 text-center text-muted">{t("common.loading")}</div>;
	}

	if (user) return <Navigate to="/dashboard" replace />;

	const errorKey = ERRORS[params.get("error") ?? ""];

	return (
		<div className="mx-auto mt-20 max-w-md">
			<div className="panel p-8 text-center">
				<div className="text-3xl">
					<Wordmark />
				</div>
				<h1 className="mt-6 text-2xl font-extrabold">{t("login.title")}</h1>
				<p className="mt-2 text-sm text-muted">{t("login.body")}</p>

				{errorKey && (
					<p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
						{t(errorKey)}
					</p>
				)}

				<div className="mt-6 space-y-3">
					{providers.includes("github") && (
						// A full page navigation, not fetch: the OAuth handshake needs
						// the browser to follow the provider's redirects.
						<a href="/api/auth/github" className="btn-ghost w-full">
							<GithubIcon className="h-5 w-5" /> {t("login.github")}
						</a>
					)}

					{providers.includes("google") && (
						<a href="/api/auth/google" className="btn-ghost w-full">
							<GoogleIcon className="h-5 w-5" /> {t("login.google")}
						</a>
					)}

					{providers.length === 0 && (
						<p className="text-sm text-faint">{t("login.unavailable")}</p>
					)}
				</div>

				<p className="mt-6 border-t border-edge pt-4 text-xs leading-relaxed text-faint">
					{t("login.anon")}
				</p>
			</div>
		</div>
	);
}
