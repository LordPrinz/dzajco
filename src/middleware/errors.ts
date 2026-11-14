import type { Context, ErrorHandler, NotFoundHandler } from "hono";
import type { AppEnv } from "../lib/app-env";

const NOT_FOUND_PAGE =
  '<!doctype html><html lang="en"><meta charset="utf-8"><title>Not found</title><h1>Page not found</h1></html>';
const ERROR_PAGE =
  '<!doctype html><html lang="en"><meta charset="utf-8"><title>Error</title><h1>Something went wrong</h1></html>';

export function apiError(
  c: Context,
  status: 400 | 404 | 409 | 410 | 413 | 415 | 429 | 500 | 503,
  code: string,
  message: string,
) {
  return c.json({ error: { code, message } }, status);
}

function isApi(c: Context): boolean {
  return c.req.path === "/api" || c.req.path.startsWith("/api/");
}

/** Logs only the request id and the error class: messages can carry user input. */
export const onError: ErrorHandler<AppEnv> = (error, c) => {
  console.error(`request ${c.get("requestId")} failed: ${error.name}`);
  if (isApi(c)) return apiError(c, 500, "internal_error", "Internal error");
  return c.html(ERROR_PAGE, 500, { "Cache-Control": "no-store" });
};

export const notFound: NotFoundHandler<AppEnv> = (c) => {
  if (isApi(c)) return apiError(c, 404, "not_found", "Not found");
  return c.html(NOT_FOUND_PAGE, 404);
};
