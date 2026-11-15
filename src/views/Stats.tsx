import { withoutProtocol } from "../shared/short-url";
import { type CountryRow, countryName } from "../shared/stats";
import { formatUtc } from "./format";
import { Header } from "./Header";
import { Layout } from "./Layout";
import { usePage } from "./page-context";

const TOP_COUNTRIES = 10;

export interface StatsProps {
  nonce: string;
  id: string;
  /** Full short URL, e.g. `https://dzaj.de/abc`. */
  shortUrl: string;
  target: string;
  /** Epoch ms. */
  createdAt: number;
  /** Epoch ms, or null for a link that never expires. */
  expiresAt: number | null;
  visits: number;
  countries: readonly CountryRow[];
  partial: boolean;
  /** `mailto:` href from `reportAbuseLink`, or null when no address is configured. */
  reportHref: string | null;
}

/**
 * Public stats of a link: the visit counter and the countries. Cities and the map belong to the owner;
 * their section stays hidden and empty until `stats.js` has fetched them with the key.
 */
export function Stats(props: StatsProps) {
  const {
    nonce,
    id,
    shortUrl,
    target,
    createdAt,
    expiresAt,
    visits,
    countries,
    partial,
    reportHref,
  } = props;
  const top = countries.slice(0, TOP_COUNTRIES);
  const max = top[0]?.visits ?? 0;
  const { lang, t } = usePage();
  return (
    <Layout nonce={nonce} title={t.stats.title(id)} scripts={["stats.js"]} styles={["stats.css"]}>
      <Header />
      <section class="stats" data-stats data-id={id} aria-labelledby="stats-title">
        <div class="stats__head">
          <h2 class="stats__title" id="stats-title">
            {t.stats.heading}
          </h2>
          <div class="result__link">
            <a
              class="result__short"
              data-field="shortUrl"
              data-value={shortUrl}
              href={shortUrl}
              aria-label={`${t.result.shortLink}: ${shortUrl}`}
            >
              {withoutProtocol(shortUrl)}
            </a>
            <div class="result__share">
              <button type="button" class="button result__copy" data-copy="shortUrl" hidden>
                {t.common.copy.button}
              </button>
            </div>
          </div>
          <p class="stats__meta">
            {t.result.target} <span class="stats__target">{target}</span>
          </p>
          <p class="stats__meta">
            {t.stats.created}{" "}
            <time datetime={new Date(createdAt).toISOString()}>{formatUtc(createdAt, lang)}</time>
            {" · "}
            {t.stats.expires}{" "}
            {expiresAt === null ? (
              t.stats.never
            ) : (
              <time datetime={new Date(expiresAt).toISOString()}>{formatUtc(expiresAt, lang)}</time>
            )}
          </p>
        </div>

        <div class="stats__grid">
          <div class="stats__panel">
            <h3 class="stats__heading">{t.stats.visits}</h3>
            {visits === 0 ? (
              <div class="stats__zero">
                <p class="stats__zero-title">{t.stats.noClicks}</p>
                <p class="stats__empty">{t.stats.noClicksHint}</p>
                <button type="button" class="button" data-copy="shortUrl" hidden>
                  {t.common.copy.button}
                </button>
              </div>
            ) : (
              <p class="counter">
                <span class="counter__value">{visits}</span>
              </p>
            )}
          </div>

          <div class="stats__panel">
            <h3 class="stats__heading">{t.stats.countries}</h3>
            {top.length === 0 ? (
              <p class="stats__empty">{t.stats.noVisits}</p>
            ) : (
              <ol class="bars">
                {top.map((country) => (
                  <li class="bars__item">
                    <span class="bars__label">{countryName(country.code, lang)}</span>
                    <meter
                      class="bars__meter"
                      min={0}
                      max={max}
                      value={country.visits}
                      aria-label={`${countryName(country.code, lang)}: ${country.visits}`}
                    />
                    <span class="bars__value">{country.visits}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>

        {partial ? (
          <p class="notice notice--warning" role="status">
            {t.stats.partial}
          </p>
        ) : null}

        <div class="stats__panel stats__owner" data-owner hidden>
          <h3 class="stats__heading">{t.stats.cities}</h3>
          <ol class="bars" data-cities />
          <p class="stats__empty" data-no-cities hidden>
            {t.stats.noCities}
          </p>
          <div class="stats__map-bar" data-map-bar>
            <button type="button" class="button" data-map-button>
              {t.stats.showMap}
            </button>
          </div>
          <section class="stats__map" data-map hidden aria-label={t.stats.map} />
        </div>

        <p class="stats__hint" data-owner-hint>
          {t.stats.ownerHint}
        </p>

        <div class="result__actions">
          {reportHref ? (
            <a class="button button--ghost" href={reportHref} data-report>
              {t.linkError.report}
            </a>
          ) : null}
          <a class="button" href="/">
            {t.linkError.shortenOwn}
          </a>
        </div>
      </section>
    </Layout>
  );
}
