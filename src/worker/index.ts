import { Hono } from "hono";
import type { AppContext, Env } from "./env";
import { looksLikeCode } from "@shared/codes";
import { readSession } from "./lib/session";
import { fail } from "./lib/responses";
import linksRoutes from "./routes/links";
import statsRoutes from "./routes/stats";
import authRoutes from "./routes/auth";
import resolveRoutes from "./routes/resolve";
import { countClick, redirectResponse, resolveLink, statusForReason } from "./redirect";
import { getLinkCached } from "./lib/links";

const api = new Hono<AppContext>().basePath("/api");

// Every API route can ask for the caller's identity; routes that require one
// check for null themselves.
api.use("*", async (c, next) => {
	try {
		c.set("userId", await readSession(c));
	} catch {
		c.set("userId", null);
	}
	await next();
});

api.route("/links", linksRoutes);
api.route("/stats", statsRoutes);
api.route("/auth", authRoutes);
api.route("/resolve", resolveRoutes);

api.get("/health", (c) => c.json({ ok: true }));
api.all("*", (c) => fail(c, 404, "no_route", "No such endpoint."));

api.onError((error, c) => {
	console.error("api error", error);
	return fail(c, 500, "internal", "Something went wrong.");
});

/**
 * Security headers for HTML responses.
 *
 * The CSP allows Turnstile (challenges.cloudflare.com), Google Fonts and
 * OpenStreetMap tiles, and nothing else. `frame-ancestors 'none'` matters more
 * than usual here: a shortener embedded in someone else's page is a clickjacking
 * primitive.
 */
const CSP = [
	"default-src 'self'",
	"script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com",
	"style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
	"font-src 'self' https://fonts.gstatic.com data:",
	// Both forms are needed: a CSP wildcard matches subdomains only, and OSM
	// serves tiles from the apex `tile.openstreetmap.org` as well as a/b/c.
	"img-src 'self' data: blob: https://tile.openstreetmap.org https://*.tile.openstreetmap.org https://avatars.githubusercontent.com https://lh3.googleusercontent.com",
	"connect-src 'self'",
	"frame-src https://challenges.cloudflare.com",
	"frame-ancestors 'none'",
	"base-uri 'self'",
	"form-action 'self'",
].join("; ");

function withSecurityHeaders(response: Response): Response {
	const out = new Response(response.body, response);
	out.headers.set("content-security-policy", CSP);
	out.headers.set("x-content-type-options", "nosniff");
	out.headers.set("referrer-policy", "strict-origin-when-cross-origin");
	out.headers.set("x-frame-options", "DENY");
	out.headers.set(
		"permissions-policy",
		"geolocation=(), microphone=(), camera=(), payment=()"
	);
	return out;
}

/** Serves the SPA shell, optionally with a non-200 status for blocked links. */
async function serveApp(env: Env, request: Request, status = 200): Promise<Response> {
	const url = new URL(request.url);

	// Ask for the root, not `/index.html` — the asset server normalises the
	// latter with a 307 redirect, which would fail the `ok` check below.
	const shell = await env.ASSETS.fetch(
		new Request(`${url.origin}/`, { headers: request.headers })
	);

	if (!shell.ok) return new Response("Not found", { status: 404 });

	return withSecurityHeaders(
		new Response(shell.body, {
			status,
			headers: {
				"content-type": "text/html; charset=utf-8",
				// The shell is tiny and the app is versioned by asset hash, so
				// revalidating each time keeps deploys instant.
				"cache-control": "no-cache",
			},
		})
	);
}

const ROBOTS = `User-agent: *
Allow: /$
Allow: /about
Allow: /privacy-policy
Allow: /api-docs
Disallow: /dashboard
Disallow: /history
Disallow: /api/
Crawl-delay: 1
`;

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const url = new URL(request.url);
		const path = url.pathname;

		if (path.startsWith("/api/")) {
			return withSecurityHeaders(await api.fetch(request, env, ctx));
		}

		if (path === "/robots.txt") {
			return new Response(ROBOTS, {
				headers: { "content-type": "text/plain; charset=utf-8" },
			});
		}

		// Real files (JS, CSS, images) come straight from the asset store.
		// `not_found_handling = "none"` means a miss returns 404 and falls
		// through to the short-link logic below.
		const asset = await env.ASSETS.fetch(request);
		if (asset.status !== 404) {
			return path.endsWith(".html") ? withSecurityHeaders(asset) : asset;
		}

		const segments = path.split("/").filter(Boolean);

		// `/:code` — the redirect itself. Everything else is an app route.
		// HEAD is included so link checkers and unfurlers get the same answer a
		// browser would, rather than the SPA shell.
		const readMethod = request.method === "GET" || request.method === "HEAD";

		if (segments.length === 1 && looksLikeCode(segments[0]) && readMethod) {
			const code = segments[0];
			const resolution = await resolveLink(env, code, url);

			if (resolution.kind === "redirect") {
				const link = await getLinkCached(env, code);
				ctx.waitUntil(
					countClick(env, request, code, url, Boolean(link?.track_utm))
				);
				return redirectResponse(resolution.target);
			}

			// Blocked: hand off to the SPA, which asks /api/resolve for details
			// and renders the matching screen.
			return serveApp(env, request, statusForReason(resolution.reason));
		}

		return serveApp(env, request);
	},
} satisfies ExportedHandler<Env>;
