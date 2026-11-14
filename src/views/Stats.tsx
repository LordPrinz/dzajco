import { type CountryRow, countryName } from "../shared/stats";
import { Header } from "./Header";
import { Layout } from "./Layout";

const TOP_COUNTRIES = 10;

export interface StatsProps {
  nonce: string;
  id: string;
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
export function Stats({ nonce, id, visits, countries, partial, reportHref }: StatsProps) {
  const top = countries.slice(0, TOP_COUNTRIES);
  const max = top[0]?.visits ?? 0;
  return (
    <Layout nonce={nonce} title={`Statystyki ${id}`} scripts={["stats.js"]} styles={["stats.css"]}>
      <Header />
      <section class="stats" data-stats data-id={id} aria-labelledby="stats-title">
        <h2 class="stats__title" id="stats-title">
          Statystyki linku <span class="stats__id">{id}</span>
        </h2>

        <div class="stats__grid">
          <div class="stats__panel">
            <h3 class="stats__heading">Wejścia</h3>
            <p class="counter">
              <span class="counter__value">{visits}</span>
            </p>
          </div>

          <div class="stats__panel">
            <h3 class="stats__heading">Kraje</h3>
            {top.length === 0 ? (
              <p class="stats__empty">Brak wejść</p>
            ) : (
              <ol class="bars">
                {top.map((country) => (
                  <li class="bars__item">
                    <span class="bars__label">{countryName(country.code)}</span>
                    <meter
                      class="bars__meter"
                      min={0}
                      max={max}
                      value={country.visits}
                      aria-label={`${countryName(country.code)}: ${country.visits}`}
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
            Najnowsze wejścia mogą jeszcze nie być widoczne.
          </p>
        ) : null}

        <div class="stats__panel stats__owner" data-owner hidden>
          <h3 class="stats__heading">Miasta</h3>
          <ol class="bars" data-cities />
          <p class="stats__empty" data-no-cities hidden>
            Brak danych o miastach
          </p>
          <div class="stats__map-bar" data-map-bar>
            <button type="button" class="button" data-map-button>
              Pokaż mapę
            </button>
          </div>
          <section class="stats__map" data-map hidden aria-label="Mapa wejść" />
        </div>

        <p class="stats__hint" data-owner-hint>
          Miasta i mapa są widoczne tylko w przeglądarce, w której utworzono link (potrzebny jest
          klucz z historii).
        </p>

        <div class="result__actions">
          {reportHref ? (
            <a class="button button--ghost" href={reportHref}>
              Zgłoś nadużycie
            </a>
          ) : null}
          <a class="button" href="/">
            Skróć własny link
          </a>
        </div>
      </section>
    </Layout>
  );
}
