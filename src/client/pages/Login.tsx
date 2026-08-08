import { useState, type FormEvent } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { api, ApiFailure } from "@/lib/api";
import { translateError, useI18n, type MessageKey } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import { GithubIcon, GoogleIcon } from "@/components/Icons";
import { Wordmark } from "@/components/Layout";
import Field from "@/components/Field";
import Turnstile from "@/components/Turnstile";

const OAUTH_ERRORS: Record<string, MessageKey> = {
	state: "login.error.state",
	failed: "login.error.failed",
	cancelled: "login.error.cancelled",
};

export default function Login() {
	const { t } = useI18n();
	const navigate = useNavigate();
	const { user, providers, turnstileSiteKey, loading, refresh } = useSession();
	const [params] = useSearchParams();

	const [mode, setMode] = useState<"login" | "register">("login");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [token, setToken] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);

	if (loading) {
		return <div className="mt-24 text-center text-muted">{t("common.loading")}</div>;
	}

	if (user) return <Navigate to="/dashboard" replace />;

	const oauthErrorKey = OAUTH_ERRORS[params.get("error") ?? ""];
	const registering = mode === "register";

	const submit = async (event: FormEvent) => {
		event.preventDefault();
		if (busy) return;

		setBusy(true);
		setError(null);
		try {
			if (registering) {
				await api.register(email.trim(), password, token ?? undefined);
			} else {
				await api.login(email.trim(), password);
			}
			// The session cookie is set by the response; re-read it before
			// navigating so the dashboard does not bounce back to /login.
			await refresh();
			navigate("/dashboard", { replace: true });
		} catch (failure) {
			setError(
				failure instanceof ApiFailure
					? translateError(t, failure.code)
					: t("error.generic")
			);
			setBusy(false);
		}
	};

	return (
		<div className="mx-auto mt-20 max-w-md">
			<div className="panel p-8">
				<div className="text-center text-3xl">
					<Wordmark />
				</div>
				<h1 className="mt-6 text-center text-2xl font-extrabold">
					{t(registering ? "login.createTitle" : "login.title")}
				</h1>
				<p className="mt-2 text-center text-sm text-muted">{t("login.body")}</p>

				{oauthErrorKey && (
					<p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
						{t(oauthErrorKey)}
					</p>
				)}

				{providers.includes("password") ? (
					<form onSubmit={submit} className="mt-6 space-y-4">
						<Field
							label={t("login.email")}
							type="email"
							value={email}
							onChange={(event) => setEmail(event.target.value)}
							autoComplete="email"
							required
						/>
						<Field
							label={t("login.password")}
							hint={registering ? t("login.passwordHint") : undefined}
							type="password"
							value={password}
							onChange={(event) => setPassword(event.target.value)}
							autoComplete={registering ? "new-password" : "current-password"}
							required
						/>

						{registering && turnstileSiteKey && (
							<Turnstile siteKey={turnstileSiteKey} onToken={setToken} />
						)}

						{error && (
							<p className="text-sm font-semibold text-red-500" role="alert">
								{error}
							</p>
						)}

						<button type="submit" disabled={busy} className="btn-primary w-full">
							{t(registering ? "login.createSubmit" : "login.submit")}
						</button>

						<button
							type="button"
							className="w-full text-center text-xs font-semibold text-muted transition hover:text-ink"
							onClick={() => {
								setMode(registering ? "login" : "register");
								setError(null);
							}}>
							{t(registering ? "login.toLogin" : "login.toRegister")}
						</button>
					</form>
				) : (
					<p className="mt-6 text-center text-sm text-faint">
						{t("login.unavailable")}
					</p>
				)}

				{/* OAuth appears only when a deployment has configured it. */}
				{(providers.includes("github") || providers.includes("google")) && (
					<>
						<div className="rule my-7">
							<span className="bg-surface">{t("login.or")}</span>
						</div>

						<div className="space-y-3">
							{providers.includes("github") && (
								// A full page navigation, not fetch: the OAuth handshake
								// needs the browser to follow the provider's redirects.
								<a href="/api/auth/github" className="btn-ghost w-full">
									<GithubIcon className="h-5 w-5" /> {t("login.github")}
								</a>
							)}
							{providers.includes("google") && (
								<a href="/api/auth/google" className="btn-ghost w-full">
									<GoogleIcon className="h-5 w-5" /> {t("login.google")}
								</a>
							)}
						</div>
					</>
				)}

				<p className="mt-6 border-t border-edge pt-4 text-center text-xs leading-relaxed text-faint">
					{t("login.anon")}
				</p>
			</div>
		</div>
	);
}
