import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { api, ApiFailure } from "@/lib/api";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { LockIcon } from "@/components/Icons";

type State =
	| "loading"
	| "password"
	| "not_found"
	| "expired"
	| "scheduled"
	| "disabled"
	| "exhausted";

const TITLES: Record<Exclude<State, "loading" | "password">, MessageKey> = {
	not_found: "gate.notFound.title",
	expired: "gate.expired.title",
	scheduled: "gate.scheduled.title",
	disabled: "gate.disabled.title",
	exhausted: "gate.exhausted.title",
};

const BODIES: Record<Exclude<State, "loading" | "password">, MessageKey> = {
	not_found: "gate.notFound.body",
	expired: "gate.expired.body",
	scheduled: "gate.scheduled.body",
	disabled: "gate.disabled.body",
	exhausted: "gate.exhausted.body",
};

/**
 * What a visitor sees when `/:code` did not redirect.
 *
 * The Worker already decided the outcome and served the shell with a matching
 * HTTP status; this asks the API which case it was so the page can explain it.
 */
export default function Gate() {
	const { code = "" } = useParams();
	const { t, lang } = useI18n();

	const [state, setState] = useState<State>("loading");
	const [startsAt, setStartsAt] = useState<string | null>(null);
	const [password, setPassword] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);

	useEffect(() => {
		let cancelled = false;

		void api
			.resolve(code)
			.then((result) => {
				if (cancelled) return;

				// A link can go live between the Worker's check and this call.
				if (result.state === "ready" && result.target) {
					window.location.replace(result.target);
					return;
				}

				setStartsAt(result.startsAt ?? null);
				setState(result.state as State);
			})
			.catch(() => {
				if (!cancelled) setState("not_found");
			});

		return () => {
			cancelled = true;
		};
	}, [code]);

	const unlock = async (event: FormEvent) => {
		event.preventDefault();
		if (busy) return;

		setBusy(true);
		setError(null);
		try {
			const { target } = await api.unlock(code, password);
			window.location.replace(target);
		} catch (failure) {
			setError(
				failure instanceof ApiFailure && failure.code === "bad_password"
					? t("gate.password.wrong")
					: failure instanceof ApiFailure && failure.code === "rate_limited"
						? t("error.rate_limited")
						: t("error.generic")
			);
			setBusy(false);
		}
	};

	if (state === "loading") {
		return (
			<div className="mx-auto mt-32 max-w-sm text-center text-muted">
				{t("common.loading")}
			</div>
		);
	}

	if (state === "password") {
		return (
			<div className="mx-auto mt-24 max-w-md">
				<div className="panel p-8 text-center">
					<LockIcon className="mx-auto h-10 w-10 text-jajco-500" />
					<h1 className="mt-4 text-2xl font-extrabold">
						{t("gate.password.title")}
					</h1>
					<p className="mt-2 text-sm text-muted">{t("gate.password.body")}</p>

					<form onSubmit={unlock} className="mt-6 space-y-3">
						<label htmlFor="link-password" className="sr-only">
							{t("home.password")}
						</label>
						<input
							id="link-password"
							type="password"
							value={password}
							onChange={(event) => setPassword(event.target.value)}
							className="input-sm text-center"
							autoComplete="off"
							autoFocus
						/>
						{error && <p className="text-sm font-semibold text-red-500">{error}</p>}
						<button type="submit" disabled={busy} className="btn-primary w-full">
							{t("gate.password.submit")}
						</button>
					</form>
				</div>
			</div>
		);
	}

	const date = startsAt
		? new Date(startsAt).toLocaleString(lang, { dateStyle: "long", timeStyle: "short" })
		: "";

	return (
		<div className="mx-auto mt-28 max-w-md text-center">
			<div className="text-6xl" aria-hidden="true">
				🥚
			</div>
			<h1 className="mt-6 text-3xl font-extrabold">{t(TITLES[state])}</h1>
			<p className="mt-3 text-muted">{t(BODIES[state], { date })}</p>
			<Link to="/" className="btn-primary mt-8">
				{t("gate.home")}
			</Link>
		</div>
	);
}
