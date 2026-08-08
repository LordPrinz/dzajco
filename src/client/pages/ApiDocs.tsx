import { useI18n } from "@/lib/i18n";

type Endpoint = {
	method: "GET" | "POST" | "PATCH" | "DELETE";
	path: string;
	summary: string;
	auth: string;
	body?: string;
	response: string;
};

const METHOD_TONE: Record<Endpoint["method"], string> = {
	GET: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
	POST: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
	PATCH: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
	DELETE: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
};

const ENDPOINTS: Endpoint[] = [
	{
		method: "POST",
		path: "/api/links",
		summary: "Create a short link.",
		auth: "Anonymous (Turnstile token) or session cookie",
		body: `{
  "url": "https://example.com/a/very/long/path",
  "customName": "spring",          // optional
  "title": "Spring campaign",      // optional, private
  "password": "hunter2",           // optional
  "startsAt": "2026-09-01T08:00:00Z",  // optional
  "expiresAt": "2026-10-01T08:00:00Z", // optional
  "maxClicks": 500,                // optional
  "trackUtm": true,                // signed-in only
  "turnstileToken": "..."          // anonymous only
}`,
		response: `{
  "code": "aq7Ke",
  "shortUrl": "https://dzaj.de/aq7Ke",
  "target": "https://example.com/...",
  "secret": "dz_...",              // anonymous only, shown once
  "hasPassword": false,
  "owned": "anonymous"
}`,
	},
	{
		method: "GET",
		path: "/api/stats/:code",
		summary:
			"Statistics for a link. Without an owner key this returns the click total and country breakdown; with one it returns cities, timeline, referrers, devices and UTM data.",
		auth: "Optional — `x-dzajco-secret` header or `?secret=`",
		response: `{
  "link": { "code": "aq7Ke", "clicks": 42, "status": "active", ... },
  "owner": true,
  "totals": { "clicks": 42, "countries": 7, "cities": 12, ... },
  "timeline": [{ "day": "2026-08-01", "clicks": 5 }],
  "geo": [{ "country": "PL", "city": "Katowice", "clicks": 9, ... }],
  "utm": [{ "source": "newsletter", "clicks": 3, ... }]
}`,
	},
	{
		method: "GET",
		path: "/api/stats/:code/export.csv",
		summary: "Geography as CSV.",
		auth: "Owner key or session",
		response: "country,region,city,clicks",
	},
	{
		method: "GET",
		path: "/api/links",
		summary: "List the links owned by the signed-in account.",
		auth: "Session cookie",
		response: `{ "links": [ { "code": "aq7Ke", ... } ] }`,
	},
	{
		method: "POST",
		path: "/api/links/lookup",
		summary:
			"Resolve a batch of code/secret pairs — how the browser profile is restored after an import.",
		auth: "Owner keys in the body",
		body: `{ "items": [ { "code": "aq7Ke", "secret": "dz_..." } ] }`,
		response: `{ "links": [ { "code": "aq7Ke", ... } ] }`,
	},
	{
		method: "PATCH",
		path: "/api/links/:code",
		summary:
			"Update the target, schedule, password, click limit or enabled state.",
		auth: "Owner key or session",
		body: `{ "expiresAt": null, "disabled": true }`,
		response: `{ "code": "aq7Ke", "status": "disabled", ... }`,
	},
	{
		method: "DELETE",
		path: "/api/links/:code",
		summary: "Delete a link and every aggregate belonging to it.",
		auth: "Owner key or session",
		response: `{ "deleted": true }`,
	},
	{
		method: "GET",
		path: "/api/stats",
		summary: "Site-wide counters.",
		auth: "None",
		response: `{ "links": 1204, "clicks": 91043, "countries": [...] }`,
	},
	{
		method: "POST",
		path: "/api/auth/register",
		summary:
			"Create an account. Sets an HttpOnly session cookie on success.",
		auth: "None (Turnstile token when configured)",
		body: `{ "email": "you@example.com", "password": "at least 8 chars" }`,
		response: `{ "ok": true }`,
	},
	{
		method: "POST",
		path: "/api/auth/login",
		summary:
			"Sign in. A wrong password and an unknown address return the same error, so this cannot be used to enumerate accounts.",
		auth: "None",
		body: `{ "email": "you@example.com", "password": "..." }`,
		response: `{ "ok": true }`,
	},
	{
		method: "GET",
		path: "/api/auth/me",
		summary:
			"The current user, the sign-in methods this deployment offers, and the public Turnstile key.",
		auth: "Optional session cookie",
		response: `{
  "user": { "id": "...", "email": "you@example.com", "provider": "password" },
  "providers": ["password", "github"],
  "turnstileSiteKey": "0x4AAA..."
}`,
	},
];

export default function ApiDocs() {
	const { t } = useI18n();

	return (
		<div className="mx-auto mt-14 max-w-3xl">
			<h1 className="text-3xl font-extrabold sm:text-4xl">{t("nav.api")}</h1>
			<p className="mt-3 leading-relaxed text-muted">
				A small JSON API. Every endpoint is rate limited per IP (or per account
				when signed in); creating links additionally requires a Turnstile token
				when you are not signed in. Errors come back as{" "}
				<code className="rounded bg-sunken px-1.5 py-0.5 text-xs">
					{`{ "error": "...", "code": "..." }`}
				</code>{" "}
				with a machine-readable <code>code</code>.
			</p>

			<div className="mt-8 space-y-4">
				{ENDPOINTS.map((endpoint) => (
					<article key={`${endpoint.method}-${endpoint.path}`} className="panel p-5 sm:p-6">
						<header className="flex flex-wrap items-center gap-2">
							<span
								className={`rounded-md px-2 py-1 font-mono text-xs font-bold ${
									METHOD_TONE[endpoint.method]
								}`}>
								{endpoint.method}
							</span>
							<code className="font-mono text-sm font-bold text-ink">
								{endpoint.path}
							</code>
						</header>

						<p className="mt-3 text-sm leading-relaxed text-muted">
							{endpoint.summary}
						</p>

						<p className="mt-2 text-xs text-faint">
							<span className="font-bold uppercase tracking-wide">Auth</span> ·{" "}
							{endpoint.auth}
						</p>

						{endpoint.body && (
							<Snippet title="Request" code={endpoint.body} />
						)}
						<Snippet title="Response" code={endpoint.response} />
					</article>
				))}
			</div>
		</div>
	);
}

function Snippet({ title, code }: { title: string; code: string }) {
	return (
		<div className="mt-3">
			<div className="label mb-1">{title}</div>
			<pre className="overflow-x-auto rounded-xl border border-edge bg-sunken p-3 text-xs leading-relaxed text-ink">
				<code>{code}</code>
			</pre>
		</div>
	);
}
