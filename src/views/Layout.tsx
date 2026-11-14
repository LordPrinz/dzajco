import type { Child } from "hono/jsx";

const SITE_NAME = "dzajco";
const DESCRIPTION =
  "Darmowy skracacz linków od Dzajlopment. Własne nazwy, data wygaśnięcia i licznik wejść.";

const NAV = [
  { href: "/", label: "Strona główna" },
  { href: "/about", label: "O nas" },
  { href: "/history", label: "Historia" },
  { href: "/docs/api", label: "API" },
  { href: "/privacy-policy", label: "Prywatność" },
];

export interface LayoutProps {
  nonce: string;
  title?: string;
  /** Module scripts under `/assets`, e.g. `form.js`. */
  scripts?: readonly string[];
  /** Extra stylesheets under `/css`, e.g. `pages.css`, loaded after `app.css`. */
  styles?: readonly string[];
  children?: Child;
}

export function Layout({ nonce, title, scripts = [], styles = [], children }: LayoutProps) {
  const fullTitle = title ? `${title} | ${SITE_NAME}` : SITE_NAME;
  return (
    <html lang="pl">
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
        <meta property="og:image" content="/img/og.jpg" />
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
        {scripts.map((src) => (
          <script type="module" nonce={nonce} src={`/assets/${src}`} />
        ))}
      </body>
    </html>
  );
}
