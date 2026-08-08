import { useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { CreateLinkRequest, CreateLinkResponse } from "@shared/types";
import { validateCustomName } from "@shared/codes";
import { api, ApiFailure } from "@/lib/api";
import { rememberLink } from "@/lib/storage";
import { translateError, useI18n } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import { useToast } from "@/components/Toast";
import { Wordmark } from "@/components/Layout";
import Collapse from "@/components/Collapse";
import Field, { Toggle } from "@/components/Field";
import Turnstile from "@/components/Turnstile";
import CopyButton from "@/components/CopyButton";
import QrCard from "@/components/QrCard";
import { ChartIcon, LockIcon, QrIcon } from "@/components/Icons";

/** Relative presets, matching the original expiry picker. */
const EXPIRY_PRESETS = [
	{ value: "never", labelEn: "Never", labelPl: "Nigdy" },
	{ value: "1h", labelEn: "1 hour", labelPl: "1 godzina" },
	{ value: "1d", labelEn: "1 day", labelPl: "1 dzień" },
	{ value: "7d", labelEn: "7 days", labelPl: "7 dni" },
	{ value: "30d", labelEn: "30 days", labelPl: "30 dni" },
	{ value: "custom", labelEn: "Custom…", labelPl: "Własna…" },
] as const;

type Preset = (typeof EXPIRY_PRESETS)[number]["value"];

function presetToIso(preset: Preset): string | null {
	const now = Date.now();
	const offsets: Partial<Record<Preset, number>> = {
		"1h": 3_600_000,
		"1d": 86_400_000,
		"7d": 7 * 86_400_000,
		"30d": 30 * 86_400_000,
	};
	const offset = offsets[preset];
	return offset ? new Date(now + offset).toISOString() : null;
}

/** `datetime-local` gives a local wall-clock string; the API wants an instant. */
function localToIso(value: string): string | null {
	if (!value) return null;
	const time = new Date(value).getTime();
	return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

export default function Home() {
	const { t, lang } = useI18n();
	const toast = useToast();
	const navigate = useNavigate();
	const { user, turnstileSiteKey } = useSession();

	const [url, setUrl] = useState("");
	const [customName, setCustomName] = useState("");
	const [title, setTitle] = useState("");
	const [password, setPassword] = useState("");
	const [startsAt, setStartsAt] = useState("");
	const [expiryPreset, setExpiryPreset] = useState<Preset>("never");
	const [customExpiry, setCustomExpiry] = useState("");
	const [maxClicks, setMaxClicks] = useState("");
	const [trackUtm, setTrackUtm] = useState(false);

	const [token, setToken] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const [result, setResult] = useState<CreateLinkResponse | null>(null);

	const [statsQuery, setStatsQuery] = useState("");

	const nameError = useMemo(() => {
		if (!customName) return null;
		const error = validateCustomName(customName);
		return error ? translateError(t, `name_${error}`) : null;
	}, [customName, t]);

	const reset = () => {
		setUrl("");
		setCustomName("");
		setTitle("");
		setPassword("");
		setStartsAt("");
		setExpiryPreset("never");
		setCustomExpiry("");
		setMaxClicks("");
		setTrackUtm(false);
		setResult(null);
	};

	const submit = async (event: FormEvent) => {
		event.preventDefault();
		if (busy) return;

		if (!url.trim()) return toast.error(t("error.url_invalid"));
		if (nameError) return toast.error(nameError);

		const expiresAt =
			expiryPreset === "custom"
				? localToIso(customExpiry)
				: presetToIso(expiryPreset);

		const body: CreateLinkRequest = {
			url: url.trim(),
			customName: customName.trim() || undefined,
			title: title.trim() || undefined,
			password: password || undefined,
			startsAt: localToIso(startsAt),
			expiresAt,
			maxClicks: maxClicks ? Number(maxClicks) : undefined,
			trackUtm: user ? trackUtm : undefined,
			turnstileToken: token ?? undefined,
		};

		setBusy(true);
		try {
			const created = await api.createLink(body);

			// The secret is shown exactly once. Persist it before rendering, so a
			// refresh mid-celebration does not lose the only proof of ownership.
			if (created.secret) {
				rememberLink({
					code: created.code,
					secret: created.secret,
					target: created.target,
					createdAt: new Date().toISOString(),
					title: title.trim() || null,
				});
			}

			setResult(created);
		} catch (error) {
			toast.error(
				error instanceof ApiFailure
					? translateError(t, error.code)
					: t("error.generic")
			);
		} finally {
			setBusy(false);
		}
	};

	const openStats = (event: FormEvent) => {
		event.preventDefault();
		const raw = statsQuery.trim();
		if (!raw) return;

		// Accept a full short URL or a bare code.
		const code = raw.includes("/")
			? (raw.split("/").filter(Boolean).pop() ?? raw)
			: raw;

		navigate(`/${encodeURIComponent(code)}/info`);
	};

	return (
		<div className="pt-10 sm:pt-16">
			<header className="flex flex-col items-center text-center">
				<h1 className="pb-5 text-5xl sm:text-6xl">
					<Wordmark />
				</h1>
				<p className="max-w-xl text-lg text-muted sm:text-xl">
					{t("home.tagline")}
				</p>
			</header>

			{result ? (
				<Result result={result} onAnother={reset} />
			) : (
				<form onSubmit={submit} className="mx-auto mt-10 max-w-3xl">
					<div className="relative">
						<label htmlFor="long-url" className="sr-only">
							{t("home.placeholder")}
						</label>
						<input
							id="long-url"
							name="url"
							type="text"
							inputMode="url"
							autoComplete="off"
							spellCheck={false}
							value={url}
							onChange={(event) => setUrl(event.target.value)}
							placeholder={t("home.placeholder")}
							className="input pr-36 sm:pr-40"
						/>
						<button
							type="submit"
							disabled={busy}
							className="btn-primary absolute right-1.5 top-1.5 h-[calc(100%-0.75rem)] px-6 text-sm sm:text-base">
							{busy ? "…" : t("home.submit")}
						</button>
					</div>

					<Collapse openLabel={t("home.more")} closeLabel={t("home.less")}>
						<div className="grid gap-5 sm:grid-cols-2">
							<Field
								label={t("home.customName")}
								hint={t("home.customNameHint")}
								error={nameError}
								value={customName}
								onChange={(event) => setCustomName(event.target.value)}
								placeholder="my-link"
								autoComplete="off"
								spellCheck={false}
							/>

							<Field
								label={t("home.title")}
								hint={t("home.titleHint")}
								value={title}
								onChange={(event) => setTitle(event.target.value)}
								placeholder="Spring campaign"
								maxLength={120}
							/>

							<Field
								label={t("home.password")}
								hint={t("home.passwordHint")}
								type="password"
								value={password}
								onChange={(event) => setPassword(event.target.value)}
								autoComplete="new-password"
							/>

							<Field
								label={t("home.maxClicks")}
								hint={t("home.maxClicksHint")}
								type="number"
								min={1}
								value={maxClicks}
								onChange={(event) => setMaxClicks(event.target.value)}
								placeholder="∞"
							/>

							<Field
								label={t("home.startsAt")}
								hint={t("home.startsAtHint")}
								type="datetime-local"
								value={startsAt}
								onChange={(event) => setStartsAt(event.target.value)}
							/>

							<Field label={t("home.expiresAt")} hint={t("home.expiresAtHint")}>
								<div className="space-y-2">
									<select
										value={expiryPreset}
										onChange={(event) =>
											setExpiryPreset(event.target.value as Preset)
										}
										className="input-sm">
										{EXPIRY_PRESETS.map((preset) => (
											<option key={preset.value} value={preset.value}>
												{lang === "pl" ? preset.labelPl : preset.labelEn}
											</option>
										))}
									</select>

									{expiryPreset === "custom" && (
										<input
											type="datetime-local"
											value={customExpiry}
											onChange={(event) => setCustomExpiry(event.target.value)}
											className="input-sm animate-fade-up"
										/>
									)}
								</div>
							</Field>

							<div className="sm:col-span-2">
								<Toggle
									label={t("home.utm")}
									hint={user ? t("home.utmHint") : t("home.utmLocked")}
									checked={trackUtm}
									onChange={setTrackUtm}
									disabled={!user}
								/>
							</div>
						</div>

						<p className="mt-5 border-t border-edge pt-4 text-xs text-faint">
							{t("home.autoNameNote")}
						</p>
					</Collapse>

					{/* Anonymous callers clear a bot check; signed-in users already did. */}
					{!user && turnstileSiteKey && (
						<div className="mt-5 flex justify-center">
							<Turnstile siteKey={turnstileSiteKey} onToken={setToken} />
						</div>
					)}
				</form>
			)}

			<form onSubmit={openStats} className="mx-auto mt-14 max-w-3xl">
				<h2 className="rule">
					<span>{t("home.statsHeading")}</span>
				</h2>
				<div className="relative">
					<label htmlFor="stats-query" className="sr-only">
						{t("home.statsPlaceholder")}
					</label>
					<input
						id="stats-query"
						value={statsQuery}
						onChange={(event) => setStatsQuery(event.target.value)}
						placeholder={t("home.statsPlaceholder")}
						className="input pr-40 sm:pr-48"
						autoComplete="off"
						spellCheck={false}
					/>
					<button
						type="submit"
						className="btn-ghost absolute right-1.5 top-1.5 h-[calc(100%-0.75rem)] px-5 text-sm">
						{t("home.statsSubmit")}
					</button>
				</div>
			</form>

			<Features />
		</div>
	);
}

/* ------------------------------------------------------------------ */

function Result({
	result,
	onAnother,
}: {
	result: CreateLinkResponse;
	onAnother: () => void;
}) {
	const { t } = useI18n();

	return (
		<div className="mx-auto mt-10 max-w-3xl animate-fade-up space-y-4">
			<div className="panel p-6 sm:p-8">
				<h2 className="text-sm font-bold uppercase tracking-wide text-muted">
					{t("result.ready")}
				</h2>

				<div className="mt-3 flex flex-wrap items-center gap-3">
					<a
						href={result.shortUrl}
						target="_blank"
						rel="noreferrer"
						className="break-all text-2xl font-extrabold text-jajco-600 hover:underline dark:text-jajco-400">
						{result.shortUrl.replace(/^https?:\/\//, "")}
					</a>
					<CopyButton value={result.shortUrl} />
				</div>

				<div className="mt-4 flex flex-wrap items-center gap-2">
					{result.hasPassword && (
						<span className="chip">
							<LockIcon className="h-3.5 w-3.5" /> {t("home.password")}
						</span>
					)}
					{result.expiresAt && (
						<span className="chip">
							{t("stats.expires")}:{" "}
							{new Date(result.expiresAt).toLocaleString()}
						</span>
					)}
					{result.startsAt && (
						<span className="chip">
							{t("stats.starts")}: {new Date(result.startsAt).toLocaleString()}
						</span>
					)}
				</div>

				<div className="mt-6 grid gap-8 border-t border-edge pt-6 sm:grid-cols-[auto,1fr]">
					<div>
						<h3 className="label flex items-center gap-1.5">
							<QrIcon className="h-3.5 w-3.5" /> {t("result.qr")}
						</h3>
						<QrCard url={result.shortUrl} />
					</div>

					<div className="flex flex-col justify-between gap-4">
						{result.secret && (
							<div className="rounded-xl border border-jajco-300 bg-jajco-50 p-4 dark:border-jajco-700 dark:bg-jajco-950/40">
								<h3 className="text-sm font-bold text-jajco-900 dark:text-jajco-200">
									{t("result.secretTitle")}
								</h3>
								<p className="mt-1 text-xs leading-relaxed text-jajco-900/80 dark:text-jajco-200/80">
									{t("result.secretBody")}
								</p>
								<code className="mt-3 block break-all rounded-lg bg-surface px-3 py-2 font-mono text-xs text-ink">
									{result.secret}
								</code>
								<div className="mt-2">
									<CopyButton
										value={result.secret}
										label={t("result.secretCopy")}
										className="btn-ghost px-3 py-1.5 text-xs"
									/>
								</div>
							</div>
						)}

						<div className="flex flex-wrap gap-2">
							<Link
								to={`/${result.code}/info`}
								className="btn-ghost px-4 py-2 text-sm">
								<ChartIcon className="h-4 w-4" /> {t("result.openStats")}
							</Link>
							<button
								type="button"
								onClick={onAnother}
								className="btn-primary px-4 py-2 text-sm">
								{t("result.another")}
							</button>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}

function Features() {
	const { lang } = useI18n();

	// Short, concrete feature blurbs. Kept out of the message tables because
	// they are marketing copy rather than UI strings.
	const items =
		lang === "pl"
			? [
					["🔗", "Własne nazwy", "Wybierz własny adres albo pozwól nam wygenerować krótki, jednoznaczny kod."],
					["📊", "Statystyki", "Kraje, miejscowości, źródła wejść i urządzenia — na mapie i w liczbach."],
					["🔒", "Hasło i terminy", "Chroń link hasłem, ustaw datę startu, wygaśnięcia lub limit kliknięć."],
					["📱", "Kody QR", "Pobierz kod QR w PNG lub SVG, gotowy do druku."],
				]
			: [
					["🔗", "Custom names", "Pick your own address, or let us generate a short, unambiguous code."],
					["📊", "Statistics", "Countries, cities, referrers and devices — on a map and in numbers."],
					["🔒", "Passwords and schedules", "Protect a link with a password, set a start date, an expiry or a click limit."],
					["📱", "QR codes", "Download a QR code as PNG or SVG, ready to print."],
				];

	return (
		<section className="mx-auto mt-20 grid max-w-4xl gap-2 sm:grid-cols-2">
			{items.map(([icon, title, body]) => (
				<div key={title} className="flex items-start gap-3 p-4">
					<span className="mt-0.5 text-3xl" aria-hidden="true">
						{icon}
					</span>
					<div className="space-y-1">
						<h3 className="font-bold text-ink">{title}</h3>
						<p className="text-sm leading-relaxed text-muted">{body}</p>
					</div>
				</div>
			))}
		</section>
	);
}
