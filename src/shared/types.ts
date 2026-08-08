/** Wire types shared by the Worker API and the React client. */

export type ApiError = {
	error: string;
	/** Stable machine-readable code; the UI maps it to a translated message. */
	code: string;
	/** Seconds until a rate-limited caller may retry. */
	retryAfter?: number;
};

export type CreateLinkRequest = {
	url: string;
	customName?: string;
	/** ISO-8601. Link is not live before this. */
	startsAt?: string | null;
	/** ISO-8601. Link stops working after this. */
	expiresAt?: string | null;
	password?: string | null;
	maxClicks?: number | null;
	title?: string | null;
	/** Signed-in only; ignored for anonymous callers. */
	trackUtm?: boolean;
	/** Turnstile token, required for anonymous callers when configured. */
	turnstileToken?: string;
};

export type CreateLinkResponse = {
	code: string;
	shortUrl: string;
	target: string;
	/** Present only for anonymous links, and only in this one response. */
	secret?: string;
	startsAt: string | null;
	expiresAt: string | null;
	hasPassword: boolean;
	owned: "anonymous" | "account";
};

export type LinkSummary = {
	code: string;
	shortUrl: string;
	target: string;
	title: string | null;
	createdAt: string;
	startsAt: string | null;
	expiresAt: string | null;
	hasPassword: boolean;
	maxClicks: number | null;
	disabled: boolean;
	clicks: number;
	lastClickAt: string | null;
	trackUtm: boolean;
	status: LinkStatus;
};

export type LinkStatus = "active" | "scheduled" | "expired" | "disabled" | "exhausted";

export type GeoPoint = {
	country: string;
	region: string;
	city: string;
	lat: number | null;
	lon: number | null;
	clicks: number;
};

export type CountRow = { label: string; clicks: number };

export type UtmRow = {
	source: string;
	medium: string;
	campaign: string;
	term: string;
	content: string;
	clicks: number;
};

export type LinkStats = {
	link: LinkSummary;
	/** True when the caller proved ownership (secret or session). */
	owner: boolean;
	totals: {
		clicks: number;
		countries: number;
		cities: number;
		last7d: number;
		last30d: number;
	};
	timeline: { day: string; clicks: number }[];
	geo: GeoPoint[];
	countries: CountRow[];
	referrers: CountRow[];
	devices: CountRow[];
	browsers: CountRow[];
	/** Only populated for owners of UTM-tracked links. */
	utm: UtmRow[] | null;
};

export type GlobalStats = {
	links: number;
	clicks: number;
	countries: CountRow[];
};

export type SessionUser = {
	id: string;
	name: string | null;
	email: string | null;
	avatarUrl: string | null;
	provider: string;
};

export type MeResponse = {
	user: SessionUser | null;
	turnstileSiteKey: string | null;
	providers: string[];
};

/** Shape persisted in localStorage and produced by "export profile". */
export type OwnerProfile = {
	version: 1;
	exportedAt: string;
	links: OwnerProfileEntry[];
};

export type OwnerProfileEntry = {
	code: string;
	secret: string;
	target: string;
	createdAt: string;
	title?: string | null;
};
