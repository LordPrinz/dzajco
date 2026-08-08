import type { Context } from "hono";
import type { AppContext } from "../env";
import type { ApiError } from "@shared/types";

/**
 * `code` is the contract the client translates against; `error` is a plain
 * English fallback for anyone hitting the API directly.
 */
export function fail(
	c: Context<AppContext>,
	status: 400 | 401 | 403 | 404 | 409 | 410 | 413 | 425 | 429 | 500,
	code: string,
	message: string,
	extra?: Partial<ApiError>
) {
	return c.json<ApiError>({ error: message, code, ...extra }, status);
}

export function tooManyRequests(c: Context<AppContext>, retryAfter = 60) {
	return c.json<ApiError>(
		{
			error: "Too many requests. Slow down for a moment.",
			code: "rate_limited",
			retryAfter,
		},
		429,
		{ "retry-after": String(retryAfter) }
	);
}

/** Parses a JSON body, returning null instead of throwing on malformed input. */
export async function readJson<T>(c: Context<AppContext>): Promise<T | null> {
	try {
		return (await c.req.json()) as T;
	} catch {
		return null;
	}
}

/**
 * ISO-8601 to epoch seconds.
 * `undefined` means "not supplied", `null` means "explicitly cleared".
 */
export function parseInstant(
	value: string | null | undefined
): number | null | undefined {
	if (value === undefined) return undefined;
	if (value === null || value === "") return null;

	const time = new Date(value).getTime();
	if (!Number.isFinite(time)) return undefined;
	return Math.floor(time / 1000);
}
