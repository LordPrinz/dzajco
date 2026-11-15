import type { CountryStat } from "../db/queries";
import { countryName } from "../shared/stats";
import { FeatureIcon, type FeatureIconName } from "./FeatureIcon";
import { Layout } from "./Layout";

export interface AboutStats {
  links: number;
  visits: number;
  countries: readonly CountryStat[];
  /** ISO time of the last recompute, or null when it has not run yet. */
  updatedAt: string | null;
}

const FEATURES: readonly { icon: FeatureIconName; title: string; text: string }[] = [
  {
    icon: "login",
    title: "Bez logowania",
    text: "Żadnych kont. Skracasz link od razu, bez zakładania profilu.",
  },
  {
    icon: "expiry",
    title: "Data wygaśnięcia",
    text: "Ustaw, kiedy link ma przestać działać. Dobre do promocji i tymczasowych udostępnień.",
  },
  {
    icon: "name",
    title: "Własne nazwy",
    text: "Nadaj linkowi własną nazwę albo pozwól wygenerować krótki, unikalny identyfikator.",
  },
  {
    icon: "delete",
    title: "Ręczne usuwanie",
    text: "Kluczem z momentu utworzenia usuniesz link, kiedy tylko zechcesz.",
  },
  {
    icon: "visitors",
    title: "Licznik wejść",
    text: "Zobacz, ile razy link został otwarty i z jakich krajów. Pełne dane, z miastami, widzi właściciel klucza.",
  },
  {
    icon: "history",
    title: "Historia",
    text: "Linki z tej przeglądarki wracają na liście, żeby łatwo je skopiować lub usunąć.",
  },
];

const TOP = 8;
const NUMBER = new Intl.NumberFormat("pl-PL");

function formatUpdated(iso: string): string {
  return new Date(iso).toLocaleString("pl-PL", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "UTC",
  });
}

export function About({ nonce, stats }: { nonce: string; stats: AboutStats }) {
  const top = [...stats.countries].sort((a, b) => b.visits - a.visits).slice(0, TOP);

  return (
    <Layout nonce={nonce} title="O nas" styles={["pages.css"]}>
      <article class="doc">
        <h1 class="doc__title">
          Dlaczego <span class="doc__accent">dzajco</span>
        </h1>
        <p class="doc__lead">
          Prosty i szybki skracacz linków. Ma robić jedno: z długiego adresu zrobić krótki, który
          działa tak długo, jak tego chcesz.
        </p>

        <ul class="features">
          {FEATURES.map((feature) => (
            <li class="features__item">
              <span class="features__badge">
                <FeatureIcon name={feature.icon} />
              </span>
              <h2 class="features__title">{feature.title}</h2>
              <p>{feature.text}</p>
            </li>
          ))}
        </ul>

        <section class="doc__section" aria-labelledby="global-stats">
          <h2 id="global-stats">Serwis w liczbach</h2>
          {stats.updatedAt === null ? (
            <p>Statystyki pojawią się po pierwszym codziennym przeliczeniu.</p>
          ) : (
            <>
              <dl class="totals">
                <div class="totals__item">
                  <dt>Aktywnych linków</dt>
                  <dd data-stat="links">{NUMBER.format(stats.links)}</dd>
                </div>
                <div class="totals__item">
                  <dt>Wejść w aktywnych linkach</dt>
                  <dd data-stat="visits">{NUMBER.format(stats.visits)}</dd>
                </div>
              </dl>

              {top.length > 0 && (
                <>
                  <h3 class="doc__subtitle">Kraje z największą liczbą wejść</h3>
                  <ol class="scoreboard">
                    {top.map((country) => (
                      <li class="scoreboard__item">
                        <span class="scoreboard__name">{countryName(country.code)}</span>
                        <span class="scoreboard__visits">{NUMBER.format(country.visits)}</span>
                      </li>
                    ))}
                  </ol>
                </>
              )}
              <p class="doc__note">
                Zaktualizowano:{" "}
                <time datetime={stats.updatedAt}>{formatUpdated(stats.updatedAt)} UTC</time>
              </p>
            </>
          )}
          <p class="doc__note">
            Usunięte i wygasłe linki nie wchodzą do tych liczb, a razem z nimi znikają ich wejścia.
          </p>
          <p class="doc__note">
            Liczby przelicza się raz na dobę, więc mogą się spóźniać nawet o około 24 godziny.
          </p>
        </section>

        <section class="doc__section" aria-labelledby="support">
          <h2 id="support">Wesprzyj projekt</h2>
          <p>Dzajco jest darmowe. Jeśli Ci się przydaje, możesz wesprzeć rozwój projektu.</p>
          <iframe
            class="sponsor"
            src="https://github.com/sponsors/LordPrinz/button"
            title="Wesprzyj LordPrinz na GitHub Sponsors"
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
