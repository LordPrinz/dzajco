# 8. Visitor settings rendered into the HTML

- **Status:** Accepted
- **Date:** 2026-11-15

## Decision

- The theme choice (`system`, `light`, `dark`) lives in a `theme` cookie. The server reads it and renders
  `data-theme` on `<html>`, so the first paint already has the right colours. `system` sets no attribute
  and the CSS follows `prefers-color-scheme`.
- The switch is a form that posts to `POST /prefs/theme` (same-origin only), which sets or clears the
  cookie and answers `303` back to a same-site path. `theme.js` sends the same request with `fetch` and
  applies the theme in place, so the page does not reload.
- Views read per-request settings from `PageContext` (a `hono/jsx` context). Routes render pages through
  `renderPage(c, View, props)`, which provides the context.
- Caching: HTML pages stay `Cache-Control: no-store` (each one carries its own CSP nonce), and the Cache API
  only holds link records under an internal origin. A page rendered for one visitor's settings is therefore
  never stored, and the cache key needs no theme part.

## Drivers

- No flash of the wrong theme, and no inline script to prevent it (the CSP allows only nonce scripts).
- The switch has to work without JavaScript.
- A cached page must never be served with someone else's theme.

## Alternatives considered

- **Theme in `localStorage` and a blocking script in `<head>`.** Rejected: it needs JavaScript and an
  inline or render-blocking script, and still flashes when storage is empty.
- **Same HTML for everyone, theme applied only by the client.** Rejected: flashes on every load and does
  nothing without JavaScript.
- **Cache pages at the edge with the theme in the cache key.** Not needed while pages are `no-store`. If
  pages are ever cached, the key must include every setting the HTML depends on.

## Consequences

- Adding a setting means a field in `PageSettings`, a cookie, and a test that the page is still `no-store`.
- The dark tokens appear twice in `app.css`, once for `data-theme="dark"` and once inside the
  `prefers-color-scheme` query for visitors on `system`.
