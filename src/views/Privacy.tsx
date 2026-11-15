import { Layout } from "./Layout";

export interface PrivacyProps {
  nonce: string;
  /** `mailto:` link from `ABUSE_EMAIL`, or null when none is configured. */
  contactHref: string | null;
}

export const PRIVACY_UPDATED = "2026-11-14";

export function Privacy({ nonce, contactHref }: PrivacyProps) {
  return (
    <Layout nonce={nonce} title="Polityka prywatności" styles={["pages.css"]}>
      <article class="doc">
        <h1 class="doc__title">Polityka prywatności</h1>
        <p class="doc__lead">
          Ostatnia aktualizacja: <time datetime={PRIVACY_UPDATED}>14.11.2026</time>. Zbieramy tyle
          danych, ile potrzeba, żeby link działał i żeby pokazać, skąd wchodzą odwiedzający.
        </p>

        <section class="doc__section" aria-labelledby="p-stored">
          <h2 id="p-stored">Co przechowujemy</h2>
          <ul>
            <li>
              <strong>Linki.</strong> Krótką nazwę, adres docelowy, datę utworzenia i datę
              wygaśnięcia. Link wygasły jest usuwany.
            </li>
            <li>
              <strong>Klucze do usuwania w postaci skrótu.</strong> Klucz pokazujemy raz, przy
              utworzeniu linku. Zapisujemy wyłącznie jego skrót kryptograficzny (HMAC), więc nie
              potrafimy go odtworzyć ani Ci go przypomnieć.
            </li>
            <li>
              <strong>Zagregowane liczniki wejść.</strong> Dla każdego linku liczbę wejść z
              podziałem na kraj i miasto. Kraj i miasto pochodzą z danych, które Cloudflare dołącza
              do żądania. Liczniki nie wskazują pojedynczej osoby i zostają w bazie danych, dopóki
              istnieje link.
            </li>
            <li>
              <strong>Zdarzenia wejść.</strong> Każde wejście w link jest zapisywane w Cloudflare
              Analytics Engine jako zdarzenie: czas, identyfikator linku, kraj, miasto i przybliżone
              współrzędne. Nie zapisujemy adresu IP ani nagłówka User-Agent. Zdarzenia są
              przechowywane do 3 miesięcy, a potem zostają tylko zagregowane liczniki z bazy danych.
            </li>
          </ul>
        </section>

        <section class="doc__section" aria-labelledby="p-ip">
          <h2 id="p-ip">Adresy IP</h2>
          <p>
            Adresy IP klientów występują tylko w logach samego Cloudflare, które działa jako nasz
            dostawca infrastruktury. Nasza aplikacja nie zapisuje ich w bazie ani we własnych
            logach. Adres IP służy jej wyłącznie do chwilowego limitowania liczby żądań i nie jest
            przechowywany.
          </p>
        </section>

        <section class="doc__section" aria-labelledby="p-analytics">
          <h2 id="p-analytics">Statystyki odwiedzin serwisu</h2>
          <p>
            Używamy Cloudflare Web Analytics bez plików cookie. Mierzy ona odsłony stron serwisu w
            zbiorczej postaci, bez śledzenia między witrynami i bez profilowania.
          </p>
        </section>

        <section class="doc__section" aria-labelledby="p-local">
          <h2 id="p-local">Historia w przeglądarce</h2>
          <p>
            Lista Twoich linków, razem z kluczami do ich usuwania, jest zapisana w pamięci lokalnej
            przeglądarki (localStorage, klucz <code>links-history</code>). Mieszka tylko na Twoim
            urządzeniu i nie trafia na nasz serwer. Wyczyszczenie danych przeglądarki usuwa ją
            bezpowrotnie. Do usunięcia linku potrzebny jest klucz, więc zapisz go osobno, jeśli
            chcesz mieć dostęp z innego urządzenia.
          </p>
        </section>

        <section class="doc__section" aria-labelledby="p-cookies">
          <h2 id="p-cookies">Pliki cookie</h2>
          <p>
            Serwis ustawia jeden plik cookie, <code>theme</code>, i tylko wtedy, gdy wybierzesz
            jasny albo ciemny motyw. Zapamiętuje ten wybór na rok i nie służy do śledzenia. Powrót
            do motywu systemowego go usuwa.
          </p>
        </section>

        <section class="doc__section" aria-labelledby="p-map">
          <h2 id="p-map">Mapa na stronie statystyk</h2>
          <p>
            Mapa miast w statystykach właściciela linku pobiera kafelki z OpenStreetMap
            (tile.openstreetmap.org). Przeglądarka wysyła wtedy do OpenStreetMap swój adres IP i
            fragment mapy, który wyświetla, ale nie adres linku. Mapa ładuje się dopiero po jej
            otwarciu.
          </p>
        </section>

        <section class="doc__section" aria-labelledby="p-contact">
          <h2 id="p-contact">Kontakt</h2>
          <p>
            {contactHref ? (
              <>
                Pytania o dane i zgłoszenia nadużyć: <a href={contactHref}>napisz do nas</a>.
              </>
            ) : (
              <>Pytania o dane i zgłoszenia nadużyć kieruj do administratora serwisu.</>
            )}
          </p>
        </section>
      </article>
    </Layout>
  );
}
