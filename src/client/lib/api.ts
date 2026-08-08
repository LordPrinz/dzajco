import type {
	ApiError,
	CreateLinkRequest,
	CreateLinkResponse,
	GlobalStats,
	LinkStats,
	LinkSummary,
	MeResponse,
} from "@shared/types";

export class ApiFailure extends Error {
	readonly code: string;
	readonly status: number;
	readonly retryAfter?: number;

	constructor(status: number, payload: Partial<ApiError>) {
		super(payload.error ?? "Request failed");
		this.code = payload.code ?? "unknown";
		this.status = status;
		this.retryAfter = payload.retryAfter;
	}
}

async function request<T>(
	path: string,
	init: RequestInit & { secret?: string } = {}
): Promise<T> {
	const { secret, ...rest } = init;
	const headers = new Headers(rest.headers);

	if (rest.body) headers.set("content-type", "application/json");
	if (secret) headers.set("x-dzajco-secret", secret);

	const response = await fetch(`/api${path}`, {
		...rest,
		headers,
		credentials: "same-origin",
	});

	if (!response.ok) {
		let payload: Partial<ApiError> = {};
		try {
			payload = (await response.json()) as Partial<ApiError>;
		} catch {
			// Non-JSON error (proxy, edge). The status still tells us enough.
		}
		throw new ApiFailure(response.status, payload);
	}

	if (response.status === 204) return undefined as T;
	return (await response.json()) as T;
}

export const api = {
	me: () => request<MeResponse>("/auth/me"),

	logout: () => request<{ ok: boolean }>("/auth/logout", { method: "POST" }),

	createLink: (body: CreateLinkRequest) =>
		request<CreateLinkResponse>("/links", {
			method: "POST",
			body: JSON.stringify(body),
		}),

	myLinks: () => request<{ links: LinkSummary[] }>("/links"),

	/** Resolves anonymous code/secret pairs held in localStorage. */
	lookup: (items: { code: string; secret: string }[]) =>
		request<{ links: LinkSummary[] }>("/links/lookup", {
			method: "POST",
			body: JSON.stringify({ items }),
		}),

	updateLink: (
		code: string,
		body: Partial<CreateLinkRequest> & { disabled?: boolean },
		secret?: string
	) =>
		request<LinkSummary>(`/links/${encodeURIComponent(code)}`, {
			method: "PATCH",
			body: JSON.stringify(body),
			secret,
		}),

	deleteLink: (code: string, secret?: string) =>
		request<{ deleted: boolean }>(`/links/${encodeURIComponent(code)}`, {
			method: "DELETE",
			body: JSON.stringify({}),
			secret,
		}),

	stats: (code: string, secret?: string) =>
		request<LinkStats>(`/stats/${encodeURIComponent(code)}`, { secret }),

	globalStats: () => request<GlobalStats>("/stats"),

	resolve: (code: string) =>
		request<{ state: string; target?: string; startsAt?: string | null }>(
			`/resolve/${encodeURIComponent(code)}`
		),

	unlock: (code: string, password: string) =>
		request<{ target: string }>(`/resolve/${encodeURIComponent(code)}/unlock`, {
			method: "POST",
			body: JSON.stringify({ password }),
		}),

	csvUrl: (code: string, secret?: string) =>
		`/api/stats/${encodeURIComponent(code)}/export.csv${
			secret ? `?secret=${encodeURIComponent(secret)}` : ""
		}`,
};
