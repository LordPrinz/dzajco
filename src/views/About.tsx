import type { CountryStat } from "../db/queries";
import { LOCALE } from "../shared/lang";
import { countryName } from "../shared/stats";
import { FeatureIcon, type FeatureIconName } from "./FeatureIcon";
import { Layout } from "./Layout";
import { usePage } from "./page-context";

export interface AboutStats {
  links: number;
  visits: number;
  countries: readonly CountryStat[];
  /** ISO time of the last recompute, or null when it has not run yet. */
  updatedAt: string | null;
}

/** In display order; each name is also the key of the feature's text. */
const FEATURES: readonly FeatureIconName[] = [
  "login",
  "expiry",
  "name",
  "delete",
  "visitors",
  "history",
];

const TOP = 8;

export function About({ nonce, stats }: { nonce: string; stats: AboutStats }) {
  const { lang, t } = usePage();
  const locale = LOCALE[lang];
  const number = new Intl.NumberFormat(locale);
  const top = [...stats.countries].sort((a, b) => b.visits - a.visits).slice(0, TOP);

  return (
    <Layout nonce={nonce} title={t.about.title} styles={["pages.css"]}>
      <article class="doc">
        <h1 class="doc__title">{t.about.heading(<span class="doc__accent">dzajco</span>)}</h1>
        <p class="doc__lead">{t.about.lead}</p>

        <ul class="features">
          {FEATURES.map((name) => (
            <li class="features__item">
              <span class="features__badge">
                <FeatureIcon name={name} />
              </span>
              <h2 class="features__title">{t.about.features[name].title}</h2>
              <p>{t.about.features[name].text}</p>
            </li>
          ))}
        </ul>

        <section class="doc__section" aria-labelledby="global-stats">
          <h2 id="global-stats">{t.about.numbers}</h2>
          {stats.updatedAt === null ? (
            <p>{t.about.notYet}</p>
          ) : (
            <>
              <dl class="totals">
                <div class="totals__item">
                  <dt>{t.about.links}</dt>
                  <dd data-stat="links">{number.format(stats.links)}</dd>
                </div>
                <div class="totals__item">
                  <dt>{t.about.visits}</dt>
                  <dd data-stat="visits">{number.format(stats.visits)}</dd>
                </div>
              </dl>

              {top.length > 0 && (
                <>
                  <h3 class="doc__subtitle">{t.about.topCountries}</h3>
                  <ol class="scoreboard">
                    {top.map((country) => (
                      <li class="scoreboard__item">
                        <span class="scoreboard__name">{countryName(country.code, lang)}</span>
                        <span class="scoreboard__visits">{number.format(country.visits)}</span>
                      </li>
                    ))}
                  </ol>
                </>
              )}
              <p class="doc__note">
                {t.about.updated}{" "}
                <time datetime={stats.updatedAt}>
                  {new Date(stats.updatedAt).toLocaleString(locale, {
                    dateStyle: "long",
                    timeStyle: "short",
                    timeZone: "UTC",
                  })}{" "}
                  UTC
                </time>
              </p>
            </>
          )}
          <p class="doc__note">{t.about.liveOnly}</p>
          <p class="doc__note">{t.about.daily}</p>
        </section>

        <section class="doc__section" aria-labelledby="support">
          <h2 id="support">{t.about.support}</h2>
          <p>{t.about.supportText}</p>
          <iframe
            class="sponsor"
            src="https://github.com/sponsors/LordPrinz/button"
            title={t.about.sponsor}
            width="114"
            height="32"
            sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
            loading="lazy"
          />
        </section>
      </article>
    </Layout>
  );
}
