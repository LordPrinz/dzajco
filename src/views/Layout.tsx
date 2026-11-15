import type { Child } from "hono/jsx";
import { usePage } from "./page-context";
import { ThemeSwitch } from "./ThemeSwitch";

const SITE_NAME = "dzajco";
const DESCRIPTION =
  "Darmowy skracacz linków od Dzajlopment. Własne nazwy, data wygaśnięcia i licznik wejść.";

/** Relative here because the layout does not know the origin; `siteExtras` makes it absolute from `PUBLIC_ORIGIN`. */
export const OG_IMAGE_PATH = "/img/og.jpg";

const NAV = [
  { href: "/", label: "Strona główna" },
  { href: "/about", label: "O nas" },
  { href: "/history", label: "Historia" },
  { href: "/docs/api", label: "API" },
  { href: "/privacy-policy", label: "Prywatność" },
];

/** Stylesheets under `/css` that pages may add; a closed list keeps the `<link>` paths constant. */
export type PageStylesheet = "pages.css" | "stats.css";

export interface LayoutProps {
  nonce: string;
  title?: string;
  /** Module scripts under `/assets`, e.g. `form.js`. */
  scripts?: readonly string[];
  /** Extra stylesheets under `/css` (`pages.css`, `stats.css`), loaded after `app.css`. */
  styles?: readonly PageStylesheet[];
  /**
   * False hides the theme and language switches. The result page does this: they post and redirect,
   * and the redirect would lose the secret key that the page shows only once.
   */
  settings?: boolean;
  children?: Child;
}

export function Layout({
  nonce,
  title,
  scripts = [],
  styles = [],
  settings = true,
  children,
}: LayoutProps) {
  const fullTitle = title ? `${title} | ${SITE_NAME}` : SITE_NAME;
  const { theme } = usePage();
  return (
    // Set on the server, so the first paint already has the chosen theme. `system` leaves it to CSS.
    <html lang="pl" data-theme={theme === "system" ? undefined : theme}>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{fullTitle}</title>
        <meta name="description" content={DESCRIPTION} />
        <meta name="theme-color" content="#fcc011" />
        <meta property="og:site_name" content={SITE_NAME} />
        <meta property="og:type" content="website" />
        <meta property="og:title" content={fullTitle} />
        <meta property="og:description" content={DESCRIPTION} />
        <meta property="og:image" content={OG_IMAGE_PATH} />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/img/logo.svg" type="image/svg+xml" />
        <link
          rel="preload"
          href="/fonts/open-sans-latin.woff2"
          as="font"
          type="font/woff2"
          crossorigin=""
        />
        <link rel="stylesheet" href="/css/app.css" />
        {styles.map((href) => (
          <link rel="stylesheet" href={`/css/${href}`} />
        ))}
      </head>
      <body>
        {settings && (
          <header class="topbar">
            <ThemeSwitch />
          </header>
        )}
        <main class="page">{children}</main>
        <footer class="footer">
          <nav aria-label="Nawigacja w stopce">
            <ul class="footer__list">
              {NAV.map((item) => (
                <li class="footer__item">
                  <a class="footer__link" href={item.href}>
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </footer>
        {/* Filled by the toast module; empty and silent without JavaScript. Present from the start so
            screen readers watch them before the first toast arrives. */}
        <div class="toasts">
          <div class="toasts__region" id="toasts-alert" role="alert" />
          <div class="toasts__region" id="toasts-status" role="status" />
        </div>
        {["theme.js", ...scripts].map((src) => (
          <script type="module" nonce={nonce} src={`/assets/${src}`} />
        ))}
      </body>
    </html>
  );
}
