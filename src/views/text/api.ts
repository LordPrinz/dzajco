import type { Child } from "hono/jsx";

export interface Endpoint {
  /** Key of the endpoint's prose in `ApiText.endpoints`. */
  id: EndpointId;
  method: "GET" | "POST" | "DELETE";
  path: string;
  /** Status codes in display order; each one keys a response text. */
  statuses: readonly string[];
}

export type EndpointId = "create" | "get" | "stats" | "delete" | "globalStats";

/** The API v1 contract, as served by the Worker. A test keeps this list and the error table complete. */
export const ENDPOINTS: readonly Endpoint[] = [
  {
    id: "create",
    method: "POST",
    path: "/api/v1/links",
    statuses: ["201", "400", "409", "413", "415", "429", "503"],
  },
  { id: "get", method: "GET", path: "/api/v1/links/:id", statuses: ["200", "404", "410", "429"] },
  {
    id: "stats",
    method: "GET",
    path: "/api/v1/links/:id/stats",
    statuses: ["200", "403", "404", "410", "429"],
  },
  {
    id: "delete",
    method: "DELETE",
    path: "/api/v1/links/:id",
    statuses: ["204", "400", "403", "404", "429"],
  },
  { id: "globalStats", method: "GET", path: "/api/v1/stats", statuses: ["200", "429"] },
];

/** Every error code the API can return, with its status. */
export const ERROR_CODES = [
  { status: 400, code: "invalid_json" },
  { status: 400, code: "invalid_body" },
  { status: 400, code: "invalid_url" },
  { status: 400, code: "unsupported_scheme" },
  { status: 400, code: "url_too_long" },
  { status: 400, code: "credentials_not_allowed" },
  { status: 400, code: "own_host" },
  { status: 400, code: "private_target" },
  { status: 400, code: "blocked_target" },
  { status: 400, code: "invalid_name" },
  { status: 400, code: "name_too_long" },
  { status: 400, code: "reserved_name" },
  { status: 400, code: "mixed_script" },
  { status: 400, code: "invalid_expiry" },
  { status: 400, code: "expiry_in_past" },
  { status: 400, code: "expiry_too_far" },
  { status: 400, code: "invalid_key" },
  { status: 403, code: "forbidden" },
  { status: 404, code: "not_found" },
  { status: 409, code: "id_taken" },
  { status: 410, code: "expired" },
  { status: 410, code: "link_disabled" },
  { status: 413, code: "payload_too_large" },
  { status: 415, code: "unsupported_media_type" },
  { status: 429, code: "rate_limited" },
  { status: 500, code: "internal_error" },
  { status: 503, code: "service_unavailable" },
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number]["code"];

/** Routes in the order of the limit texts in `ApiText.limits`. */
export const LIMIT_ROUTES = [
  "POST /api/v1/links",
  "DELETE /api/v1/links/:id",
  "GET /api/v1/links/:id",
  "GET /api/v1/links/:id/stats, GET /api/v1/stats",
] as const;

/** v2 and v1 endpoints in the order of the texts in `ApiText.migration.rows`. */
export const MIGRATION = [
  { v2: "GET /api/urls/{shortUrl}", v3: "GET /api/v1/links/:id" },
  { v2: "GET /api/urls/{shortUrl}/info", v3: "GET /api/v1/links/:id/stats" },
  { v2: "POST /api/urls", v3: "POST /api/v1/links" },
  { v2: "DELETE /api/urls/{shortUrl}", v3: "DELETE /api/v1/links/:id" },
] as const;

/** The prose of the API page in one language. `limits` and `migration.rows` line up with the constants above by index. */
export interface ApiText {
  title: string;
  heading: string;
  lead: (origin: Child) => Child;
  toc: string;
  sections: {
    endpoints: string;
    errors: string;
    limits: string;
    cors: string;
    corsShort: string;
    examples: string;
    migration: string;
  };
  input: string;
  status: string;
  body: string;
  responses: string;
  code: string;
  meaning: string;
  route: string;
  limit: string;
  errorShape: string;
  /** Prose per endpoint; `responses` is keyed by status code. */
  endpoints: Record<
    EndpointId,
    { summary: string; input: string; responses: Readonly<Record<string, string>> }
  >;
  errorCodes: Record<ErrorCode, string>;
  limitsIntro: Child;
  limits: readonly string[];
  cors: readonly Child[];
  examples: {
    create: string;
    response: string;
    stats: string;
    delete: string;
    /** Placeholder for the key in the curl examples. */
    key: string;
    longPath: string;
    name: string;
    keySample: string;
    partial: Child;
  };
  migration: {
    intro: Child;
    v2: string;
    v1: string;
    changes: string;
    rows: readonly string[];
    errors: Child;
  };
}
