import type { Context, ErrorHandler, NotFoundHandler } from "hono";
import type { AppEnv } from "../lib/app-env";
import { Notice } from "../views/Notice";

const ERROR_PAGE =
  '<!doctype html><html lang="pl"><meta charset="utf-8"><title>Błąd</title><h1>Coś poszło nie tak</h1></html>';

export function apiError(
  c: Context,
  status: 400 | 403 | 404 | 409 | 410 | 413 | 415 | 429 | 500 | 503,
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
  const page = Notice({
    nonce: c.var.nonce,
    title: "Nie znaleziono strony",
    message: "Taka strona nie istnieje.",
  });
  return c.html(`<!doctype html>${page}`, 404, { "Cache-Control": "no-store" });
};
