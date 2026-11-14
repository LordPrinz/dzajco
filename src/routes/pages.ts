import { type Context, Hono } from "hono";
import type { Child } from "hono/jsx";
import * as v from "valibot";
import { formBodySchema } from "../domain/schemas";
import type { AppEnv } from "../lib/app-env";
import { readCapped } from "../lib/body";
import { clientIpKey } from "../lib/client-ip";
import { rateLimit } from "../middleware/rate-limit";
import { createLink } from "../services/links";
import { expiresAtFrom, normalizeUrlInput } from "../shared/form";
import { Created } from "../views/Created";
import { Home, type HomeValues } from "../views/Home";
import { Notice } from "../views/Notice";

export const MAX_FORM_BYTES = 8 * 1024;
const NO_STORE = { "Cache-Control": "no-store" };

function render(
  c: Context<AppEnv>,
  page: Child,
  status: 200 | 400 | 403 | 409 | 413 | 415 | 429 | 500 | 503,
) {
  return c.html(`<!doctype html>${page}`, status, NO_STORE);
}

function notice(
  c: Context<AppEnv>,
  status: 403 | 413 | 415 | 429 | 500,
  title: string,
  message: string,
) {
  return render(c, Notice({ nonce: c.var.nonce, title, message }), status);
}

/**
 * Cross-site posts are refused. Browsers send `Sec-Fetch-Site`; when it is missing (old clients) the
 * `Origin` has to be this service itself.
 */
export function isSameOriginPost(c: Context<AppEnv>): boolean {
  const site = c.req.header("Sec-Fetch-Site");
  if (site !== undefined) return site === "same-origin";
  const origin = c.req.header("Origin");
  if (origin === undefined) return false;
  return origin === new URL(c.req.url).origin || origin === new URL(c.env.PUBLIC_ORIGIN).origin;
}

function isUrlEncoded(contentType: string | undefined): boolean {
  return contentType?.split(";")[0]?.trim().toLowerCase() === "application/x-www-form-urlencoded";
}

function field(form: URLSearchParams, name: string): string {
  return form.get(name) ?? "";
}

/** Failure codes of the shared schema check, narrowed to the ones the form can explain. */
function invalidCode(values: HomeValues): string {
  if (values.url.length > 2048) return "url_too_long";
  if (values.customName.length > 128) return "name_too_long";
  return "invalid_body";
}

/** HTML pages: the home form and its no-JS `POST /`. */
export function pageRoutes() {
  const app = new Hono<AppEnv>();

  // Same logging rule as the global handler: request id and error class only, never the message.
  app.onError((error, c) => {
    console.error(`request ${c.get("requestId")} failed: ${error.name}`);
    return notice(c, 500, "Coś poszło nie tak", "Spróbuj ponownie za chwilę.");
  });

  app.get("/", (c) => render(c, Home({ nonce: c.var.nonce }), 200));

  app.post(
    "/",
    async (c, next) => {
      if (isSameOriginPost(c)) return next();
      return notice(c, 403, "Odrzucono żądanie", "Formularz można wysłać tylko z tej strony.");
    },
    rateLimit<AppEnv>("RL_CREATE", (c) => clientIpKey(c.req.raw), {
      onLimited: (c) =>
        notice(
          c,
          429,
          "Za dużo żądań",
          "Utworzono za dużo linków w krótkim czasie. Spróbuj ponownie za minutę.",
        ),
    }),
    async (c) => {
      if (!isUrlEncoded(c.req.header("Content-Type"))) {
        return notice(c, 415, "Nieobsługiwany format", "Wyślij formularz z tej strony.");
      }
      const raw = await readCapped(c.req.raw, MAX_FORM_BYTES);
      if (raw === null) {
        return notice(
          c,
          413,
          "Formularz jest za duży",
          "Skróć dane w formularzu i spróbuj ponownie.",
        );
      }
      const form = new URLSearchParams(raw);
      const values: HomeValues = {
        url: field(form, "url"),
        customName: field(form, "customName"),
        expiry: field(form, "expiry") || "never",
        customDate: field(form, "customDate"),
      };
      const reject = (error: string, status: 400 | 409 | 503) =>
        render(c, Home({ nonce: c.var.nonce, values, error }), status);

      const parsed = v.safeParse(formBodySchema, {
        url: normalizeUrlInput(values.url),
        customName: values.customName,
        expiresAt: expiresAtFrom(values, Date.now(), "Z") ?? "",
      });
      if (!parsed.success) return reject(invalidCode(values), 400);

      const created = await createLink(c.env, parsed.output, c.req.url);
      if (!created.ok) return reject(created.code, created.status);
      return render(c, Created({ nonce: c.var.nonce, link: created }), 200);
    },
  );

  return app;
}
